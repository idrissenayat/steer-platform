import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import type { Client } from '@temporalio/client';
import { createDevelopmentActivities } from '../src/development-activity.ts';
import { startIntentDevelopment } from '../src/client.ts';
import { createDevelopmentWorker } from '../src/worker.ts';
import { parseDevelopmentTarget, parseDevelopmentStepTarget, parseDevelopmentStepResult, developmentWorkflowId,
  type DevelopmentStepResult } from '../src/development-workflow-contracts.ts';
const target = { organizationId: 'synthetic-org', operationId: randomUUID(), inputDigest: 'a'.repeat(64) };
const step = { ...target, role: 'architect' as const };
const result = (outcome: DevelopmentStepResult['outcome'] = 'succeeded'): DevelopmentStepResult => ({
  kind: 'steer-development-step-outcome/v1', operationId: target.operationId, inputDigest: target.inputDigest, role: 'architect', outcome,
  resultRef: ['succeeded', 'needs-clarification', 'superseded'].includes(outcome) ? randomUUID() : null,
  resultDigest: ['succeeded', 'needs-clarification', 'superseded'].includes(outcome) ? 'b'.repeat(64) : null,
  gateSigned: false, executionAuthorized: false, retryAuthorized: false,
});

test('development history contracts reject content and authority, and input drift cannot create another operation identity', () => {
  assert.deepEqual(parseDevelopmentTarget(target), target); assert.deepEqual(parseDevelopmentStepTarget(step), step);
  for (const raw of [null, {}, { ...target, text: 'private' }, { ...target, budget: {} }, { ...target, inputDigest: target.inputDigest + '\n' },
    { ...target, organizationId: 'org\n' }, { ...target, operationId: target.operationId.toUpperCase() }]) assert.throws(() => parseDevelopmentTarget(raw));
  for (const raw of [{ ...step, role: 'critic' }, { ...step, grant: true }]) assert.throws(() => parseDevelopmentStepTarget(raw));
  assert.equal(developmentWorkflowId(target), developmentWorkflowId({ ...target, inputDigest: 'c'.repeat(64) }));
  assert.notEqual(developmentWorkflowId(target), developmentWorkflowId({ ...target, organizationId: 'other' }));
  assert.ok(developmentWorkflowId({ ...target, organizationId: 'a' + ':'.repeat(63) }).length <= 255);
  for (const state of ['succeeded', 'needs-clarification', 'superseded', 'busy', 'attention-required'] as const) {
    const value = result(state); assert.deepEqual(parseDevelopmentStepResult(value, step), value);
  }
  const value = result();
  for (const raw of [{ ...value, content: 'private' }, { ...value, role: 'test-agent' }, { ...value, gateSigned: true },
    { ...value, retryAuthorized: true }, { ...value, resultRef: null }, { ...value, resultDigest: value.resultDigest + '\n' },
    { ...value, outcome: 'attention-required' }, { ...value, inputDigest: 'f'.repeat(64) }]) assert.throws(() => parseDevelopmentStepResult(raw, step));
  assert.throws(() => parseDevelopmentStepResult({ ...result('needs-clarification'), role: 'test-agent' }, { ...step, role: 'test-agent' }));
});
test('development start has a fixed reference, duplicate rejection and no workflow retries', async () => {
  let options: Record<string, unknown> | undefined, calls = 0;
  const client = { workflow: { start: async (name: string, value: Record<string, unknown>) => {
    assert.equal(name, 'developIntent'); options = value; calls++;
  } } } as unknown as Client;
  await startIntentDevelopment(client, 'synthetic-development', target);
  assert.deepEqual(options?.args, [target]); assert.equal(options?.workflowId, developmentWorkflowId(target));
  assert.equal(options?.workflowIdConflictPolicy, 'FAIL'); assert.equal(options?.workflowIdReusePolicy, 'REJECT_DUPLICATE');
  assert.equal(options?.workflowExecutionTimeout, '8 minutes'); assert.equal(options?.retry, undefined);
  for (const invalid of ['queue\n', undefined, 12]) assert.throws(() => startIntentDevelopment(client, invalid as string, target));
  assert.throws(() => startIntentDevelopment(client, 'queue', step)); assert.equal(calls, 1);
  for (const invalid of ['queue\n', undefined, 12]) assert.throws(() => createDevelopmentWorker({ namespace: 'default', taskQueue: invalid } as Parameters<typeof createDevelopmentWorker>[0],
    {} as ReturnType<typeof createDevelopmentActivities>));
});
test('fixed development activity refuses substitutions before runtime access and sanitizes failures or malformed results', async () => {
  let calls = 0;
  const activity = createDevelopmentActivities(target, { run: async () => { calls++; throw new Error('private-source-marker'); }, close() {} });
  for (const raw of [{ ...step, organizationId: 'foreign' }, { ...step, inputDigest: 'f'.repeat(64) }, { ...step, role: 'critic' }])
    await assert.rejects(activity.developIntentStep(raw, new AbortController().signal));
  await assert.rejects(activity.developIntentStep(step, {} as AbortSignal)); assert.equal(calls, 0);
  await assert.rejects(activity.developIntentStep(step, new AbortController().signal), /^Error: Intent development requires attention\.$/); assert.equal(calls, 1);
  activity.close(); await assert.rejects(activity.developIntentStep(step, new AbortController().signal)); assert.equal(calls, 1);
  const malformed = createDevelopmentActivities(target, { run: async () => ({ ...result(), role: 'test-agent' }), close() {} });
  await assert.rejects(malformed.developIntentStep(step, new AbortController().signal), /requires attention/); malformed.close();
});
test('development cancellation closes runtime, retains admission until late work drains and cannot leak late results', async () => {
  let entered!: () => void, release!: () => void, closes = 0, runtimeSignal: AbortSignal | undefined;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const activity = createDevelopmentActivities(target, { run: async (_role, signal) => {
    runtimeSignal = signal; entered(); await new Promise<void>(resolve => { release = resolve; }); return result();
  }, close() { closes++; } });
  const cancellation = new AbortController(), pending = assert.rejects(activity.developIntentStep(step, cancellation.signal), /requires attention/);
  await started; await assert.rejects(activity.developIntentStep(step, new AbortController().signal));
  cancellation.abort(); await pending; assert.equal(runtimeSignal?.aborted, true); assert.equal(closes, 1);
  assert.deepEqual(activity.status(), { active: true, closed: true }); release(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(activity.status(), { active: false, closed: true }); activity.close(); assert.equal(closes, 1);
});
test('development activity returns only the validated checkpoint and explicit close interrupts admitted work', async () => {
  const value = result('needs-clarification'), activity = createDevelopmentActivities(target, { run: async () => value, close() {} });
  assert.deepEqual(await activity.developIntentStep(step, new AbortController().signal), value); activity.close();
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const stalled = createDevelopmentActivities(target, { run: async () => { entered(); await new Promise<void>(resolve => { release = resolve; }); return result(); },
    close() { throw new Error('private-close-marker'); } });
  const pending = assert.rejects(stalled.developIntentStep(step, new AbortController().signal), /requires attention/);
  await started; stalled.close(); await pending; release(); await new Promise(resolve => setImmediate(resolve)); assert.equal(stalled.status().active, false);
});
test('development activity deadline closes admission without releasing a stalled runtime result', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let entered!: () => void, release!: () => void, closes = 0;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const activity = createDevelopmentActivities(target, { run: async () => { entered(); await new Promise<void>(resolve => { release = resolve; }); return result(); }, close() { closes++; } });
  const pending = assert.rejects(activity.developIntentStep(step, new AbortController().signal), /requires attention/);
  await started; t.mock.timers.tick(100000); await pending; assert.equal(closes, 1); assert.deepEqual(activity.status(), { active: true, closed: true });
  release(); await new Promise(resolve => setImmediate(resolve)); assert.equal(activity.status().active, false);
});
