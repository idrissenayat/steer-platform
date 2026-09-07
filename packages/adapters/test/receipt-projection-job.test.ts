import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createRecordedBriefProjectionJob } from '../src/code-host/projection-job.ts';
import type { ArtifactReader } from '../src/code-host/github.ts';
import type { ProjectionOutcome } from '../src/code-host/reconcile.ts';

const content = '# Recorded synthetic Brief\n', revision = 'a'.repeat(40), path = 'items/0159-fixture/BRIEF.md';
const contentDigest = createHash('sha256').update(content).digest('hex');
const blobSha = createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex');
const scope = { organizationId: 'org', repository: 'github:1', branch: 'main', paths: [path] };
const principal = { subject: 'projector', organizationId: 'org', type: 'agent', hats: [], toolGrants: ['projection.ingest'], expiresAt: new Date(Date.now() + 600000).toISOString() };
const observation = { gateSigned: false, result: { outcome: 'committed', organizationId: 'org', repository: 'github:1', branch: 'main', path,
  subject: 'human', idempotencyKey: '15900000-0000-4000-8000-000000000001', expectedHead: 'b'.repeat(40), revision, contentDigest, blobSha, requestDigest: 'c'.repeat(64) } };
function fixture() {
  let reads = 0, writes = 0, receipts = 0, closes = 0, checks = 0, selected: string | null = null;
  let identity: unknown = principal;
  const binding = { organizationId: 'org', repositoryId: 1, installationId: 1, owner: 'fixture', repository: 'fixture', branch: 'main' };
  const reader: ArtifactReader = { binding, readHead: async () => { throw new Error('No HEAD substitution'); },
    readArtifact: async () => { reads++; return { organizationId: 'org', repositoryId: 1, path, revision, content, contentDigest, blobSha }; } };
  const dependencies = {
    authenticate: async () => { checks++; return identity; },
    readReceipt: async (): Promise<unknown> => { receipts++; return observation; },
    // Intentionally ignores the current-identity callback: the job must guard it.
    sink: () => ({ currentRevision: async () => selected,
      ingest: async (_snapshot: unknown, expected: string | null): Promise<ProjectionOutcome> => {
        assert.equal(expected, selected); writes++; const outcome = selected === revision ? 'duplicate' : 'applied'; selected = revision; return outcome;
      } }),
    shutdownResources: async () => { closes++; },
  };
  return { reader, binding, dependencies, counts: () => ({ reads, writes, receipts, closes, checks }),
    identify: (next: unknown) => { identity = next; }, select: (next: string) => { selected = next; } };
}
test('owned receipt job rechecks its projector, reads only recorded bytes and preserves a different selection', async () => {
  const f = fixture(), job = createRecordedBriefProjectionJob(f.reader, scope, f.dependencies);
  assert.deepEqual(await job.runOnce(), { status: 'observed', revision, outcome: 'applied' });
  assert.ok(f.counts().checks >= 5); assert.equal((await job.runOnce()).outcome, 'duplicate');
  f.select('f'.repeat(40)); const before = f.counts();
  assert.deepEqual(await job.runOnce(), { status: 'different-revision', revision, outcome: null });
  assert.equal(f.counts().reads, before.reads); assert.equal(f.counts().writes, before.writes);
  await job.shutdown(); assert.equal(f.counts().closes, 1); await assert.rejects(job.runOnce());
});
test('invalid projectors and foreign configuration cannot invoke receipt readback', async () => {
  for (const identity of [null, { ...principal, type: 'human' }, { ...principal, organizationId: 'foreign' },
    { ...principal, hats: ['product-lead'] }, { ...principal, toolGrants: [] }, { ...principal, expiresAt: new Date(0).toISOString() }]) {
    const f = fixture(); f.identify(identity); const job = createRecordedBriefProjectionJob(f.reader, scope, f.dependencies);
    await assert.rejects(job.runOnce(), /not authorized/); assert.equal(f.counts().receipts, 0); await job.shutdown();
  }
  const f = fixture();
  for (const patch of [{ organizationId: 'foreign' }, { repository: 'github:2' }, { branch: 'other' }]) {
    assert.throws(() => createRecordedBriefProjectionJob(f.reader, { ...scope, ...patch }, f.dependencies));
  }
  assert.equal(f.counts().checks, 0);
});
test('receipt/source failures and revoked or substituted projectors never enter the sink', async () => {
  for (const identity of [null, { ...principal, subject: 'other-projector' }]) {
    const f = fixture(), readReceipt = f.dependencies.readReceipt;
    f.dependencies.readReceipt = async () => { const value = await readReceipt(); f.identify(identity); return value; };
    const job = createRecordedBriefProjectionJob(f.reader, scope, f.dependencies);
    await assert.rejects(job.runOnce()); assert.equal(f.counts().reads, 0); assert.equal(f.counts().writes, 0); await job.shutdown();
  }
  const f = fixture(), read = f.reader.readArtifact;
  f.reader.readArtifact = async (...args) => { const value = await read(...args); f.identify(null); return value; };
  const job = createRecordedBriefProjectionJob(f.reader, scope, f.dependencies);
  await assert.rejects(job.runOnce()); assert.equal(f.counts().writes, 0); await job.shutdown();
  for (const failure of ['throw', 'malformed']) {
    const failed = fixture(); failed.dependencies.readReceipt = async () => { if (failure === 'throw') throw new Error('Readback unavailable'); return { gateSigned: true }; };
    const held = createRecordedBriefProjectionJob(failed.reader, scope, failed.dependencies);
    await assert.rejects(held.runOnce()); assert.equal(failed.counts().reads, 0); assert.equal(failed.counts().writes, 0); await held.shutdown();
  }
});
test('shutdown drains actual receipt work, closes once and prevents late reads or automatic retries', async () => {
  const f = fixture(); let enter!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { enter = resolve; });
  f.dependencies.readReceipt = async () => { enter(); await new Promise<void>(resolve => { release = resolve; }); return observation; };
  const job = createRecordedBriefProjectionJob(f.reader, scope, f.dependencies), run = job.runOnce(), rejected = assert.rejects(run);
  await started; await assert.rejects(job.runOnce(), /not accepting/);
  const stopped = job.shutdown(); assert.equal(stopped, job.shutdown()); await Promise.resolve(); assert.equal(f.counts().closes, 0);
  release(); await rejected; await stopped;
  assert.equal(f.counts().reads, 0); assert.equal(f.counts().writes, 0); assert.equal(f.counts().closes, 1);
  assert.deepEqual(job.status(), { stopping: true, active: false }); await assert.rejects(job.runOnce());
});
test('post-ingest revocation is failure without rollback or retry; shutdown failures remain closed', async () => {
  const f = fixture(), sink = f.dependencies.sink;
  f.dependencies.sink = () => { const original = sink(); return { ...original, ingest: async (...args) => {
    const value = await original.ingest(...args); f.identify(null); return value;
  } }; };
  const job = createRecordedBriefProjectionJob(f.reader, scope, f.dependencies);
  await assert.rejects(job.runOnce()); assert.equal(f.counts().writes, 1); await job.shutdown();
  const broken = fixture(); let closes = 0;
  broken.dependencies.shutdownResources = async () => { closes++; throw new Error('Private detail'); };
  const held = createRecordedBriefProjectionJob(broken.reader, scope, broken.dependencies), stopped = held.shutdown();
  await assert.rejects(stopped, /^Error: Projection resource shutdown failed\.$/); assert.equal(stopped, held.shutdown());
  assert.equal(closes, 1); await assert.rejects(held.runOnce());
});
test('scope and reader binding are copied before asynchronous readback can mutate caller inputs', async () => {
  const f = fixture(), configured = { ...scope, paths: [...scope.paths] };
  const job = createRecordedBriefProjectionJob(f.reader, configured, f.dependencies);
  configured.organizationId = 'foreign'; configured.paths.length = 0; f.binding.organizationId = 'foreign';
  assert.equal((await job.runOnce()).outcome, 'applied'); await job.shutdown();
});
