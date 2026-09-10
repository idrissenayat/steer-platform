import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createIntentDevelopmentStarter } from '../src/intent-development-starter.ts';
const config = { organizationId: 'org', subject: 'human', productId: 'product', repository: 'github:52', branch: 'codex/synthetic', configurationRevision: 'r1', recordsPolicyDigest: 'a'.repeat(64) };
const input = { organizationId: config.organizationId, productId: config.productId, repository: config.repository,
  operationId: randomUUID(), inputDigest: 'b'.repeat(64), draftId: randomUUID(), revision: 1, revisionDigest: 'c'.repeat(64) };
const records = { authorize: async () => {}, authorizeOperation: async () => {}, authorizeOriginal: async () => {}, authorizeDraft: async () => {}, keyForDraft: async () => { throw new Error('no key'); } };
test('starter is lazy, exact scoped and default-closed without current records/execution authority', async () => {
  let calls = 0; const pool = { connect: async () => { calls++; throw new Error(); } };
  const deps = { records, authorizeStart: async () => {}, scheduler: { start: async () => { calls++; throw new Error(); } } };
  const service = createIntentDevelopmentStarter({ drafts: pool, execution: pool }, config, deps);
  for (const k of ['organizationId', 'productId', 'repository']) await assert.rejects(service.start({ ...input, [k]: 'other' }, async () => {}));
  await assert.rejects(service.start(input, async () => { throw new Error(); })); service.close();
  await assert.rejects(service.start(input, async () => {})); assert.equal(calls, 0);
  assert.throws(() => createIntentDevelopmentStarter({ drafts: pool, execution: pool }, config, { ...deps, authorizeStart: undefined } as never));
});
test('timed-out starter keeps bounded admission until authority drains and never schedules late work after close', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); let release!: () => void, calls = 0;
  const held = new Promise<void>(r => { release = r; }), pool = { connect: async () => { calls++; throw new Error(); } };
  const service = createIntentDevelopmentStarter({ drafts: pool, execution: pool }, config, { records, authorizeStart: async () => {}, scheduler: { start: async () => { calls++; } } });
  const pending = Array.from({ length: 4 }, () => assert.rejects(service.start(input, () => held)));
  await Promise.resolve(); await Promise.resolve(); t.mock.timers.tick(30001); await Promise.all(pending);
  await assert.rejects(service.start(input, async () => {})); service.close(); release();
  await new Promise(resolve => setImmediate(resolve)); assert.equal(calls, 0);
});

test('drafting start rejects malformed or replaced original-read phases before storage or scheduling', async () => {
  let sql = 0, scheduled = 0;
  const pool = { connect: async () => { sql++; throw new Error(); } }, base = { records, authorizeStart: async () => {},
    scheduler: { start: async () => { scheduled++; } } };
  assert.throws(() => createIntentDevelopmentStarter({ drafts: pool, execution: pool }, config, { ...base, withOriginalRead: true } as never));
  for (const withOriginalRead of [async () => {}, async (_input: unknown, _current: unknown, work: any) => { await work(async () => ({})).catch(() => {}); },
    async () => true as never]) {
    const service = createIntentDevelopmentStarter({ drafts: pool, execution: pool }, config, { ...base, withOriginalRead });
    try { await assert.rejects(service.start(input, async () => {})); } finally { service.close(); }
  }
  const deps = { ...base, withOriginalRead: async () => {} }, service = createIntentDevelopmentStarter({ drafts: pool, execution: pool }, config, deps);
  try { await assert.rejects(service.start(input, async () => { deps.withOriginalRead = async () => {}; })); }
  finally { service.close(); }
  assert.equal(sql, 0); assert.equal(scheduled, 0);
});
