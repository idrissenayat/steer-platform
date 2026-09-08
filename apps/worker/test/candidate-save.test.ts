import assert from 'node:assert/strict';
import test from 'node:test';
import type { Client } from '@temporalio/client';
import { randomUUID } from 'node:crypto';
import { parseCandidateSaveTarget, parseCandidateSaveResult, candidateSaveWorkflowId } from '../src/candidate-save-contracts.ts';
import { createCandidateSaveActivities } from '../src/candidate-save-activity.ts';
import { startCandidateBundleSave } from '../src/client.ts';
const target = { organizationId: 'synthetic-org', operationId: randomUUID(), inputDigest: 'a'.repeat(64) };

test('candidate workflow contracts are exact, content-free and retain one ID across input changes', () => {
  assert.deepEqual(parseCandidateSaveTarget(target), target);
  for (const value of [null, {}, { ...target, inputDigest: target.inputDigest + '\n' }, { ...target, operationId: target.operationId.toUpperCase() },
    { ...target, content: 'private' }, { ...target, organizationId: 'org\n' }, { ...target, approval: true }]) assert.throws(() => parseCandidateSaveTarget(value));
  assert.equal(candidateSaveWorkflowId(target), candidateSaveWorkflowId({ ...target, inputDigest: 'b'.repeat(64) }));
  assert.notEqual(candidateSaveWorkflowId(target), candidateSaveWorkflowId({ ...target, organizationId: 'other' }));
  assert.ok(candidateSaveWorkflowId({ ...target, organizationId: 'a' + ':'.repeat(63) }).length <= 255);
  const result = { operationId: target.operationId, inputDigest: target.inputDigest, outcome: 'unknown', revision: null };
  assert.deepEqual(parseCandidateSaveResult(result, target), result);
  for (const value of [{ ...result, content: 'private' }, { ...result, outcome: 'committed' }, { ...result, revision: 'b'.repeat(40) },
    { ...result, inputDigest: 'c'.repeat(64) }, { ...result, outcome: 'approved' }]) assert.throws(() => parseCandidateSaveResult(value, target));
});
test('candidate start serializes only the reference, rejects duplicate identity, and never requests workflow retries', async () => {
  let options: Record<string, unknown> | undefined;
  const client = { workflow: { start: async (name: string, value: Record<string, unknown>) => {
    assert.equal(name, 'saveCandidateBundle'); options = value;
  } } } as unknown as Client;
  await startCandidateBundleSave(client, 'synthetic-save', target);
  assert.deepEqual(options?.args, [target]); assert.equal(options?.workflowId, candidateSaveWorkflowId(target));
  assert.equal(options?.workflowIdConflictPolicy, 'FAIL'); assert.equal(options?.workflowIdReusePolicy, 'REJECT_DUPLICATE');
  assert.equal(options?.workflowExecutionTimeout, '5 minutes'); assert.equal(options?.retry, undefined);
  assert.throws(() => startCandidateBundleSave(client, 'invalid queue', target));
  assert.throws(() => startCandidateBundleSave(client, 'synthetic\n', target));
  assert.throws(() => startCandidateBundleSave(client, 'synthetic', { ...target, bundle: {} }));
});
test('fixed candidate activity denies foreign references before payload access and sanitizes private failures', async () => {
  let reads = 0, writes = 0;
  const activity = createCandidateSaveActivities(target, { authorize: async () => {}, loadOriginal: async () => { reads++; throw new Error('private source bytes'); },
    store: { compareAndWrite: async () => { writes++; throw new Error('private provider bytes'); }, close: () => {} } });
  const signal = new AbortController().signal;
  await assert.rejects(activity.saveCandidateBundle({ ...target, inputDigest: 'b'.repeat(64) }, signal)); assert.equal(reads, 0);
  await assert.rejects(activity.saveCandidateBundle(target, signal), /^Error: Candidate save requires attention\.$/);
  assert.equal(reads, 1); assert.equal(writes, 0); activity.close();
  await assert.rejects(activity.saveCandidateBundle(target, signal)); assert.equal(reads, 1);
});
test('candidate activity cancellation closes dispatch and retains admission until a late payload read drains', async () => {
  let entered!: () => void, release!: () => void, writes = 0, closed = 0;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const activity = createCandidateSaveActivities(target, { authorize: async () => {}, loadOriginal: async () => {
    entered(); await new Promise<void>(resolve => { release = resolve; }); return {};
  }, store: { compareAndWrite: async () => { writes++; throw new Error(); }, close: () => { closed++; } } });
  const cancellation = new AbortController(); const pending = assert.rejects(activity.saveCandidateBundle(target, cancellation.signal), /requires attention/);
  await started; cancellation.abort(); await pending;
  assert.equal(closed, 1); assert.deepEqual(activity.status(), { active: true, closed: true });
  await assert.rejects(activity.saveCandidateBundle(target, new AbortController().signal));
  release(); await new Promise(resolve => setImmediate(resolve)); assert.equal(activity.status().active, false); assert.equal(writes, 0);
});
test('stalled original payload times out in five seconds without resetting admission or allowing late writes', async () => {
  let release!: () => void;
  const activity = createCandidateSaveActivities(target, { authorize: async () => {}, loadOriginal: async () => {
    await new Promise<void>(resolve => { release = resolve; }); return {};
  }, store: { compareAndWrite: async () => { throw new Error('Must never run'); }, close: () => {} } });
  await assert.rejects(activity.saveCandidateBundle(target, new AbortController().signal), /requires attention/);
  assert.deepEqual(activity.status(), { active: true, closed: true });
  release(); await new Promise(resolve => setImmediate(resolve)); assert.equal(activity.status().active, false);
});
