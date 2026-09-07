import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { reconcileRecordedBrief, type ProjectionOutcome } from '../src/code-host/reconcile.ts';
import type { ArtifactReader } from '../src/code-host/github.ts';

const content = '# Brief: recorded test\n', revision = 'a'.repeat(40), path = 'items/0158-fixture/BRIEF.md';
const contentDigest = createHash('sha256').update(content).digest('hex');
const blobSha = createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex');
const scope = { organizationId: 'org', repository: 'github:1', branch: 'main', paths: [path] };
const result = { organizationId: 'org', repository: 'github:1', branch: 'main', path, revision, contentDigest, blobSha,
  subject: 'synthetic', idempotencyKey: '15800000-0000-4000-8000-000000000001', expectedHead: 'b'.repeat(40), requestDigest: 'c'.repeat(64), outcome: 'committed' };
const observation = { result, gateSigned: false };
function fixture() {
  let reads = 0, writes = 0, selected: string | null = null;
  const binding = { organizationId: 'org', repositoryId: 1, installationId: 1, owner: 'fixture', repository: 'fixture', branch: 'main' };
  const reader: ArtifactReader = { binding,
    readHead: async () => { throw new Error('Exact historical projection must not substitute current head'); },
    readArtifact: async (actualPath, target) => { reads++; assert.equal(actualPath, path); assert.equal(target, revision);
      return { organizationId: 'org', repositoryId: 1, path, revision, content, contentDigest, blobSha }; } };
  const sink = { currentRevision: async (repository: string, actualPath: string, organization: string) => {
    assert.deepEqual([repository, actualPath, organization], ['github:1', path, 'org']); return selected;
  }, ingest: async (snapshot: unknown, expected: string | null): Promise<ProjectionOutcome> => {
    writes++; assert.equal(expected, selected); assert.deepEqual(snapshot, { organizationId: 'org', repository: 'github:1', path, revision, content, contentDigest, blobSha });
    const outcome = selected === revision ? 'duplicate' : 'applied'; selected = revision; return outcome;
  } };
  return { reader, binding, sink, counts: () => ({ reads, writes }), select: (value: string | null) => { selected = value; } };
}
test('recorded projection checks exact bytes and sink CAS, then duplicates without reading current head', async () => {
  const f = fixture();
  assert.deepEqual(await reconcileRecordedBrief(f.reader, scope, observation, f.sink), { status: 'observed', revision, outcome: 'applied' });
  assert.equal((await reconcileRecordedBrief(f.reader, scope, observation, f.sink)).outcome, 'duplicate');
  assert.deepEqual(f.counts(), { reads: 2, writes: 2 });
});
test('a different selected revision is never replaced or interpreted as ordered by its SHA', async () => {
  for (const selected of ['0'.repeat(40), 'f'.repeat(40)]) {
    const f = fixture(); f.select(selected);
    assert.deepEqual(await reconcileRecordedBrief(f.reader, scope, observation, f.sink), { status: 'different-revision', revision, outcome: null });
    assert.deepEqual(f.counts(), { reads: 0, writes: 0 });
  }
});
test('reader binding is captured before awaiting the selected revision', async () => {
  const f = fixture(), current = f.sink.currentRevision, read = f.reader.readArtifact;
  f.sink.currentRevision = async (...args) => {
    const selected = await current(...args);
    f.binding.repositoryId = 2;
    return selected;
  };
  f.reader.readArtifact = async (...args) => ({ ...await read(...args), repositoryId: 2 });
  await assert.rejects(reconcileRecordedBrief(f.reader, scope, observation, f.sink));
  assert.equal(f.counts().writes, 0);
});
test('foreign scope, unconfigured paths, gate claims and noncommitted observations stop before source I/O', async () => {
  for (const [configured, observed] of [[{ ...scope, organizationId: 'foreign' }, observation], [{ ...scope, repository: 'github:2' }, observation],
    [{ ...scope, branch: 'other' }, observation], [{ ...scope, paths: ['items/0158-other/BRIEF.md'] }, observation],
    [scope, { ...observation, gateSigned: true }], [scope, { ...observation, result: { ...result, outcome: 'unknown' } }],
    [scope, { ...observation, result: { ...result, repository: 'github:2' } }]]) {
    const f = fixture(); await assert.rejects(reconcileRecordedBrief(f.reader, configured, observed, f.sink)); assert.deepEqual(f.counts(), { reads: 0, writes: 0 });
  }
});
test('tampered bytes, hashes, source identity, revisions and oversized content cannot reach ingestion', async () => {
  for (const patch of [{ content: 'altered' }, { contentDigest: 'f'.repeat(64) }, { blobSha: 'f'.repeat(40) },
    { revision: 'f'.repeat(40) }, { organizationId: 'foreign' }, { repositoryId: 2 }, { path: 'items/0158-other/BRIEF.md' },
    { content: 'a'.repeat(32769) }, { content: '\ud800' }]) {
    const f = fixture(), read = f.reader.readArtifact; f.reader.readArtifact = async (...args) => ({ ...await read(...args), ...patch });
    await assert.rejects(reconcileRecordedBrief(f.reader, scope, observation, f.sink)); assert.equal(f.counts().writes, 0);
  }
});
test('aborted/failed source work never starts a late sink write; post-ingest cancellation is not rollback', async () => {
  const f = fixture(), abort = new AbortController(); abort.abort();
  await assert.rejects(reconcileRecordedBrief(f.reader, scope, observation, f.sink, abort.signal)); assert.deepEqual(f.counts(), { reads: 0, writes: 0 });
  const late = fixture(), controller = new AbortController(), read = late.reader.readArtifact;
  late.reader.readArtifact = async (...args) => { const value = await read(...args); controller.abort(); return value; };
  await assert.rejects(reconcileRecordedBrief(late.reader, scope, observation, late.sink, controller.signal)); assert.equal(late.counts().writes, 0);
  const after = fixture(), afterController = new AbortController(), ingest = after.sink.ingest;
  after.sink.ingest = async (...args) => { const value = await ingest(...args); afterController.abort(); return value; };
  await assert.rejects(reconcileRecordedBrief(after.reader, scope, observation, after.sink, afterController.signal)); assert.equal(after.counts().writes, 1);
  const failed = fixture(); failed.sink.ingest = async () => { throw new Error('CAS changed'); };
  await assert.rejects(reconcileRecordedBrief(failed.reader, scope, observation, failed.sink), /CAS changed/);
});
