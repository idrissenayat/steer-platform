import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type Client, WorkflowNotFoundError, WorkflowExecutionAlreadyStartedError } from '@temporalio/client';
import { createReconciliationSchedulerClient, createManagedReconciliationScheduler } from '../src/client.ts';

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

test('managed scheduler bounds admission and waits for actual operations before closing its connection once', async () => {
  let release!: () => void; let closed = 0, calls = 0;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const client = { options: { namespace: 'default' }, workflow: { start: async () => { calls++; await blocked; return { firstExecutionRunId: runId }; } } } as unknown as Client;
  const managed = await createManagedReconciliationScheduler(client, config, async () => { closed++; });
  const pending = Array.from({ length: 8 }, () => managed.scheduler.start(request));
  try {
    await assert.rejects(managed.scheduler.start(request), /not accepting/); assert.equal(calls, 8);
    const stop = managed.shutdown(); assert.equal(stop, managed.shutdown());
    await Promise.resolve(); assert.equal(closed, 0); assert.deepEqual(managed.status(), { state: 'draining', active: 8 });
    await assert.rejects(managed.scheduler.inspect(), /not accepting/);
    release(); assert.ok((await Promise.all(pending)).every((receipt) => receipt.outcome === 'started'));
    await stop; assert.equal(closed, 1); assert.deepEqual(managed.status(), { state: 'stopped', active: 0 });
  } finally { release(); await Promise.allSettled(pending); await managed.shutdown(); }
});

test('managed scheduler cleans failed initialization and never retries failed connection closure', async () => {
  const client = { options: { namespace: 'default' } } as Client; let closed = 0;
  await assert.rejects(createManagedReconciliationScheduler(client, { ...config, namespace: 'foreign' }, async () => { closed++; }), /^Error: Scheduler could not be initialized\.$/);
  assert.equal(closed, 1);
  await assert.rejects(createManagedReconciliationScheduler(client, { ...config, namespace: 'foreign' }, async () => { throw new Error('private'); }), /^Error: Scheduler initialization cleanup could not be confirmed\.$/);
  const managed = await createManagedReconciliationScheduler(client, config, async () => { closed++; throw new Error('private'); });
  const stop = managed.shutdown(); await assert.rejects(stop, /^Error: Scheduler shutdown could not be confirmed\.$/);
  assert.equal(stop, managed.shutdown()); assert.equal(closed, 2); assert.deepEqual(managed.status(), { state: 'failed', active: 0 });
  await assert.rejects(managed.scheduler.start(request), /not accepting/);
});
