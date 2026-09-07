import assert from 'node:assert/strict';
import test from 'node:test';
import { type Client, WorkflowExecutionAlreadyStartedError, WorkflowNotFoundError } from '@temporalio/client';
import { createManagedRecordedBriefScheduler } from '../src/client.ts';
import { recordedBriefWorkflowId } from '../src/contracts.ts';

const target = { scope: { organizationId: 'synthetic-org', repository: 'github:1', itemId: 'intent/0174' }, idempotencyKey: '17400000-0000-4000-8000-000000000001' };
const config = { namespace: 'default', taskQueue: 'synthetic-recorded', target };
const workflowId = recordedBriefWorkflowId(target), runId = '17400000-0000-4000-8000-000000000002';
function fixture() {
  let starts = 0, reads = 0, closes = 0;
  const behavior = { start: async (): Promise<unknown> => ({ firstExecutionRunId: runId }),
    describe: async (): Promise<unknown> => ({ workflowId, runId, type: 'projectRecordedBrief', taskQueue: config.taskQueue, status: { name: 'RUNNING' } }) };
  const client = { options: { namespace: 'default' }, workflow: {
    start: async (name: string, options: { taskQueue: string; workflowId: string; args: unknown[] }) => {
      starts++; assert.equal(name, 'projectRecordedBrief'); assert.equal(options.taskQueue, config.taskQueue);
      assert.equal(options.workflowId, workflowId); assert.deepEqual(options.args, [target]); return behavior.start();
    }, getHandle: (id: string) => { assert.equal(id, workflowId); return { describe: async () => { reads++; return behavior.describe(); } }; },
  } };
  return { client: client as unknown as Client, options: client.options, behavior,
    close: async () => { closes++; }, counts: () => ({ starts, reads, closes }) };
}
test('fixed operation snapshots configuration and permits only one explicit dispatch, with manual status separate from completion', async () => {
  const f = fixture(), supplied = structuredClone(config);
  const m = await createManagedRecordedBriefScheduler(f.client, supplied, f.close);
  supplied.target.scope.itemId = 'foreign'; supplied.target.idempotencyKey = runId; supplied.taskQueue = 'foreign';
  assert.equal(Object.isFrozen(m.scheduler.target.scope), true);
  assert.deepEqual(f.counts(), { starts: 0, reads: 0, closes: 0 });
  assert.deepEqual(await m.scheduler.start(), { workflowId, outcome: 'started', runId });
  assert.deepEqual(await m.scheduler.start(), { workflowId, outcome: 'already-attempted' });
  assert.deepEqual(await m.scheduler.inspect(), { workflowId, outcome: 'found', runId, state: 'RUNNING' });
  await m.shutdown(); assert.deepEqual(f.counts(), { starts: 1, reads: 1, closes: 1 });
});
test('uncertain dispatch and typed duplicate remain distinct, and neither unknown nor absence unlocks a second start', async () => {
  for (const error of [new Error('private lost acknowledgment'), new WorkflowExecutionAlreadyStartedError('private', workflowId, 'projectRecordedBrief')]) {
    const f = fixture(); f.behavior.start = async () => { throw error; };
    f.behavior.describe = async () => { throw new WorkflowNotFoundError('private', workflowId, undefined); };
    const m = await createManagedRecordedBriefScheduler(f.client, config, f.close);
    assert.deepEqual(await m.scheduler.start(), { workflowId, outcome: error instanceof WorkflowExecutionAlreadyStartedError ? 'duplicate' : 'unknown' });
    assert.deepEqual(await m.scheduler.inspect(), { workflowId, outcome: 'not-found' });
    assert.deepEqual(await m.scheduler.start(), { workflowId, outcome: 'already-attempted' });
    await m.shutdown(); assert.equal(f.counts().starts, 1);
  }
});
test('malformed upstream metadata and untyped absence return only unknown; namespace drift denies before I/O', async () => {
  const f = fixture(), m = await createManagedRecordedBriefScheduler(f.client, config, f.close);
  f.behavior.start = async () => ({ firstExecutionRunId: 'private-invalid' });
  assert.deepEqual(await m.scheduler.start(), { workflowId, outcome: 'unknown' });
  for (const patch of [{ workflowId: 'foreign' }, { type: 'other' }, { taskQueue: 'foreign' }, { runId: '' }, { status: { name: 'private-unknown' } }]) {
    f.behavior.describe = async () => ({ workflowId, runId, type: 'projectRecordedBrief', taskQueue: config.taskQueue, status: { name: 'RUNNING' }, ...patch });
    assert.deepEqual(await m.scheduler.inspect(), { workflowId, outcome: 'unknown' });
  }
  f.behavior.describe = async () => { throw new Error('Workflow not found: private'); };
  assert.deepEqual(await m.scheduler.inspect(), { workflowId, outcome: 'unknown' });
  const before = f.counts(); f.options.namespace = 'foreign'; await assert.rejects(m.scheduler.inspect(), /binding changed/);
  assert.deepEqual(f.counts(), before); await m.shutdown();
});
test('single-flight admission and owned shutdown drain an uncertain dispatch before closing once', async () => {
  const f = fixture(); let release!: () => void;
  f.behavior.start = () => new Promise((_, reject) => { release = () => reject(new Error('private late result')); });
  const m = await createManagedRecordedBriefScheduler(f.client, config, f.close), pending = m.scheduler.start();
  await assert.rejects(m.scheduler.start(), /not accepting/); await assert.rejects(m.scheduler.inspect(), /not accepting/);
  const stopped = m.shutdown(); assert.equal(stopped, m.shutdown());
  assert.deepEqual(m.status(), { state: 'draining', active: true, attempted: true }); assert.equal(f.counts().closes, 0);
  release(); assert.deepEqual(await pending, { workflowId, outcome: 'unknown' }); await stopped;
  assert.deepEqual(m.status(), { state: 'stopped', active: false, attempted: true }); assert.equal(f.counts().closes, 1);
  await assert.rejects(m.scheduler.start(), /not accepting/); await assert.rejects(m.scheduler.inspect(), /not accepting/);
});
test('strict initialization and closure failures release only the supplied connection and stay sanitized', async () => {
  for (const patch of [{ namespace: 'foreign' }, { taskQueue: '' }, { target: { ...target, authority: true } }, { extra: true }]) {
    const f = fixture(); await assert.rejects(createManagedRecordedBriefScheduler(f.client, { ...config, ...patch }, f.close), /^Error: Recorded Brief scheduler could not be initialized\.$/);
    assert.deepEqual(f.counts(), { starts: 0, reads: 0, closes: 1 });
  }
  const f = fixture(); let closed = 0; const close = async () => { closed++; throw new Error('private close'); };
  await assert.rejects(createManagedRecordedBriefScheduler(f.client, {}, close), /initialization cleanup could not be confirmed/);
  const m = await createManagedRecordedBriefScheduler(f.client, config, close), stopped = m.shutdown();
  await assert.rejects(stopped, /^Error: Recorded Brief scheduler shutdown could not be confirmed\.$/);
  assert.equal(stopped, m.shutdown()); assert.equal(closed, 2); assert.equal(m.status().state, 'failed');
});
test('namespace changes during start or inspection do not release a result from the prior binding', async () => {
  for (const operation of ['start', 'inspect'] as const) {
    const f = fixture(), m = await createManagedRecordedBriefScheduler(f.client, config, f.close);
    if (operation === 'start') f.behavior.start = async () => { f.options.namespace = 'foreign'; return { firstExecutionRunId: runId }; };
    else f.behavior.describe = async () => { f.options.namespace = 'foreign'; throw new WorkflowNotFoundError('private', workflowId, undefined); };
    assert.deepEqual(await m.scheduler[operation](), { workflowId, outcome: 'unknown' });
    await m.shutdown();
  }
});
