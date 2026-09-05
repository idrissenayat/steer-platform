import type { ArtifactReader, ArtifactSnapshot } from './github.ts';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { artifactProjectionInputSchema } from '@steer/tool-registry';

export interface SnapshotProjectionSink<T> {
  currentRevision(repository: string, path: string, organizationId: string): Promise<string | null>;
  ingest(snapshot: Omit<ArtifactSnapshot, 'repositoryId'> & { repository: string }, expectedRevision: string | null): Promise<T>;
}

/** Single-path repair poll; durable scheduling/webhooks are separate integrations. */
export async function reconcileArtifact<T>(reader: ArtifactReader, path: string, sink: SnapshotProjectionSink<T>): Promise<T> {
  const repository = `github:${reader.binding.repositoryId}`;
  const organizationId = reader.binding.organizationId;
  const expected = await sink.currentRevision(repository, path, organizationId);
  const head = await reader.readHead();
  const snapshot = await reader.readArtifact(path, head);
  if (snapshot.organizationId !== organizationId || snapshot.repositoryId !== reader.binding.repositoryId ||
      snapshot.path !== path || snapshot.revision !== head || await reader.readHead() !== head) {
    throw new Error('Source revision changed or binding is invalid; reconcile again.');
  }
  const { repositoryId: _repositoryId, ...artifact } = snapshot;
  return sink.ingest({ ...artifact, repository }, expected);
}

export type ProjectionOutcome = 'applied' | 'duplicate' | 'repaired' | 'superseded';
type ReconciliationFailure = 'INVALID_SCOPE' | 'SOURCE_FAILED' | 'SOURCE_CHANGED' | 'SINK_FAILED' | 'ABORTED';
export class ReconciliationError extends Error {
  readonly code: ReconciliationFailure;
  readonly acknowledged: number;
  readonly revision: string | null;
  constructor(code: ReconciliationFailure, acknowledged: number, revision: string | null) {
    super('Repository projection reconciliation did not complete.');
    this.code = code; this.acknowledged = acknowledged; this.revision = revision;
  }
}
const pathsSchema = z.array(artifactProjectionInputSchema.shape.path).min(1).max(100);

/** Explicit manifest, one revision, bounded staging; not atomic across records or a scheduler. */
export async function reconcileArtifacts(reader: ArtifactReader, rawPaths: readonly string[],
  sink: SnapshotProjectionSink<ProjectionOutcome>, signal?: AbortSignal) {
  const parsed = pathsSchema.safeParse(rawPaths);
  if (!parsed.success || new Set(parsed.data).size !== parsed.data.length) throw new ReconciliationError('INVALID_SCOPE', 0, null);
  const paths = [...parsed.data].sort();
  const repository = `github:${reader.binding.repositoryId}`, organizationId = reader.binding.organizationId;
  let revision: string | null = null, acknowledged = 0, bytes = 0;
  const abort = () => { if (signal?.aborted) throw new ReconciliationError('ABORTED', acknowledged, revision); };
  const source = async <T>(operation: () => Promise<T>): Promise<T> => {
    abort();
    try { const value = await operation(); abort(); return value; }
    catch (error) { if (error instanceof ReconciliationError) throw error; throw new ReconciliationError('SOURCE_FAILED', acknowledged, revision); }
  };
  const storage = async <T>(operation: () => Promise<T>): Promise<T> => {
    abort();
    try { return await operation(); }
    catch { throw new ReconciliationError('SINK_FAILED', acknowledged, revision); }
  };
  revision = await source(() => reader.readHead());
  if (!artifactProjectionInputSchema.shape.revision.safeParse(revision).success) throw new ReconciliationError('SOURCE_FAILED', 0, null);
  const pinned = revision;
  const stable = async () => { if (await source(() => reader.readHead()) !== pinned) throw new ReconciliationError('SOURCE_CHANGED', acknowledged, pinned); };
  const staged: { snapshot: Omit<ArtifactSnapshot, 'repositoryId'> & { repository: string }; expected: string | null }[] = [];
  for (const path of paths) {
    const expected = await storage(() => sink.currentRevision(repository, path, organizationId));
    if (!artifactProjectionInputSchema.shape.revision.nullable().safeParse(expected).success) throw new ReconciliationError('SINK_FAILED', acknowledged, pinned);
    const snapshot = await source(() => reader.readArtifact(path, pinned));
    const content = typeof snapshot?.content === 'string' ? Buffer.from(snapshot.content, 'utf8') : null;
    if (!content || content.length > 512 * 1024 || snapshot.organizationId !== organizationId || snapshot.repositoryId !== reader.binding.repositoryId ||
        snapshot.path !== path || snapshot.revision !== pinned || createHash('sha256').update(content).digest('hex') !== snapshot.contentDigest ||
        createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex') !== snapshot.blobSha || (bytes += content.length) > 8 * 1024 * 1024) {
      throw new ReconciliationError('SOURCE_FAILED', acknowledged, pinned);
    }
    const { repositoryId: _repositoryId, ...artifact } = snapshot;
    staged.push({ snapshot: { ...artifact, repository }, expected });
  }
  // No projection writes until every requested source artifact has been checked.
  await stable();
  const outcomes: { path: string; outcome: ProjectionOutcome }[] = [];
  for (const item of staged) {
    await stable();
    const outcome = await storage(() => sink.ingest(item.snapshot, item.expected));
    if (!['applied', 'duplicate', 'repaired', 'superseded'].includes(outcome)) throw new ReconciliationError('SINK_FAILED', acknowledged, pinned);
    outcomes.push({ path: item.snapshot.path, outcome }); acknowledged++;
  }
  await stable();
  return { revision: pinned, status: outcomes.some((item) => item.outcome === 'superseded') ? 'superseded' as const : 'reconciled' as const, outcomes };
}
