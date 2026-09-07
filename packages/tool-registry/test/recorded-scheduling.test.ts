import assert from 'node:assert/strict';
import test from 'node:test';
import { invokeTool, ToolError, type InvocationContext, type RecordedBriefScheduler } from '../src/index.ts';

const now = new Date('2026-09-07T11:00:00Z');
const names = { start: 'workflow.recorded-brief.start', status: 'workflow.recorded-brief.status' } as const;
const principal = { subject: 'synthetic-dispatcher', organizationId: 'org-a', type: 'agent', hats: [],
  toolGrants: Object.values(names), expiresAt: '2026-09-07T11:01:00Z' };
const scope = { organizationId: 'org-a', repository: 'github:1', itemId: 'intent/0175' };
const idempotencyKey = '17500000-0000-4000-8000-000000000001', input = { ...scope, idempotencyKey };
const workflowId = `steer-recorded-brief/v1/org-a/github%3A1/intent%2F0175/${idempotencyKey}`;
const runId = '17500000-0000-4000-8000-000000000002';
const started = { workflowId, outcome: 'started', runId }, found = { workflowId, outcome: 'found', runId, state: 'RUNNING' };
const service = (): RecordedBriefScheduler => ({ target: { scope: { ...scope }, idempotencyKey }, workflowId, start: async () => started, inspect: async () => found });
const context = (scheduler = service()): InvocationContext => ({ principal, now, clock: () => now, revalidate: async () => principal, services: { recordedBriefScheduler: scheduler } });
const code = (expected: string) => (error: unknown) => error instanceof ToolError && error.code === expected;

test('recorded dispatch and status require their own exact grants and target, never save, ingest or reconciliation authority', async () => {
  const scheduler = service(); let starts = 0, reads = 0;
  scheduler.start = async () => { starts++; return started; }; scheduler.inspect = async () => { reads++; return found; };
  const ctx = context(scheduler);
  assert.deepEqual(await invokeTool(names.start, input, ctx), started);
  assert.deepEqual(await invokeTool(names.status, input, ctx), found);
  for (const name of Object.values(names)) {
    for (const patch of [{ organizationId: 'foreign' }, { repository: 'github:2' }, { itemId: 'intent/other' }, { idempotencyKey: runId }])
      await assert.rejects(async () => invokeTool(name, { ...input, ...patch }, ctx), code('FORBIDDEN'));
    for (const patch of [{ namespace: 'other' }, { taskQueue: 'other' }, { subject: 'human' }, { receipt: started }, { idempotencyKey: 'bad' }])
      await assert.rejects(async () => invokeTool(name, { ...input, ...patch }, ctx), code('INVALID_INPUT'));
    for (const grants of [[], ['intent.brief.save'], ['projection.ingest'], ['workflow.reconciliation.start'], [name === names.start ? names.status : names.start]])
      await assert.rejects(async () => invokeTool(name, input, { ...ctx, principal: { ...principal, toolGrants: grants } }), code('FORBIDDEN'));
  }
  assert.equal(starts, 1); assert.equal(reads, 1);
});
test('only a current hat-free agent can dispatch; human status requires an explicit read grant, not a signature', async () => {
  const scheduler = service(); let starts = 0; scheduler.start = async () => { starts++; return started; };
  await assert.rejects(invokeTool(names.start, input, { ...context(scheduler), principal: { ...principal, type: 'human' } }), code('FORBIDDEN'));
  for (const current of [null, { ...principal, subject: 'other' }, { ...principal, type: 'human' }, { ...principal, hats: ['product-lead'] }, { ...principal, expiresAt: now.toISOString() }])
    await assert.rejects(invokeTool(names.start, input, { ...context(scheduler), revalidate: async () => current }), code('UNAUTHENTICATED'));
  await assert.rejects(invokeTool(names.start, input, { ...context(scheduler), revalidate: async () => ({ ...principal, toolGrants: [] }) }), code('FORBIDDEN'));
  for (const clock of [() => new Date(0), () => new Date('invalid'), () => new Date('2026-09-07T11:02:00Z')])
    await assert.rejects(invokeTool(names.start, input, { ...context(scheduler), clock }), code('UNAUTHENTICATED'));
  const human = { ...principal, type: 'human', hats: ['product-lead'], toolGrants: [names.status] };
  assert.deepEqual(await invokeTool(names.status, input, { ...context(scheduler), principal: human, revalidate: async () => human }), found);
  assert.equal(starts, 0);
});
test('missing or inconsistent composition stays unavailable and changed binding during revalidation cannot dispatch', async () => {
  const scheduler = service(); let starts = 0; scheduler.start = async () => { starts++; return started; };
  const noRefresh = context(scheduler); delete noRefresh.revalidate;
  for (const ctx of [{ principal, now }, noRefresh, context({ ...scheduler, workflowId: 'foreign' }),
    context({ ...scheduler, target: { ...scheduler.target, idempotencyKey: '' } })])
    await assert.rejects(invokeTool(names.start, input, ctx), code('UNAVAILABLE'));
  const changed = context(scheduler); changed.revalidate = async () => {
    (scheduler.target.scope as { itemId: string }).itemId = 'other'; return principal;
  };
  await assert.rejects(invokeTool(names.start, input, changed), code('FORBIDDEN')); assert.equal(starts, 0);
});
test('start results preserve accepted effects after revocation and sanitize malformed or missing acknowledgments without retry', async () => {
  const scheduler = service(); let calls = 0, active = true;
  scheduler.start = async () => { calls++; active = false; return started; };
  assert.deepEqual(await invokeTool(names.start, input, { ...context(scheduler), revalidate: async () => active ? principal : null }), started);
  for (const result of [{ ...started, private: 'secret' }, { ...started, workflowId: 'foreign' }, { ...started, runId: '' }]) {
    scheduler.start = async () => { calls++; return result; };
    assert.deepEqual(await invokeTool(names.start, input, context(scheduler)), { workflowId, outcome: 'unknown' });
  }
  scheduler.start = async () => { calls++; throw new Error('private accepted then lost'); };
  assert.deepEqual(await invokeTool(names.start, input, context(scheduler)), { workflowId, outcome: 'unknown' }); assert.equal(calls, 5);
  for (const outcome of ['duplicate', 'unknown', 'already-attempted']) {
    scheduler.start = async () => ({ workflowId, outcome });
    assert.deepEqual(await invokeTool(names.start, input, context(scheduler)), { workflowId, outcome });
  }
});
test('status reauthorizes after I/O and discards changed targets, revoked output and malformed execution claims', async () => {
  let active = true; const scheduler = service();
  scheduler.inspect = async () => { active = false; return found; };
  await assert.rejects(invokeTool(names.status, input, { ...context(scheduler), revalidate: async () => active ? principal : null }), code('UNAUTHENTICATED'));
  for (const result of [{ ...found, workflowId: 'foreign' }, { ...found, state: 'APPROVED' }, { ...found, private: 'secret' }]) {
    scheduler.inspect = async () => result;
    assert.deepEqual(await invokeTool(names.status, input, context(scheduler)), { workflowId, outcome: 'unknown' });
  }
  scheduler.inspect = async () => { throw new Error('private not found'); };
  assert.deepEqual(await invokeTool(names.status, input, context(scheduler)), { workflowId, outcome: 'unknown' });
  scheduler.inspect = async () => { (scheduler.target.scope as { repository: string }).repository = 'foreign'; return found; };
  await assert.rejects(invokeTool(names.status, input, context(scheduler)), code('FORBIDDEN'));
});
