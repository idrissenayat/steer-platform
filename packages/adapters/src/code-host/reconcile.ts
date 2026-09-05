import type { ArtifactReader, ArtifactSnapshot } from './github.ts';

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
