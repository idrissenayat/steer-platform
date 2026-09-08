import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createIntentScopeStarter } from '../src/intent-scope-starter.ts';
const config = { organizationId: 'org', subject: 'human', productId: 'product', repository: 'github:52', branch: 'codex/synthetic', configurationRevision: 'r1', recordsPolicyDigest: 'a'.repeat(64) };
const input = { organizationId: config.organizationId, productId: config.productId, repository: config.repository,
  reviewId: randomUUID(), preparationDigest: 'b'.repeat(64), draftId: randomUUID(), revision: 1, revisionDigest: 'c'.repeat(64) };
const records = { authorize: async () => {}, authorizeReview: async () => {}, authorizeOriginal: async () => {}, authorizeDraft: async () => {}, keyForDraft: async () => { throw new Error('no key'); } };
test('starter is lazy, exact scoped and default-closed without current records/execution authority', async () => {
  let calls = 0; const pool = { connect: async () => { calls++; throw new Error(); } };
  const deps = { records, authorizeStart: async () => {}, scheduler: { start: async () => { calls++; throw new Error(); } } };
  const service = createIntentScopeStarter({ drafts: pool, execution: pool }, config, deps);
  for (const k of ['organizationId', 'productId', 'repository']) await assert.rejects(service.start({ ...input, [k]: 'other' }, async () => {}));
  await assert.rejects(service.start(input, async () => { throw new Error(); })); service.close();
  await assert.rejects(service.start(input, async () => {})); assert.equal(calls, 0);
  assert.throws(() => createIntentScopeStarter({ drafts: pool, execution: pool }, config, { ...deps, authorizeStart: undefined } as never));
});
test('timed-out starter keeps bounded admission until authority drains and never schedules late work after close', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); let release!: () => void, calls = 0;
  const held = new Promise<void>(r => { release = r; }), pool = { connect: async () => { calls++; throw new Error(); } };
  const service = createIntentScopeStarter({ drafts: pool, execution: pool }, config, { records, authorizeStart: async () => {}, scheduler: { start: async () => { calls++; } } });
  const pending = Array.from({ length: 4 }, () => assert.rejects(service.start(input, () => held)));
  await Promise.resolve(); await Promise.resolve(); t.mock.timers.tick(30001); await Promise.all(pending);
  await assert.rejects(service.start(input, async () => {})); service.close(); release();
  await new Promise(resolve => setImmediate(resolve)); assert.equal(calls, 0);
});
