import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createIntentDraftService } from '../src/intent-draft-service.ts';
const config = { organizationId: 'org', subject: 'human', productId: 'product', repository: 'github:52', branch: 'codex/synthetic',
  configurationRevision: 'r1', recordsPolicyDigest: 'a'.repeat(64) };
const scope = { organizationId: config.organizationId, productId: config.productId, repository: config.repository };
const turn = () => new Promise<void>(resolve => setImmediate(resolve));
const readInput = () => ({ ...scope, draftId: randomUUID(), revision: 'latest' as const });
const appendInput = () => ({ ...scope, draftId: randomUUID(), mutationId: randomUUID(), expectedRevision: 0, expectedDigest: null,
  content: { originalText: 'Synthetic scope', clarificationTurns: [], documents: { brief: '', spec: '', exam: '' } } });

for (const mode of ['read', 'create', 'append'] as const) {
  test(`${mode}: read metadata orders policy before fresh caller; writes retain their before/after caller checks`, async () => {
    const events: string[] = []; let allowed = true, io = 0;
    const policy = async () => { events.push('policy'); allowed = false; };
    const service = createIntentDraftService({ connect: async () => { io++; throw new Error('No SQL'); } }, config, {
      lifecycle: { authorize: policy }, revisions: { authorize: policy, keyForDraft: async () => { io++; throw new Error('No keys'); } },
    });
    const current = async () => { events.push('current'); if (!allowed) throw new Error('revoked'); };
    if (mode === 'read') await assert.rejects(service.read(readInput(), current));
    else if (mode === 'create') await service.create({ ...scope, requestId: randomUUID() }, current);
    else await service.append(appendInput(), current);
    assert.equal(events.indexOf('policy'), mode === 'read' ? 1 : 2);
    assert.equal(events[events.indexOf('policy') + 1], 'current'); assert.equal(io, 0); service.close();
  });

  test(`${mode}: inner five-second policy timeout retains owner admission until the actual callback drains`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] }); let release!: () => void, policies = 0, io = 0;
    const held = new Promise<void>(resolve => { release = resolve; });
    const policy = async () => { policies++; await held; };
    const service = createIntentDraftService({ connect: async () => { io++; throw new Error('No SQL'); } }, config, {
      lifecycle: { authorize: policy }, revisions: { authorize: policy, keyForDraft: async () => { io++; throw new Error('No key'); } },
    });
    const run = () => mode === 'read' ? service.read(readInput(), async () => {})
      : mode === 'create' ? service.create({ ...scope, requestId: randomUUID() }, async () => {})
        : service.append(appendInput(), async () => {});
    const calls = Array.from({ length: 4 }, () => mode === 'read' ? assert.rejects(run()) : run());
    await turn(); assert.equal(policies, 4); t.mock.timers.tick(5001); await Promise.all(calls);
    if (mode === 'read') await assert.rejects(run()); else assert.equal((await run() as { outcome: string }).outcome, 'unknown');
    assert.equal(policies, 4); service.close(); release(); await turn(); assert.equal(io, 0);
  });
}
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
