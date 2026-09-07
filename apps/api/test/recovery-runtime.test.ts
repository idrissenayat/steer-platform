import assert from 'node:assert/strict';
import test from 'node:test';
import { createIdentityRuntime } from '../src/runtime.ts';
import { recoveryRuntimeFixture } from './recovery-runtime-fixture.ts';

test('recovery runtime requires closed paired configuration and rejects every foreign plan coordinate before provider work', async t => {
  const f = await recoveryRuntimeFixture(t); let created = 0, closed = 0;
  const scheduler = { plan: f.plan, workflowId: f.workflowId, start: async () => null, inspect: async () => null };
  const factory = async () => { created++; return { scheduler, shutdown: async () => { closed++; } }; };
  const { recordedRecovery, ...base } = f.profile;
  for (const [profile, createRecoveryScheduler] of [[base, factory], [f.profile, undefined],
    [{ ...f.profile, recordedRecovery: { ...recordedRecovery, namespace: 'injected' } }, factory],
    [{ ...f.profile, recordedRecovery: { ...recordedRecovery, failedRunId: 'bad' } }, factory]] as const)
    await assert.rejects(createIdentityRuntime(profile, f.secrets, { ...f.ports, ...(createRecoveryScheduler ? { createRecoveryScheduler } : {}) }), /configuration could not be initialized/);
  assert.equal(created, 0);
  const plans = [
    { ...f.plan, failedRunId: '18300000-0000-4000-8000-000000000099' },
    { ...f.plan, target: { ...f.target, idempotencyKey: '18300000-0000-4000-8000-000000000099' } },
    ...['organizationId', 'repository', 'itemId'].map(key => ({ ...f.plan, target: { ...f.target, scope: { ...f.target.scope, [key]: 'foreign' } } })),
    { ...f.plan, reset: true }, { ...f.plan, target: { ...f.target, private: 'secret' } },
  ];
  for (const value of [{ ...scheduler, workflowId: 'foreign' }, ...plans.map(plan => ({ ...scheduler, plan }))])
    await assert.rejects(createIdentityRuntime(f.profile, f.secrets, { ...f.ports,
      createRecoveryScheduler: async () => ({ scheduler: value, shutdown: async () => { closed++; } }) }), /configuration could not be initialized/);
  assert.equal(closed, 8);
  await assert.rejects(createIdentityRuntime(f.profile, { ...f.secrets, browserClientSecret: 'short' },
    { ...f.ports, createRecoveryScheduler: factory }), /configuration could not be initialized/);
  assert.equal(created, 1); assert.equal(closed, 9);
  assert.deepEqual(f.counts(), { jwks: 0, assertions: 0 }); assert.equal(f.source.calls.length, 0);
});
test('signed recovery identity uses current separate Git grants and cannot substitute dispatch or projector grants', async t => {
  const f = await recoveryRuntimeFixture(t); let starts = 0, reads = 0, closed = 0;
  const runtime = await createIdentityRuntime(f.profile, f.secrets, { ...f.ports, createRecoveryScheduler: async () => ({
    scheduler: { plan: f.plan, workflowId: f.workflowId,
      start: async () => { starts++; return { workflowId: f.workflowId, outcome: 'unknown' }; },
      inspect: async () => { reads++; return { workflowId: f.workflowId, outcome: 'not-found' }; } }, shutdown: async () => { closed++; },
  }) });
  t.after(() => runtime.shutdown()); assert.equal(runtime.status().database.connections, 0); assert.equal(f.source.calls.length, 0);
  for (const mode of ['start', 'status'] as const) assert.equal((await runtime.fetch(f.request(mode))).status, 200);
  for (const toolGrants of [['projection.ingest'], ['workflow.recorded-brief.start', 'workflow.recorded-brief.status'], ['intent.brief.save']]) {
    f.publish({ ...f.grant, toolGrants });
    for (const mode of ['start', 'status'] as const) assert.equal((await runtime.fetch(f.request(mode))).status, 403);
  }
  f.publish({ ...f.grant, active: false });
  for (const mode of ['start', 'status'] as const) assert.equal((await runtime.fetch(f.request(mode))).status, 401);
  assert.equal(starts, 1); assert.equal(reads, 1); assert.ok(f.counts().jwks > 0 && f.counts().assertions > 0); assert.equal(f.source.mutations(), 0);
  await runtime.shutdown(); await runtime.shutdown(); assert.equal(closed, 1); assert.equal(runtime.status().database.closed, true);
});
test('recovery-only runtime drains an authenticated status request before closing scheduler and session pool without MCP', async t => {
  const f = await recoveryRuntimeFixture(t); let enter!: () => void, release!: () => void, closed = 0;
  const entered = new Promise<void>(resolve => { enter = resolve; }), blocked = new Promise<void>(resolve => { release = resolve; });
  const runtime = await createIdentityRuntime(f.profile, f.secrets, { ...f.ports, createRecoveryScheduler: async () => ({
    scheduler: { plan: f.plan, workflowId: f.workflowId, start: async () => null,
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
test('recovery cleanup failure cannot prevent independent dispatch cleanup, leak details or reopen the runtime', async t => {
  const f = await recoveryRuntimeFixture(t); let recoveryClosed = 0, dispatchClosed = 0;
  const target = f.target, workflowId = f.workflowId.replace('steer-recorded-brief-recovery/v1/', 'steer-recorded-brief/v1/').replace(`/${f.plan.failedRunId}`, '');
  const runtime = await createIdentityRuntime({ ...f.profile, recordedScheduling: { itemId: target.scope.itemId, idempotencyKey: target.idempotencyKey } }, f.secrets, {
    ...f.ports, createRecoveryScheduler: async () => ({ scheduler: { plan: f.plan, workflowId: f.workflowId, start: async () => null, inspect: async () => null },
      shutdown: async () => { recoveryClosed++; throw new Error('private recovery connection'); } }),
    createRecordedScheduler: async () => ({ scheduler: { target, workflowId, start: async () => null, inspect: async () => null }, shutdown: async () => { dispatchClosed++; } }),
  });
  await assert.rejects(runtime.shutdown(), /^Error: Identity service shutdown failed\.$/);
  assert.equal(recoveryClosed, 1); assert.equal(dispatchClosed, 1); assert.equal(runtime.status().database.closed, true);
  await assert.rejects(runtime.shutdown()); assert.equal(recoveryClosed, 1); assert.equal((await runtime.fetch(f.request('status'))).status, 503);
});

test('recovery factory rejection closes previously transferred dispatch resources without exposing its failure', async t => {
  const f = await recoveryRuntimeFixture(t); let closed = 0;
  const target = f.target, workflowId = f.workflowId.replace('steer-recorded-brief-recovery/v1/', 'steer-recorded-brief/v1/').replace(`/${f.plan.failedRunId}`, '');
  await assert.rejects(createIdentityRuntime({ ...f.profile, recordedScheduling: { itemId: target.scope.itemId, idempotencyKey: target.idempotencyKey } }, f.secrets, {
    ...f.ports, createRecordedScheduler: async () => ({ scheduler: { target, workflowId, start: async () => null, inspect: async () => null }, shutdown: async () => { closed++; } }),
    createRecoveryScheduler: async () => { throw new Error('private factory failure'); },
  }), /^Error: Identity runtime configuration could not be initialized\.$/);
  assert.equal(closed, 1); assert.equal(f.source.calls.length, 0); assert.deepEqual(f.counts(), { jwks: 0, assertions: 0 });
});
