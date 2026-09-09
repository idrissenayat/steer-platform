import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { createCandidatePublicationRecorder } from '../src/candidate-publication-recorder.ts';
import type { CandidateSaveStatusOutput } from '@steer/tool-registry/candidate-save-status-contracts';

function fixture() {
  const configuration = { organizationId: 'synthetic-org', subject: 'synthetic-human', productId: 'product', repository: 'github:52',
    branch: 'codex/fixture', configurationRevision: 'synthetic-r1', recordsPolicyDigest: 'a'.repeat(64) };
  const input = { organizationId: configuration.organizationId, productId: configuration.productId, repository: configuration.repository,
    branch: configuration.branch, draftId: randomUUID(), draftRevision: 1, operationId: randomUUID(), inputDigest: 'b'.repeat(64) };
  const receipt: Extract<CandidateSaveStatusOutput, { outcome: 'committed' }> = { ...input, kind: 'steer-candidate-save-status/v1',
    outcome: 'committed', saveVerified: true, retryAuthorized: false, executionAuthorized: false, gateSigned: false,
    reference: { organizationId: input.organizationId, productId: input.productId, repository: input.repository, branch: input.branch,
      itemId: '0270-synthetic', bundleId: randomUUID(), revision: 'c'.repeat(40), manifestDigest: 'd'.repeat(64) },
    expectedHead: 'e'.repeat(40), pointerDigest: 'f'.repeat(64), confirmationDigest: 'a'.repeat(64) };
  const proof = { configuration, input, reference: receipt.reference, confirmationDigest: receipt.confirmationDigest,
    publishedAt: '2026-09-09T00:00:00.000Z' };
  const calls = { status: 0, clock: 0, sql: 0, authority: 0 };
  const pool = { connect: async () => { calls.sql++; throw new Error('PRIVATE no SQL in unit fixture'); } };
  const deps: Parameters<typeof createCandidatePublicationRecorder>[2] = {
    status: { scope: { organizationId: input.organizationId, subject: configuration.subject, productId: input.productId,
      repository: input.repository, branch: input.branch, itemIds: [receipt.reference.itemId] },
      read: async () => { calls.status++; return receipt; } },
    authorizeRecord: async () => { calls.authority++; },
    verifyPublicationClock: async context => {
      calls.clock++; assert.deepEqual(context, { configuration, input, receipt }); return proof;
    },
  };
  return { configuration, input, receipt, proof, calls, pool, deps,
    make: () => createCandidatePublicationRecorder(pool, configuration, deps) };
}
const current = async () => {};
test('publication recorder requires separate current records/clock ports and a matching status scope', () => {
  for (const port of ['authorizeRecord', 'verifyPublicationClock'] as const) {
    const f = fixture(); (f.deps as any)[port] = undefined; assert.throws(f.make); assert.equal(f.calls.sql, 0);
  }
  const f = fixture(); f.deps.status = { ...f.deps.status, scope: { ...f.deps.status.scope, subject: 'foreign' } };
  assert.throws(f.make); assert.equal(f.calls.sql, 0);
});
test('reference-only publication input rejects supplied time, receipt, foreign home and malformed IDs before authority or I/O', async () => {
  const f = fixture(), service = f.make();
  for (const patch of [{ publishedAt: f.proof.publishedAt }, { receipt: f.receipt }, { organizationId: 'foreign' }, { draftId: 'bad' }])
    assert.deepEqual(await service.record({ ...f.input, ...patch }, current), { outcome: 'unavailable' });
  assert.deepEqual(f.calls, { status: 0, clock: 0, sql: 0, authority: 0 }); service.close();
});
test('unverified status never becomes a publication clock or records mutation', async () => {
  for (const outcome of ['unknown', 'conflict', 'not-found'] as const) {
    const f = fixture(); f.deps.status.read = async () => ({ ...f.input, kind: 'steer-candidate-save-status/v1', outcome,
      saveVerified: false, retryAuthorized: false, executionAuthorized: false, gateSigned: false,
      ...(outcome === 'not-found' ? { observedHead: 'a'.repeat(40) } : {}) });
    const service = f.make(); assert.equal((await service.record(f.input, current)).outcome, 'unavailable');
    assert.equal(f.calls.clock, 0); assert.equal(f.calls.sql, 0); service.close();
  }
});
test('clock must bind exact owner/configuration, original input, saved commit, manifest and confirmation', async () => {
  for (const patch of [
    { configuration: { subject: 'foreign' } }, { configuration: { configurationRevision: 'other' } }, { configuration: { recordsPolicyDigest: 'b'.repeat(64) } },
    { input: { draftRevision: 2 } }, { input: { operationId: randomUUID() } }, { reference: { revision: 'f'.repeat(40) } },
    { reference: { manifestDigest: 'f'.repeat(64) } }, { confirmationDigest: 'f'.repeat(64) }, { publishedAt: 'invalid' },
  ]) {
    const f = fixture(); f.deps.verifyPublicationClock = async () => ({ ...f.proof, ...patch,
      ...(patch.configuration ? { configuration: { ...f.configuration, ...patch.configuration } } : {}),
      ...(patch.input ? { input: { ...f.input, ...patch.input } } : {}),
      ...(patch.reference ? { reference: { ...f.receipt.reference, ...patch.reference } } : {}),
    });
    const service = f.make(); assert.equal((await service.record(f.input, current)).outcome, 'unavailable'); assert.equal(f.calls.sql, 0); service.close();
  }
});
test('changed receipt, clock or allowed scope is rejected before lifecycle SQL', async () => {
  for (const mode of ['receipt', 'clock', 'scope', 'item'] as const) {
    const f = fixture();
    if (mode === 'receipt') f.deps.status.read = async () => ({ ...f.receipt, pointerDigest: ++f.calls.status === 1 ? f.receipt.pointerDigest : 'a'.repeat(64) });
    if (mode === 'clock') f.deps.verifyPublicationClock = async () => ({ ...f.proof, publishedAt: ++f.calls.clock === 1 ? f.proof.publishedAt : '2026-09-09T00:00:00.001Z' });
    if (mode === 'item') f.deps.status.read = async () => ({ ...f.receipt, reference: { ...f.receipt.reference, itemId: '0270-foreign' } });
    const service = f.make();
    if (mode === 'scope') f.deps.status = { ...f.deps.status, scope: { ...f.deps.status.scope, itemIds: ['0270-foreign'] } };
    assert.equal((await service.record(f.input, current)).outcome, 'unavailable'); assert.equal(f.calls.sql, 0); service.close();
  }
});
test('both independent receipt and clock observations precede lifecycle connection; no false success on SQL failure', async () => {
  const f = fixture(), service = f.make();
  assert.deepEqual(await service.record(f.input, current), { outcome: 'unavailable' });
  assert.equal(f.calls.status, 2); assert.equal(f.calls.clock, 2); assert.equal(f.calls.sql, 1); service.close();
});
test('current grant loss and malformed authority returns prevent publication and sanitize failure', async () => {
  for (const mode of ['current', 'authority', 'return', 'late'] as const) {
    const f = fixture();
    if (mode === 'authority') f.deps.authorizeRecord = async () => { throw new Error('PRIVATE'); };
    if (mode === 'return') f.deps.authorizeRecord = async () => true as any;
    if (mode === 'late') f.deps.verifyPublicationClock = async () => { f.deps.authorizeRecord = async () => { throw new Error('PRIVATE'); }; return f.proof; };
    const service = f.make(), result = await service.record(f.input, mode === 'current' ? async () => { throw new Error('PRIVATE'); } : current);
    assert.deepEqual(result, { outcome: 'unavailable' }); assert.equal(f.calls.sql, 0); service.close();
  }
});
test('timed-out clock retains the single admission until its dependency drains; closure prevents late SQL', async t => {
  const f = fixture(); let release!: () => void, entered!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
  f.deps.verifyPublicationClock = async () => { f.calls.clock++; entered(); await held; return f.proof; };
  t.mock.timers.enable({ apis: ['setTimeout'] }); const service = f.make(), first = service.record(f.input, current);
  await started; t.mock.timers.tick(5001); assert.deepEqual(await first, { outcome: 'unavailable' });
  assert.deepEqual(await service.record(f.input, current), { outcome: 'unavailable' }); assert.equal(f.calls.clock, 1);
  service.close(); release(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.calls.sql, 0); assert.equal((await service.record(f.input, current)).outcome, 'unavailable');
});
test('overall receipt timeout holds admission through late completion without touching SQL or clock', async t => {
  const f = fixture(); let release!: () => void, entered!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
  f.deps.status.read = async () => { f.calls.status++; entered(); await held; return f.receipt; };
  t.mock.timers.enable({ apis: ['setTimeout'] }); const service = f.make(), first = service.record(f.input, current);
  await started; t.mock.timers.tick(90001); assert.deepEqual(await first, { outcome: 'unavailable' });
  assert.equal((await service.record(f.input, current)).outcome, 'unavailable'); assert.equal(f.calls.status, 1);
  release(); await new Promise(resolve => setImmediate(resolve)); service.close();
  assert.equal(f.calls.sql, 0); assert.equal(f.calls.clock, 0);
});
test('the prefetched publication proof cannot age past five seconds before lifecycle SQL', async t => {
  let monotonic = 100;
  t.mock.method(performance, 'now', () => monotonic);
  for (const authorization of [5, 6]) {
    const f = fixture();
    f.deps.authorizeRecord = async () => { if (++f.calls.authority === authorization) monotonic += 5001; };
    const service = f.make(); assert.equal((await service.record(f.input, current)).outcome, 'unavailable');
    assert.equal(f.calls.status, 2); assert.equal(f.calls.clock, 2); assert.equal(f.calls.sql, 0); service.close();
  }
});
test('a late pool connection is destroyed after lifecycle timeout and cannot release admission early', async t => {
  const f = fixture(); let release!: (client: PoolClient) => void, entered!: () => void, destroyed = 0;
  const held = new Promise<PoolClient>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
  const service = createCandidatePublicationRecorder({ connect: async () => { f.calls.sql++; entered(); return held; } }, f.configuration, f.deps);
  t.mock.timers.enable({ apis: ['setTimeout'] }); const first = service.record(f.input, current);
  await started; t.mock.timers.tick(5001); assert.equal((await first).outcome, 'unavailable');
  assert.equal((await service.record(f.input, current)).outcome, 'unavailable'); assert.equal(f.calls.sql, 1);
  release({ release(broken: boolean) { assert.equal(broken, true); destroyed++; }, query: async () => assert.fail('No late SQL') } as unknown as PoolClient);
  await new Promise(resolve => setImmediate(resolve)); assert.equal(destroyed, 1); service.close();
});
