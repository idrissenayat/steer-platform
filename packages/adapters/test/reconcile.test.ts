import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ArtifactReader } from '../src/code-host/github.ts';
import { reconcileArtifact, type SnapshotProjectionSink } from '../src/code-host/reconcile.ts';

const revision = 'a'.repeat(40), path = 'items/1/BRIEF.md';
const reader = (moved = false): ArtifactReader => {
  let reads = 0;
  return {
    binding: { organizationId: 'org-a', repositoryId: 2, installationId: 1, owner: 'example', repository: 'repo', branch: 'main' },
    readHead: async () => ++reads > 1 && moved ? 'b'.repeat(40) : revision,
    readArtifact: async () => ({ organizationId: 'org-a', repositoryId: 2, path, revision, content: 'source', contentDigest: 'c'.repeat(64), blobSha: 'd'.repeat(40) }),
  };
};

test('reconciliation passes exact verified source and previously observed revision to its sink', async () => {
  const sink: SnapshotProjectionSink<string> = {
    currentRevision: async (repository, actualPath, org) => { assert.deepEqual([repository, actualPath, org], ['github:2', path, 'org-a']); return null; },
    ingest: async (snapshot, previous) => { assert.equal(snapshot.revision, revision); assert.equal(snapshot.repository, 'github:2'); assert.equal(previous, null); return 'applied'; },
  };
  assert.equal(await reconcileArtifact(reader(), path, sink), 'applied');
});

test('moving head, source failure and wrong artifact binding never invoke ingestion', async () => {
  let writes = 0;
  const sink = { currentRevision: async () => null, ingest: async () => { writes++; return 'invalid'; } };
  await assert.rejects(reconcileArtifact(reader(true), path, sink), /Source revision changed/);
  const failed = reader(); failed.readArtifact = async () => { throw new Error('source unavailable'); };
  await assert.rejects(reconcileArtifact(failed, path, sink), /source unavailable/);
  const wrong = reader(); const read = wrong.readArtifact; wrong.readArtifact = async (...args) => ({ ...await read(...args), organizationId: 'org-b' });
  await assert.rejects(reconcileArtifact(wrong, path, sink), /binding is invalid/);
  assert.equal(writes, 0);
});
