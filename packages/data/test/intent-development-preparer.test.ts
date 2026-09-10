import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createIntentDevelopmentPreparer } from '../src/intent-development-preparer.ts';
const base = { organizationId: 'org', subject: 'human', productId: 'product', repository: 'github:52', branch: 'codex/synthetic', configurationRevision: 'r1', recordsPolicyDigest: 'a'.repeat(64) };
const config = { ...base, action: 'develop', expiresAt: new Date(Date.now() + 60000).toISOString(), budget: { organizationId: 'org', subject: 'human', configurationRevision: 'r1', budgetId: randomUUID(), approvalDigest: 'b'.repeat(64), capMicrousd: 5, architectMicrousd: 3, testAgentMicrousd: 2 } };
const profile = { configurationRevision: 'p1', runtimeRevision: 'synthetic', modelRoute: 'synthetic', maxOutputTokens: 1000, instructions: 'Synthetic only' }, profiles = { architect: profile, testAgent: profile };
const input = { organizationId: 'org', productId: 'product', repository: 'github:52', configurationRevision: 'r1', draftId: randomUUID(), revision: 1,
  revisionDigest: 'c'.repeat(64), scopeInputDigest: 'd'.repeat(64), sourceSnapshotDigest: 'e'.repeat(64), choice: { action: 'new-distinct' as const, reason: 'User direction' } };
const records = { authorize: async () => {}, authorizeOriginal: async () => {}, authorizeOperation: async () => {}, authorizeDraft: async () => {}, keyForDraft: async () => { throw new Error('No key'); } };
test('preparer is lazy and denies absent evidence/admission authority, foreign scope and closed calls before SQL', async () => {
  let calls = 0; const pool = { connect: async () => { calls++; throw new Error(); } };
  const deps = { records, evidenceFor: async () => { calls++; throw new Error(); }, authorizePreparation: async () => {} };
  const service = createIntentDevelopmentPreparer({ drafts: pool, execution: pool }, config, profiles, deps);
  for (const key of ['organizationId', 'productId', 'repository', 'configurationRevision']) await assert.rejects(service.prepare({ ...input, [key]: 'other' }, async () => {}));
  assert.equal((await service.prepare(input, async () => { throw new Error(); })).outcome, 'unavailable');
  service.close(); await assert.rejects(service.prepare(input, async () => {})); assert.equal(calls, 0);
  assert.throws(() => createIntentDevelopmentPreparer({ drafts: pool, execution: pool }, config, profiles, { ...deps, evidenceFor: undefined } as never));
  assert.throws(() => createIntentDevelopmentPreparer({ drafts: pool, execution: pool }, config, profiles, { ...deps, withEvidenceRead: true } as never));
});

test('replacing the installed evidence hook during a current check denies before SQL', async () => {
  let calls = 0; const pool = { connect: async () => { calls++; throw new Error(); } };
  const deps = { records, evidenceFor: async () => {}, authorizePreparation: async () => {}, withEvidenceRead: async () => {} };
  const service = createIntentDevelopmentPreparer({ drafts: pool, execution: pool }, config, profiles, deps);
  try {
    assert.equal((await service.prepare(input, async () => { deps.withEvidenceRead = async () => {}; })).outcome, 'unavailable');
    assert.equal(calls, 0);
  } finally { service.close(); }
});
test('timed-out preparation keeps its admission until dependencies drain and close blocks late storage', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); let release!: () => void, calls = 0;
  const held = new Promise<void>(r => { release = r; }), pool = { connect: async () => { calls++; throw new Error(); } };
  const service = createIntentDevelopmentPreparer({ drafts: pool, execution: pool }, config, profiles, { records, evidenceFor: async () => {}, authorizePreparation: async () => {} });
  const pending = Array.from({ length: 4 }, () => service.prepare(input, () => held));
  await Promise.resolve(); await Promise.resolve(); t.mock.timers.tick(30001);
  assert.ok((await Promise.all(pending)).every(r => r.outcome === 'unavailable'));
  await assert.rejects(service.prepare(input, async () => {})); service.close(); release(); await new Promise(resolve => setImmediate(resolve)); assert.equal(calls, 0);
});

test('development preparation freshly checks each draft policy and caller before SQL and denies policy-time changes', async () => {
  for (const mode of ['valid', 'revoked', 'nonvoid', 'rejected', 'closed']) {
    const events: string[] = []; let revoked = false; let service: ReturnType<typeof createIntentDevelopmentPreparer>;
    const pool = { connect: async () => { events.push('sql'); throw new Error(); } };
    const policies = { ...records, authorizeDraft: async () => {
      events.push('policy'); if (mode === 'revoked') revoked = true; if (mode === 'closed') service.close();
      if (mode === 'rejected') throw new Error(); if (mode === 'nonvoid') return true as never;
    } };
    service = createIntentDevelopmentPreparer({ drafts: pool, execution: pool }, config, profiles,
      { records: policies, evidenceFor: async () => { throw new Error(); }, authorizePreparation: async () => {} });
    const current = async () => { events.push('caller'); if (revoked) throw new Error(); };
    try {
      assert.equal((await service.prepare(input, current)).outcome, 'unavailable');
      assert.deepEqual(events, mode === 'valid' ? ['caller', 'policy', 'caller', 'sql'] : mode === 'revoked' ? ['caller', 'policy', 'caller'] : ['caller', 'policy']);
      if (mode === 'valid') { events.length = 0; await service.prepare(input, current); assert.deepEqual(events, ['caller', 'policy', 'caller', 'sql']); }
    } finally { service.close(); }
  }
});

test('development preparation retains held metadata policies beyond storage timeout without late SQL', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); let release!: () => void, policies = 0, sql = 0;
  const held = new Promise<void>(r => { release = r; }), pool = { connect: async () => { sql++; throw new Error(); } };
  const service = createIntentDevelopmentPreparer({ drafts: pool, execution: pool }, config, profiles,
    { records: { ...records, authorizeDraft: async () => { policies++; await held; } }, evidenceFor: async () => {}, authorizePreparation: async () => {} });
  const pending = Array.from({ length: 4 }, () => service.prepare(input, async () => {})); await new Promise(r => setImmediate(r)); assert.equal(policies, 4);
  t.mock.timers.tick(5001); assert.ok((await Promise.all(pending)).every(r => r.outcome === 'unavailable'));
  await assert.rejects(service.prepare(input, async () => {})); service.close(); release(); await new Promise(r => setImmediate(r)); assert.equal(sql, 0);
});
