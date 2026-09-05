import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { RepositoryReader } from '../src/code-host/github.ts';
import { reconcileRepository, ReconciliationError, type SnapshotProjectionSink, type ProjectionOutcome } from '../src/code-host/reconcile.ts';

const revision = 'a'.repeat(40), treeSha = 'b'.repeat(40), content = 'synthetic\n';
const blobSha = createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0${content}`).digest('hex');
const selection = { roots: ['intent'], fileNames: ['BRIEF.md', 'SPEC.md'] };
const paths = ['intent/0001/BRIEF.md', 'intent/0001/SPEC.md'];
function fixture() {
  let writes = 0, storageReads = 0;
  const reader: RepositoryReader = {
    binding: { organizationId: 'org-a', repositoryId: 2, installationId: 1, owner: 'synthetic', repository: 'repo', branch: 'main' },
    readHead: async () => revision,
    readInventory: async () => ({ organizationId: 'org-a', repositoryId: 2, revision, treeSha, entries: paths.map((path) => ({ path, blobSha })) }),
    readArtifact: async (path, rev) => ({ organizationId: 'org-a', repositoryId: 2, path, revision: rev, content, blobSha,
      contentDigest: createHash('sha256').update(content).digest('hex') }),
  };
  const sink: SnapshotProjectionSink<ProjectionOutcome> = {
    currentRevision: async () => { storageReads++; return null; }, ingest: async () => { writes++; return 'applied'; },
  };
  return { reader, sink, writes: () => writes, storageReads: () => storageReads };
}
const error = (code: string) => (value: unknown) => value instanceof ReconciliationError && value.code === code && value.acknowledged === 0;

test('inventory drives the exact pinned manifest; empty selection writes and removes nothing', async () => {
  const f = fixture(); const result = await reconcileRepository(f.reader, selection, f.sink);
  assert.equal(result.treeSha, treeSha); assert.equal(result.revision, revision); assert.deepEqual(result.outcomes.map((item) => item.path), paths);
  assert.equal(f.writes(), 2);
  const g = fixture(); const inventory = await g.reader.readInventory(selection, revision);
  g.reader.readInventory = async () => ({ ...inventory, entries: [] });
  assert.deepEqual((await reconcileRepository(g.reader, selection, g.sink)).outcomes, []);
  assert.equal(g.storageReads(), 0); assert.equal(g.writes(), 0);
});

test('inventory binding, scope, duplicate paths and blob mismatch fail before ingestion', async () => {
  for (const change of [{ organizationId: 'other' }, { repositoryId: 4 }, { revision: 'c'.repeat(40) },
    { entries: [{ path: 'private/BRIEF.md', blobSha }] }, { entries: [{ path: paths[0]!, blobSha }, { path: paths[0]!, blobSha }] },
    { entries: [{ path: paths[0]!, blobSha: 'c'.repeat(40) }] }]) {
    const f = fixture(); const inventory = await f.reader.readInventory(selection, revision);
    f.reader.readInventory = async () => ({ ...inventory, ...change });
    await assert.rejects(reconcileRepository(f.reader, selection, f.sink), error('SOURCE_FAILED')); assert.equal(f.writes(), 0);
  }
});

test('head movement across discovery and staging never substitutes a different revision', async () => {
  for (const moveAt of [2, 3]) {
    const f = fixture(); let reads = 0;
    f.reader.readHead = async () => ++reads >= moveAt ? 'c'.repeat(40) : revision;
    await assert.rejects(reconcileRepository(f.reader, selection, f.sink), error('SOURCE_CHANGED'));
    assert.equal(f.storageReads(), 0); assert.equal(f.writes(), 0);
  }
  const f = fixture(); const controller = new AbortController(); const read = f.reader.readInventory;
  f.reader.readInventory = async (...args) => { const result = await read(...args); controller.abort(); return result; };
  await assert.rejects(reconcileRepository(f.reader, selection, f.sink, controller.signal), error('ABORTED')); assert.equal(f.storageReads(), 0);
});
