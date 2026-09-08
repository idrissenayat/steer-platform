import assert from 'node:assert/strict';
import test from 'node:test';
import { createIntentDevelopmentReader } from '../src/intent-development-reader.ts';
const config = { organizationId: 'org', subject: 'human', productId: 'product', repository: 'github:52', branch: 'codex/synthetic', configurationRevision: 'r1', recordsPolicyDigest: 'a'.repeat(64) };
const input = { organizationId: config.organizationId, productId: config.productId, repository: config.repository,
  operationId: '00000000-0000-4000-8000-000000000227', inputDigest: 'b'.repeat(64) };
const base = { authorizeOperation: async () => {}, authorizeDraft: async () => {}, keyForDraft: async () => { throw new Error('must not read key'); } };
const records = { authorize: async () => {}, originals: { ...base, authorize: async () => {}, authorizeOriginal: async () => {} }, results: { ...base, authorizeResult: async () => {} } };
test('development reader is lazy and exact scoped; denial, absent verification and closed scope create no SQL or effects', async () => {
  let calls = 0; const pool = { connect: async () => { calls++; throw new Error('must not connect'); } };
  const deps = { records, exchange: { verify: async () => { calls++; throw new Error('must not verify'); } } };
  const reader = createIntentDevelopmentReader({ drafts: pool, execution: pool }, config, deps);
  assert.deepEqual(Object.keys(reader), ['scope', 'read', 'close']); assert.equal(calls, 0);
  for (const key of ['organizationId', 'productId', 'repository']) await assert.rejects(reader.read({ ...input, [key]: 'other' }, async () => {}));
  await assert.rejects(reader.read(input, async () => { throw new Error('private identity denial'); }), { message: 'Development read is unavailable.' });
  reader.close(); await assert.rejects(reader.read(input, async () => {})); assert.equal(calls, 0);
  assert.throws(() => createIntentDevelopmentReader({ drafts: pool, execution: pool }, config, { ...deps, exchange: {} } as never));
});
test('timed-out current authority retains bounded admission until it drains; closing cannot start late SQL', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let release!: () => void, checks = 0, sql = 0;
  const held = new Promise<void>(resolve => { release = resolve; }), pool = { connect: async () => { sql++; throw new Error(); } };
  const reader = createIntentDevelopmentReader({ drafts: pool, execution: pool }, config, { records, exchange: { verify: async () => {} } });
  const tasks = Array.from({ length: 4 }, () => reader.read(input, async () => { checks++; await held; }));
  const rejections = tasks.map(task => assert.rejects(task)); await Promise.resolve(); await Promise.resolve();
  t.mock.timers.tick(30001); await Promise.all(rejections);
  await assert.rejects(reader.read(input, async () => { checks++; })); assert.equal(checks, 4); assert.equal(sql, 0);
  reader.close(); release(); await new Promise(resolve => setImmediate(resolve)); assert.equal(sql, 0);
});
