import assert from 'node:assert/strict';
import { test } from 'node:test';
import { invokeTool, ToolError, type InvocationContext, type ReconciliationScheduler } from '../src/index.ts';

const now = new Date('2026-09-05T10:00:00Z');
const principal = { subject: 'synthetic', organizationId: 'org-a', type: 'agent', hats: [],
  toolGrants: ['workflow.reconciliation.start', 'workflow.reconciliation.status'], expiresAt: '2026-09-05T10:01:00Z' };
const scope = { organizationId: 'org-a', repository: 'github:1', itemId: 'intent/0001' };
const input = { ...scope, rounds: 2, intervalMs: 2000 };
const workflowId = 'steer-reconcile/v1/org-a/github%3A1/intent%2F0001';
const runId = '00000000-0000-4000-8000-000000000039';
const started = { workflowId, outcome: 'started', runId }, found = { workflowId, outcome: 'found', runId, state: 'RUNNING' };
const scheduler = (): ReconciliationScheduler => ({ scope, workflowId, limits: { maxRounds: 2, minIntervalMs: 2000 }, start: async () => started, inspect: async () => found });
const context = (service = scheduler()): InvocationContext => ({ principal, now, clock: () => now, revalidate: async () => principal, services: { reconciliationScheduler: service } });
const code = (value: string) => (error: unknown) => error instanceof ToolError && error.code === value;

test('scheduling and status authorize fixed scope and configured caps before dispatch', async () => {
  let starts = 0, reads = 0; const service = scheduler();
  service.start = async (value) => { starts++; assert.deepEqual(value, input); return started; };
  service.inspect = async () => { reads++; return found; };
  const ctx = context(service);
  assert.deepEqual(await invokeTool('workflow.reconciliation.start', input, ctx), started);
  assert.deepEqual(await invokeTool('workflow.reconciliation.status', scope, ctx), found);
  for (const change of [{ organizationId: 'foreign' }, { repository: 'github:2' }, { itemId: 'intent/0002' }, { rounds: 3 }, { intervalMs: 1000 }]) {
    await assert.rejects(invokeTool('workflow.reconciliation.start', { ...input, ...change }, ctx), code('FORBIDDEN'));
  }
  for (const change of [{ rounds: 0 }, { intervalMs: 999 }, { taskQueue: 'foreign' }, { namespace: 'foreign' }, { hats: [] }]) {
    await assert.rejects(invokeTool('workflow.reconciliation.start', { ...input, ...change }, ctx), code('INVALID_INPUT'));
  }
  for (const name of ['workflow.reconciliation.start', 'workflow.reconciliation.status']) {
    await assert.rejects(async () => invokeTool(name, name.endsWith('start') ? input : scope, { ...ctx, principal: { ...principal, toolGrants: [] } }), code('FORBIDDEN'));
  }
  assert.equal(starts, 1); assert.equal(reads, 1);
});

test('revocation, identity switch, agent hats, expiry and clock regression prevent any start', async () => {
  let starts = 0; const service = scheduler(); service.start = async () => { starts++; return started; };
  for (const current of [null, { ...principal, subject: 'other' }, { ...principal, type: 'human' }, { ...principal, hats: ['product-lead'] }, { ...principal, expiresAt: now.toISOString() }]) {
    await assert.rejects(invokeTool('workflow.reconciliation.start', input, { ...context(service), revalidate: async () => current }), code('UNAUTHENTICATED'));
  }
  await assert.rejects(invokeTool('workflow.reconciliation.start', input, { ...context(service), principal: { ...principal, hats: ['product-lead'] } }), code('UNAUTHENTICATED'));
  await assert.rejects(invokeTool('workflow.reconciliation.start', input, { ...context(service), revalidate: async () => ({ ...principal, toolGrants: [] }) }), code('FORBIDDEN'));
  await assert.rejects(invokeTool('workflow.reconciliation.start', input, { ...context(service), revalidate: async () => { throw new Error('private'); } }), code('UNAUTHENTICATED'));
  for (const clock of [() => new Date(0), () => new Date('invalid'), () => new Date('2026-09-05T10:02:00Z')]) {
    await assert.rejects(invokeTool('workflow.reconciliation.start', input, { ...context(service), clock }), code('UNAUTHENTICATED'));
  }
  assert.equal(starts, 0);
});

test('missing composition or invalid configured bounds remains unavailable without dispatch', async () => {
  let starts = 0; const service = scheduler(); service.start = async () => { starts++; return started; };
  const noRefresh = context(service); delete noRefresh.revalidate;
  for (const ctx of [{ principal, now }, noRefresh, context({ ...service, limits: { maxRounds: 101, minIntervalMs: 1000 } }), context({ ...service, workflowId: '' })]) {
    await assert.rejects(invokeTool('workflow.reconciliation.start', input, ctx), code('UNAVAILABLE'));
  }
  assert.equal(starts, 0);
});

test('accepted and uncertain starts return minimal truthful receipts with no automatic retry', async () => {
  const service = scheduler(); let starts = 0, active = true;
  const ctx = { ...context(service), revalidate: async () => active ? principal : null };
  service.start = async () => { starts++; active = false; return started; };
  // Revocation after dispatch is not a rollback of an accepted mutation.
  assert.deepEqual(await invokeTool('workflow.reconciliation.start', input, ctx), started);
  for (const result of [{ ...started, private: 'secret' }, { ...started, workflowId: 'foreign' }, { ...started, runId: 'invalid' }]) {
    service.start = async () => { starts++; return result; };
    assert.deepEqual(await invokeTool('workflow.reconciliation.start', input, context(service)), { workflowId, outcome: 'unknown' });
  }
  service.start = async () => { starts++; throw new Error('private provider response lost after acceptance'); };
  assert.deepEqual(await invokeTool('workflow.reconciliation.start', input, context(service)), { workflowId, outcome: 'unknown' });
  assert.equal(starts, 5);
  service.start = async () => ({ workflowId, outcome: 'duplicate' });
  assert.deepEqual(await invokeTool('workflow.reconciliation.start', input, context(service)), { workflowId, outcome: 'duplicate' });
});

test('status reauthorizes after I/O, discards revoked output, and never equates failure with absence', async () => {
  const service = scheduler(); let active = true;
  service.inspect = async () => { active = false; return found; };
  await assert.rejects(invokeTool('workflow.reconciliation.status', scope, { ...context(service), revalidate: async () => active ? principal : null }), code('UNAUTHENTICATED'));
  for (const value of [{ ...found, workflowId: 'foreign' }, { ...found, private: 'secret' }, { ...found, state: 'APPROVED' }]) {
    service.inspect = async () => value;
    assert.deepEqual(await invokeTool('workflow.reconciliation.status', scope, context(service)), { workflowId, outcome: 'unknown' });
  }
  service.inspect = async () => { throw new Error('private'); };
  assert.deepEqual(await invokeTool('workflow.reconciliation.status', scope, context(service)), { workflowId, outcome: 'unknown' });
  service.inspect = async () => ({ workflowId, outcome: 'not-found' });
  assert.deepEqual(await invokeTool('workflow.reconciliation.status', scope, context(service)), { workflowId, outcome: 'not-found' });
});
