import assert from 'node:assert/strict';
import test from 'node:test';
import { type Client, WorkflowExecutionAlreadyStartedError, WorkflowNotFoundError } from '@temporalio/client';
import { createManagedRecordedBriefRecoveryScheduler } from '../src/client.ts';
import { recordedBriefWorkflowId, recordedBriefRecoveryWorkflowId } from '../src/contracts.ts';

const target = { scope: { organizationId: 'synthetic', repository: 'github:1', itemId: 'items/0182' }, idempotencyKey: '18200000-0000-4000-8000-000000000001' };
const plan = { target, failedRunId: '18200000-0000-4000-8000-000000000002' };
const config = { namespace: 'default', sourceTaskQueue: 'original', taskQueue: 'recovery', plan };
const workflowId = recordedBriefRecoveryWorkflowId(plan), originalId = recordedBriefWorkflowId(target), runId = '18200000-0000-4000-8000-000000000003';
function fixture() {
  let starts = 0, parents = 0, reads = 0, closes = 0;
  const behavior = {
    parent: async (): Promise<unknown> => ({ workflowId: originalId, runId: plan.failedRunId, type: 'projectRecordedBrief', taskQueue: 'original', status: { name: 'FAILED' } }),
    start: async (): Promise<unknown> => ({ firstExecutionRunId: runId }),
    describe: async (): Promise<unknown> => ({ workflowId, runId, type: 'recoverRecordedBrief', taskQueue: 'recovery', status: { name: 'COMPLETED' } }),
  };
  const options = { namespace: 'default' };
  const client = { options, workflow: {
    start: async (name: string, value: unknown) => {
      starts++; assert.equal(name, 'recoverRecordedBrief');
      assert.deepEqual(value, { workflowId, taskQueue: 'recovery', args: [plan], workflowExecutionTimeout: '5 minutes', workflowIdConflictPolicy: 'FAIL', workflowIdReusePolicy: 'REJECT_DUPLICATE' });
      return behavior.start();
    },
    getHandle: (id: string) => ({ describe: async () => {
      if (id === originalId) { parents++; return behavior.parent(); }
      assert.equal(id, workflowId); reads++; return behavior.describe();
    } }),
  } } as unknown as Client;
  return { client, options, behavior, close: async () => { closes++; }, counts: () => ({ starts, parents, reads, closes }) };
}
test('owned recovery snapshots the exact plan and observes recovery status without re-admitting the parent', async () => {
  const f = fixture(), supplied = structuredClone(config), m = await createManagedRecordedBriefRecoveryScheduler(f.client, supplied, f.close);
  supplied.plan.failedRunId = 'foreign'; supplied.plan.target.scope.itemId = 'foreign'; supplied.taskQueue = 'foreign';
  assert.equal(Object.isFrozen(m.scheduler.plan.target.scope), true);
  assert.deepEqual(f.counts(), { starts: 0, parents: 0, reads: 0, closes: 0 });
  assert.deepEqual(await m.scheduler.start(), { workflowId, outcome: 'started', runId });
  assert.deepEqual(await m.scheduler.start(), { workflowId, outcome: 'already-attempted' });
  f.behavior.parent = async () => { throw new Error('private changed parent'); };
  assert.deepEqual(await m.scheduler.inspect(), { workflowId, outcome: 'found', runId, state: 'COMPLETED' });
  await m.shutdown(); assert.deepEqual(f.counts(), { starts: 1, parents: 1, reads: 1, closes: 1 });
});
test('parent uncertainty, lost acknowledgment and typed duplicate all consume the one-attempt latch', async () => {
  for (const mode of ['parent', 'start', 'duplicate', 'malformed']) {
    const f = fixture();
    if (mode === 'parent') f.behavior.parent = async () => { throw new Error('private parent'); };
    else f.behavior.start = async () => {
      if (mode === 'malformed') return { firstExecutionRunId: 'invalid' };
      throw mode === 'duplicate' ? new WorkflowExecutionAlreadyStartedError('private', workflowId, 'recoverRecordedBrief') : new Error('private lost acknowledgment');
    };
    f.behavior.describe = async () => { throw new WorkflowNotFoundError('private', workflowId, undefined); };
    const m = await createManagedRecordedBriefRecoveryScheduler(f.client, config, f.close);
    assert.deepEqual(await m.scheduler.start(), { workflowId, outcome: mode === 'duplicate' ? 'duplicate' : 'unknown' });
    assert.deepEqual(await m.scheduler.inspect(), { workflowId, outcome: 'not-found' });
    assert.deepEqual(await m.scheduler.start(), { workflowId, outcome: 'already-attempted' });
    await m.shutdown(); assert.equal(f.counts().parents, 1); assert.equal(f.counts().starts, mode === 'parent' ? 0 : 1);
  }
});
test('recovery status sanitizes malformed metadata and transport errors; namespace drift denies before I/O', async () => {
  const f = fixture(), m = await createManagedRecordedBriefRecoveryScheduler(f.client, config, f.close);
  for (const patch of [{ workflowId: originalId }, { type: 'projectRecordedBrief' }, { taskQueue: 'original' }, { runId: '' }, { status: { name: 'APPROVED' } }]) {
    f.behavior.describe = async () => ({ workflowId, runId, type: 'recoverRecordedBrief', taskQueue: 'recovery', status: { name: 'FAILED' }, ...patch });
    assert.deepEqual(await m.scheduler.inspect(), { workflowId, outcome: 'unknown' });
  }
  f.behavior.describe = async () => { throw new Error('Workflow not found: private'); };
  assert.deepEqual(await m.scheduler.inspect(), { workflowId, outcome: 'unknown' });
  const before = f.counts(); f.options.namespace = 'foreign';
  await assert.rejects(m.scheduler.start(), /binding changed/); await assert.rejects(m.scheduler.inspect(), /binding changed/);
  assert.deepEqual(f.counts(), before); await m.shutdown();
});
test('shutdown drains pending parent inspection, rejects overlap and closes the owned connection once', async () => {
  const f = fixture(); let release!: () => void;
  f.behavior.parent = () => new Promise((_, reject) => { release = () => reject(new Error('private uncertain parent')); });
  const m = await createManagedRecordedBriefRecoveryScheduler(f.client, config, f.close), pending = m.scheduler.start();
  await assert.rejects(m.scheduler.start(), /not accepting/); await assert.rejects(m.scheduler.inspect(), /not accepting/);
  const stopped = m.shutdown(); assert.equal(stopped, m.shutdown());
  assert.deepEqual(m.status(), { state: 'draining', active: true, attempted: true }); assert.equal(f.counts().closes, 0);
  release(); assert.deepEqual(await pending, { workflowId, outcome: 'unknown' }); await stopped;
  assert.equal(f.counts().closes, 1); assert.equal(m.status().state, 'stopped');
  await assert.rejects(m.scheduler.start(), /not accepting/);
});
test('invalid recovery configuration and cleanup failure cannot leak secrets or retain the transferred connection', async () => {
  for (const patch of [{ namespace: 'foreign' }, { taskQueue: 'original' }, { sourceTaskQueue: '' }, { plan: { ...plan, reset: true } }, { extra: true }]) {
    const f = fixture(); await assert.rejects(createManagedRecordedBriefRecoveryScheduler(f.client, { ...config, ...patch }, f.close), /^Error: Recorded Brief recovery scheduler could not be initialized\.$/);
    assert.deepEqual(f.counts(), { starts: 0, parents: 0, reads: 0, closes: 1 });
  }
  const f = fixture(); let closes = 0; const close = async () => { closes++; throw new Error('private close'); };
  await assert.rejects(createManagedRecordedBriefRecoveryScheduler(f.client, {}, close), /initialization cleanup could not be confirmed/);
  const m = await createManagedRecordedBriefRecoveryScheduler(f.client, config, close), stopped = m.shutdown();
  await assert.rejects(stopped, /^Error: Recorded Brief recovery scheduler shutdown could not be confirmed\.$/);
  assert.equal(stopped, m.shutdown()); assert.equal(closes, 2); assert.equal(m.status().state, 'failed');
});
test('namespace changes during parent inspection, start and status discard uncertain results without another attempt', async () => {
  for (const phase of ['parent', 'start', 'status']) {
    const f = fixture(), m = await createManagedRecordedBriefRecoveryScheduler(f.client, config, f.close);
    if (phase === 'parent') { const original = f.behavior.parent; f.behavior.parent = async () => { f.options.namespace = 'foreign'; return original(); }; }
    if (phase === 'start') f.behavior.start = async () => { f.options.namespace = 'foreign'; return { firstExecutionRunId: runId }; };
    if (phase === 'status') f.behavior.describe = async () => { f.options.namespace = 'foreign'; throw new WorkflowNotFoundError('private', workflowId, undefined); };
    assert.deepEqual(await (phase === 'status' ? m.scheduler.inspect() : m.scheduler.start()), { workflowId, outcome: 'unknown' });
    if (phase === 'parent') assert.equal(f.counts().starts, 0);
    await m.shutdown();
  }
});
