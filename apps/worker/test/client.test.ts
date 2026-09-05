import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type Client, WorkflowNotFoundError, WorkflowExecutionAlreadyStartedError } from '@temporalio/client';
import { createReconciliationSchedulerClient } from '../src/client.ts';

const scope = { organizationId: 'org-a', repository: 'github:1', itemId: 'intent/0039' };
const config = { namespace: 'default', taskQueue: 'synthetic-queue', scope, maxRounds: 2, minIntervalMs: 2000 };
const request = { ...scope, rounds: 1, intervalMs: 2000 };
const runId = '00000000-0000-4000-8000-000000000039';

test('scheduler snapshots fixed namespace, queue, scope and limits and refuses caller scope drift', async () => {
  let calls = 0;
  const client = { options: { namespace: 'default' }, workflow: { start: async (name: string, options: { taskQueue: string; workflowId: string; args: unknown[] }) => {
    calls++; assert.equal(name, 'reconcileItem'); assert.equal(options.taskQueue, config.taskQueue);
    assert.deepEqual(options.args, [{ scope, rounds: 1, intervalMs: 2000 }]);
    return { firstExecutionRunId: runId };
  } } } as unknown as Client;
  const supplied = { ...config, scope: { ...scope } }; const scheduler = createReconciliationSchedulerClient(client, supplied);
  supplied.taskQueue = 'foreign'; supplied.scope.itemId = 'foreign'; supplied.maxRounds = 100;
  assert.deepEqual(await scheduler.start(request), { workflowId: scheduler.workflowId, outcome: 'started', runId });
  for (const change of [{ organizationId: 'foreign' }, { repository: 'github:2' }, { itemId: 'other' }, { rounds: 3 }, { intervalMs: 1000 }]) {
    await assert.rejects(scheduler.start({ ...request, ...change }));
  }
  for (const change of [{ namespace: 'foreign' }, { taskQueue: '' }, { maxRounds: 0 }, { minIntervalMs: 999 }]) {
    assert.throws(() => createReconciliationSchedulerClient(client, { ...config, ...change }));
  }
  assert.equal(calls, 1);
});

test('scheduler recognizes only typed Temporal duplicate and absence errors; all other outcomes stay unknown', async () => {
  let failure: Error = new Error('private response lost'); let calls = 0;
  const client = { options: { namespace: 'default' }, workflow: {
    start: async () => { calls++; throw failure; },
    getHandle: () => ({ describe: async () => { throw failure; } }),
  } } as unknown as Client;
  const scheduler = createReconciliationSchedulerClient(client, config);
  assert.deepEqual(await scheduler.start(request), { workflowId: scheduler.workflowId, outcome: 'unknown' });
  assert.deepEqual(await scheduler.inspect(), { workflowId: scheduler.workflowId, outcome: 'unknown' });
  failure = new WorkflowExecutionAlreadyStartedError('private', scheduler.workflowId, 'reconcileItem');
  assert.deepEqual(await scheduler.start(request), { workflowId: scheduler.workflowId, outcome: 'duplicate' });
  failure = new WorkflowNotFoundError('private', scheduler.workflowId, undefined);
  assert.deepEqual(await scheduler.inspect(), { workflowId: scheduler.workflowId, outcome: 'not-found' });
  assert.equal(calls, 2);
});
