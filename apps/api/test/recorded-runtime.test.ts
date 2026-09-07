import assert from 'node:assert/strict';
import test from 'node:test';
import { createIdentityRuntime } from '../src/runtime.ts';
import { recordedRuntimeFixture } from './recorded-runtime-fixture.ts';

test('recorded runtime requires exact explicit profile/factory pairing and releases mismatched owned schedulers without provider access', async t => {
  const f = await recordedRuntimeFixture(t); let created = 0, closed = 0;
  const scheduler = { target: f.target, workflowId: f.workflowId, start: async () => null, inspect: async () => null };
  const factory = async () => { created++; return { scheduler, shutdown: async () => { closed++; } }; };
  const { recordedScheduling: selection, ...base } = f.profile;
  for (const [profile, createRecordedScheduler] of [[base, factory], [f.profile, undefined],
    [{ ...f.profile, recordedScheduling: { ...selection, namespace: 'injected' } }, factory],
    [{ ...f.profile, recordedScheduling: { ...selection, idempotencyKey: 'bad' } }, factory]] as const)
    await assert.rejects(createIdentityRuntime(profile, f.secrets, { ...f.ports, ...(createRecordedScheduler ? { createRecordedScheduler } : {}) }), /configuration could not be initialized/);
  assert.equal(created, 0);
  for (const value of [{ ...scheduler, workflowId: 'foreign' }, { ...scheduler, target: { ...f.target, idempotencyKey: '17600000-0000-4000-8000-000000000002' } },
    ...['organizationId', 'repository', 'itemId'].map(key => ({ ...scheduler, target: { ...f.target, scope: { ...f.target.scope, [key]: 'foreign' } } }))])
    await assert.rejects(createIdentityRuntime(f.profile, f.secrets, { ...f.ports,
      createRecordedScheduler: async () => ({ scheduler: value, shutdown: async () => { closed++; } }) }), /configuration could not be initialized/);
  assert.equal(closed, 5);
  await assert.rejects(createIdentityRuntime(f.profile, { ...f.secrets, browserClientSecret: 'short' },
    { ...f.ports, createRecordedScheduler: factory }), /configuration could not be initialized/);
  assert.equal(created, 1); assert.equal(closed, 6);
  assert.deepEqual(f.counts(), { jwks: 0, assertions: 0 }); assert.equal(f.source.calls.length, 0);
});
test('actual signed OIDC and current native Git grants reach recorded runtime tools while committed revocation denies dispatch and status', async t => {
  const f = await recordedRuntimeFixture(t); let starts = 0, reads = 0, closed = 0;
  const runtime = await createIdentityRuntime(f.profile, f.secrets, { ...f.ports, createRecordedScheduler: async () => ({
    scheduler: { target: f.target, workflowId: f.workflowId,
      start: async () => { starts++; return { workflowId: f.workflowId, outcome: 'unknown' }; },
      inspect: async () => { reads++; return { workflowId: f.workflowId, outcome: 'not-found' }; } }, shutdown: async () => { closed++; },
  }) });
  t.after(() => runtime.shutdown()); assert.equal(runtime.status().database.connections, 0); assert.equal(f.source.calls.length, 0);
  for (const mode of ['start', 'status'] as const) assert.equal((await runtime.fetch(f.request(mode))).status, 200);
  assert.equal(starts, 1); assert.equal(reads, 1); assert.ok(f.counts().jwks > 0 && f.counts().assertions > 0);
  f.publish({ ...f.grant, toolGrants: ['projection.ingest'] });
  for (const mode of ['start', 'status'] as const) assert.equal((await runtime.fetch(f.request(mode))).status, 403);
  f.publish({ ...f.grant, active: false });
  for (const mode of ['start', 'status'] as const) assert.equal((await runtime.fetch(f.request(mode))).status, 401);
  assert.equal(starts, 1); assert.equal(reads, 1); assert.equal(f.source.mutations(), 0);
  await runtime.shutdown(); await runtime.shutdown(); assert.equal(closed, 1); assert.equal(runtime.status().database.closed, true);
});
test('browser-only recorded runtime drains authenticated status before closing its scheduler and session pool', async t => {
  const f = await recordedRuntimeFixture(t); let enter!: () => void, release!: () => void, closed = 0;
  const entered = new Promise<void>(resolve => { enter = resolve; });
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const runtime = await createIdentityRuntime(f.profile, f.secrets, { ...f.ports, createRecordedScheduler: async () => ({
    scheduler: { target: f.target, workflowId: f.workflowId, start: async () => null,
      inspect: async () => { enter(); await blocked; return { workflowId: f.workflowId, outcome: 'not-found' }; } },
    shutdown: async () => { closed++; },
  }) });
  t.after(async () => { release(); await runtime.shutdown(); });
  const pending = runtime.fetch(f.request('status')); await Promise.race([entered, pending.then(() => { throw new Error('Status did not reach scheduler'); })]);
  const stop = runtime.shutdown(); await Promise.resolve(); await Promise.resolve();
  assert.equal(closed, 0); assert.equal(runtime.status().database.closed, false); assert.equal(runtime.status().state, 'draining');
  assert.equal((await runtime.fetch(f.request('status'))).status, 503);
  release(); assert.equal((await pending).status, 200); await stop;
  assert.equal(closed, 1); assert.equal(runtime.status().database.closed, true); assert.equal(runtime.status().state, 'stopped');
});
test('recorded closure failure still closes other owned resources and cannot leak provider details or reopen', async t => {
  const f = await recordedRuntimeFixture(t); let recordedClosed = 0, otherClosed = 0;
  const runtime = await createIdentityRuntime({ ...f.profile, scheduling: { itemId: 'intent/0040', maxRounds: 1, minIntervalMs: 1000 } }, f.secrets, {
    ...f.ports, createRecordedScheduler: async () => ({ scheduler: { target: f.target, workflowId: f.workflowId, start: async () => null, inspect: async () => null },
      shutdown: async () => { recordedClosed++; throw new Error('private recorded connection'); } }),
    createScheduler: async () => ({ scheduler: { scope: { organizationId: f.input.organizationId, repository: f.input.repository, itemId: 'intent/0040' },
      workflowId: 'synthetic', limits: { maxRounds: 1, minIntervalMs: 1000 }, start: async () => null, inspect: async () => null }, shutdown: async () => { otherClosed++; } }),
  });
  await assert.rejects(runtime.shutdown(), /^Error: Identity service shutdown failed\.$/);
  assert.equal(recordedClosed, 1); assert.equal(otherClosed, 1); assert.equal(runtime.status().database.closed, true);
  await assert.rejects(runtime.shutdown()); assert.equal(recordedClosed, 1); assert.equal((await runtime.fetch(f.request('status'))).status, 503);
});
