import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { WorkflowNotFoundError, type Client } from '@temporalio/client';
import { createDevelopmentSchedulerClient } from '../src/client.ts';

function fixture() {
  const target = { organizationId: 'org', operationId: randomUUID(), inputDigest: 'a'.repeat(64) };
  const input = { ...target, expiresAt: new Date(Date.now() + 3600000).toISOString() };
  const id = `steer-development/v1/org/${target.operationId}`, run = randomUUID(), config = { namespace: 'default', taskQueue: 'development' };
  const state = { exists: false, starts: 0, namespaceCalls: 0, retention: 86400, lost: false, historyMissing: false, payload: target,
    description: { workflowId: id, runId: run, type: 'developIntent', taskQueue: config.taskQueue, status: { name: 'RUNNING' } } };
  const client = { options: { namespace: config.namespace }, withDeadline: async (_deadline: number, work: () => Promise<unknown>) => work(),
    workflowService: {
      describeNamespace: async () => { state.namespaceCalls++; return { namespaceInfo: { name: config.namespace, state: 1 }, config: { workflowExecutionRetentionTtl: { seconds: state.retention } } }; },
      getWorkflowExecutionHistory: async (request: { maximumPageSize: number }) => {
        assert.equal(request.maximumPageSize, 1);
        if (state.historyMissing) throw new WorkflowNotFoundError('missing event', id, run);
        return { history: { events: [{ eventId: 1, workflowExecutionStartedEventAttributes: { workflowType: { name: 'developIntent' },
          taskQueue: { name: config.taskQueue }, workflowExecutionTimeout: { seconds: 480 }, input: { payloads: [{ metadata: { encoding: Buffer.from('json/plain') }, data: Buffer.from(JSON.stringify(state.payload)) }] } } }] } };
      },
    },
    workflow: {
      start: async (_name: string, options: any) => { state.starts++; assert.equal(options.workflowId, id); assert.deepEqual(options.args, [target]);
        assert.equal(options.workflowIdConflictPolicy, 'FAIL'); assert.equal(options.workflowIdReusePolicy, 'REJECT_DUPLICATE');
        state.exists = true; if (state.lost) throw new Error('private-lost-ack'); return { firstExecutionRunId: run }; },
      getHandle: () => ({ describe: async () => { if (!state.exists) throw new WorkflowNotFoundError('absent', id, undefined); return state.description; } }),
    },
  } as unknown as Client;
  const create = () => createDevelopmentSchedulerClient(client, config);
  return { input, state, client, create, id, run, config };
}
test('development scheduler verifies exact retained start and recovers after reconstruction with no second start', async () => {
  const f = fixture(); let checks = 0;
  const first = await f.create().start(f.input, async () => { checks++; });
  assert.deepEqual(first, { outcome: 'acknowledged', workflowId: f.id, runId: f.run, state: 'RUNNING' });
  f.state.description.status.name = 'COMPLETED';
  assert.deepEqual(await f.create().start(f.input, async () => {}), { ...first, state: 'COMPLETED' });
  assert.equal(f.state.starts, 1); assert.ok(checks >= 10);
});
test('lost start response stays unknown then exact existing history recovers without redispatch', async () => {
  const f = fixture(); f.state.lost = true;
  assert.deepEqual(await f.create().start(f.input, async () => {}), { outcome: 'unknown' });
  assert.equal((await f.create().start(f.input, async () => {})).outcome, 'acknowledged'); assert.equal(f.state.starts, 1);
});
test('retention below execution lifetime, expired input, lost authority and closed client never start work', async () => {
  const f = fixture(); f.state.retention = 86399;
  assert.equal((await f.create().start(f.input, async () => {})).outcome, 'unknown'); f.state.retention = 86400;
  assert.equal((await f.create().start({ ...f.input, expiresAt: new Date(0).toISOString() }, async () => {})).outcome, 'unknown');
  await f.create().start(f.input, async () => { throw new Error('denied'); });
  const closed = f.create(); closed.close(); assert.equal((await closed.start(f.input, async () => {})).outcome, 'unavailable');
  assert.equal(f.state.starts, 0);
});
test('foreign original input or workflow description cannot masquerade as an exact acknowledgement', async () => {
  for (const field of ['workflowId', 'type', 'taskQueue', 'runId']) {
    const f = fixture(); f.state.exists = true; (f.state.description as any)[field] = 'foreign';
    assert.equal((await f.create().start(f.input, async () => {})).outcome, 'unknown'); assert.equal(f.state.starts, 0);
  }
  const f = fixture(); f.state.exists = true; f.state.payload = { ...f.state.payload, inputDigest: 'b'.repeat(64) };
  assert.equal((await f.create().start(f.input, async () => {})).outcome, 'unknown'); assert.equal(f.state.starts, 0);
  f.state.payload = { ...f.state.payload, inputDigest: f.input.inputDigest }; f.state.historyMissing = true;
  assert.equal((await f.create().start(f.input, async () => {})).outcome, 'unknown'); assert.equal(f.state.starts, 0);
});
test('scheduler timeout retains admission until awaited authority drains; close prevents a late start', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); const f = fixture(), scheduler = f.create();
  let release!: () => void; const held = new Promise<void>(r => { release = r; });
  const pending = Array.from({ length: 4 }, () => scheduler.start(f.input, () => held));
  await Promise.resolve(); await Promise.resolve(); t.mock.timers.tick(30001);
  assert.ok((await Promise.all(pending)).every(r => r.outcome === 'unknown'));
  assert.equal((await scheduler.start(f.input, async () => {})).outcome, 'unavailable'); scheduler.close(); release();
  await new Promise(resolve => setImmediate(resolve)); assert.equal(f.state.starts, 0); assert.equal(f.state.namespaceCalls, 0);
});
