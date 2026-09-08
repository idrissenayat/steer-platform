import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createIntentDraftService } from '../src/intent-draft-service.ts';
const config = { organizationId: 'org', subject: 'human', productId: 'product', repository: 'github:52', branch: 'codex/synthetic',
  configurationRevision: 'r1', recordsPolicyDigest: 'a'.repeat(64) };
const scope = { organizationId: config.organizationId, productId: config.productId, repository: config.repository };
test('draft API service is lazy, owner-bound and cannot bypass denied records authority or a closed service', async () => {
  let connections = 0, keys = 0;
  const service = createIntentDraftService({ connect: async () => { connections++; throw new Error(); } }, config, {
    lifecycle: { authorize: async () => { throw new Error('private-records-denial'); } },
    revisions: { authorize: async () => { throw new Error('private-records-denial'); }, keyForDraft: async () => { keys++; throw new Error(); } },
  });
  assert.deepEqual(service.scope, { ...scope, subject: 'human' }); assert.equal(connections, 0);
  assert.equal((await service.create({ ...scope, requestId: randomUUID() }, async () => {} ) as { outcome: string }).outcome, 'unavailable');
  await assert.rejects(service.read({ ...scope, draftId: randomUUID(), revision: 'latest' }, async () => {}));
  await assert.rejects(service.create({ ...scope, productId: 'other', requestId: randomUUID() }, async () => {}));
  service.close(); await assert.rejects(service.create({ ...scope, requestId: randomUUID() }, async () => {})); assert.equal(connections, 0); assert.equal(keys, 0);
});
test('draft service deadlines retain four-call admission while stalled identity checks drain and close blocks late SQL', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let connections = 0, checks = 0; const releases: Array<() => void> = [];
  const service = createIntentDraftService({ connect: async () => { connections++; throw new Error(); } }, config, {
    lifecycle: { authorize: async () => { throw new Error(); } }, revisions: { authorize: async () => { throw new Error(); }, keyForDraft: async () => { throw new Error(); } },
  });
  const stalled = async () => { checks++; await new Promise<void>(resolve => { releases.push(resolve); }); };
  const calls = Array.from({ length: 4 }, () => service.create({ ...scope, requestId: randomUUID() }, stalled));
  await new Promise(resolve => setImmediate(resolve)); assert.equal(checks, 4);
  assert.equal((await service.create({ ...scope, requestId: randomUUID() }, stalled) as { outcome: string }).outcome, 'unknown'); assert.equal(checks, 4);
  t.mock.timers.tick(30000); assert.ok((await Promise.all(calls)).every(result => (result as { outcome: string }).outcome === 'unknown'));
  assert.equal((await service.create({ ...scope, requestId: randomUUID() }, stalled) as { outcome: string }).outcome, 'unknown'); assert.equal(checks, 4);
  service.close(); releases.forEach(release => release()); await new Promise(resolve => setImmediate(resolve)); assert.equal(connections, 0);
});
