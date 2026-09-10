import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { ArtifactSnapshot, CorpusRepositoryReader } from './github.ts';

export type CorpusBatchReference = Readonly<{ inventory: unknown; revision: string; path: string }>;
type BatchBoundary = { check(): void; begin(): Promise<void>; before(refs: readonly CorpusBatchReference[]): Promise<void>;
  after(refs: readonly CorpusBatchReference[]): Promise<void> };
type NativeRead = (refs: readonly CorpusBatchReference[], boundary: BatchBoundary, signal: AbortSignal) => Promise<ArtifactSnapshot[]>;
const registrations = new WeakMap<CorpusRepositoryReader, { read: NativeRead; inventory: Function; artifact: Function; binding: string }>();
const fail = () => new Error('Corpus batch could not be verified.');
const oid = z.string().regex(/^[a-f0-9]{40}$/), maxFile = 131072, maxResponse = 2097152;
const reference = z.strictObject({ inventory: z.unknown(), revision: oid, path: z.string().min(1).max(500).refine(v =>
  v.split('/').every(p => p && p !== '.' && p !== '..') && !/[\\\u0000-\u001f\u007f]/.test(v)) });

/** Internal reader-construction registry, not an HTTP capability or grant cache. */
export function registerCorpusArtifactBatch(reader: CorpusRepositoryReader, read: NativeRead) {
  if (registrations.has(reader)) throw fail();
  registrations.set(reader, { read, inventory: reader.readScopeInventory, artifact: reader.readArtifact, binding: JSON.stringify(reader.binding) });
}

/** Caller owns product/root selection, lifecycle and final phase closure. Every
 * callback here is trusted read-only authority, never a browser-supplied grant. */
export async function readCorpusArtifactBatch(reader: CorpusRepositoryReader, raw: readonly CorpusBatchReference[], boundary: {
  current(): Promise<void>; authorizeSource(ref: Readonly<{ revision: string; path: string }>): Promise<void>; signal: AbortSignal;
}) {
  const registered = registrations.get(reader), current = boundary.current, source = boundary.authorizeSource, signal = boundary.signal;
  const refs = z.array(reference).min(1).max(100).parse(raw).map(ref => Object.freeze(ref));
  if (new Set(refs.map(r => JSON.stringify([r.revision, r.path]))).size !== refs.length
    || new Set(refs.map(r => r.inventory)).size > 4 || typeof current !== 'function' || typeof source !== 'function') throw fail();
  const guard = () => { signal.throwIfAborted();
    if (!registered || reader.readScopeInventory !== registered.inventory || reader.readArtifact !== registered.artifact
      || JSON.stringify(reader.binding) !== registered.binding || boundary.current !== current || boundary.authorizeSource !== source
      || boundary.signal !== signal) throw fail(); };
  const fresh = async () => { guard(); if (await Reflect.apply(current, boundary, []) !== undefined) throw fail(); guard(); };
  const permissions = async (batch: readonly CorpusBatchReference[]) => { for (const ref of batch) {
    guard(); if (await Reflect.apply(source, boundary, [Object.freeze({ revision: ref.revision, path: ref.path })]) !== undefined) throw fail(); guard();
  } };
  try {
    guard();
    // Native membership/planning happens before begin(), so invalid proofs cannot
    // cause a caller/provider query. No content cache survives this invocation.
    const result = await registered!.read(refs, { check: guard, begin: fresh,
      before: async batch => { await permissions(batch); await fresh(); },
      after: async batch => { await permissions(batch); await fresh(); } }, signal);
    guard(); return result;
  } catch { throw fail(); }
}

type Entry = { objectSha: string; size?: number | undefined };
export function planCorpusArtifactBatches(refs: readonly CorpusBatchReference[], entryFor: (ref: CorpusBatchReference) => Entry) {
  const objects = new Map<string, { oid: string; size: number; hint: number | undefined; refs: CorpusBatchReference[] }>();
  for (const ref of refs) {
    const entry = entryFor(ref), id = oid.parse(entry.objectSha), size = entry.size ?? maxFile;
    if (!Number.isSafeInteger(size) || size < 0 || size > maxFile) throw fail();
    const previous = objects.get(id);
    if (previous) {
      if (previous.hint !== undefined && entry.size !== undefined && previous.hint !== entry.size) throw fail();
      previous.size = Math.max(previous.size, size); previous.hint ??= entry.size; previous.refs.push(ref);
    } else objects.set(id, { oid: id, size, hint: entry.size, refs: [ref] });
  }
  const groups: Array<Array<(typeof objects extends Map<string, infer V> ? V : never)>> = []; let bytes = 4096;
  for (const object of objects.values()) {
    const estimate = 6 * object.size + 2048; // Worst-case JSON escaping.
    if (!groups.length || groups.at(-1)!.length === 16 || bytes + estimate > maxResponse) { groups.push([]); bytes = 4096; }
    groups.at(-1)!.push(object); bytes += estimate;
  }
  return groups;
}

export function corpusArtifactBatchQuery(count: number) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 16) throw fail();
  const variables = Array.from({ length: count }, (_, i) => `$o${i}: GitObjectID!`).join(', ');
  const objects = Array.from({ length: count }, (_, i) => `b${i}: object(oid: $o${i}) { __typename ... on Blob { oid byteSize isBinary isTruncated text } }`).join(' ');
  return `query SteerCorpusArtifactBatch($owner: String!, $name: String!, ${variables}) { repository(owner: $owner, name: $name) { databaseId nameWithOwner ${objects} } }`;
}

export function decodeCorpusArtifactBatch(raw: unknown, binding: CorpusRepositoryReader['binding'], batch: ReturnType<typeof planCorpusArtifactBatches>[number]) {
  const repository = z.strictObject({ data: z.strictObject({ repository: z.record(z.string(), z.unknown()) }) }).parse(raw).data.repository;
  if (repository.databaseId !== binding.repositoryId || typeof repository.nameWithOwner !== 'string'
    || repository.nameWithOwner.toLowerCase() !== `${binding.owner}/${binding.repository}`.toLowerCase()
    || Object.keys(repository).sort().join() !== ['databaseId', 'nameWithOwner', ...batch.map((_, i) => `b${i}`)].sort().join()) throw fail();
  return batch.flatMap((object, i) => {
    const value = z.strictObject({ __typename: z.literal('Blob'), oid, byteSize: z.number().int().min(0).max(maxFile),
      isBinary: z.literal(false), isTruncated: z.literal(false), text: z.string().max(maxFile).refine(v => !/[\uD800-\uDFFF]/u.test(v)) }).parse(repository[`b${i}`]);
    const bytes = Buffer.from(value.text, 'utf8'), digest = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (value.oid !== object.oid || digest !== object.oid || bytes.length !== value.byteSize
      || (object.hint !== undefined && bytes.length !== object.hint)) throw fail();
    return object.refs.map(ref => Object.freeze({ organizationId: binding.organizationId, repositoryId: binding.repositoryId,
      revision: ref.revision, path: ref.path, content: value.text, contentDigest: createHash('sha256').update(bytes).digest('hex'), blobSha: digest }));
  });
}
