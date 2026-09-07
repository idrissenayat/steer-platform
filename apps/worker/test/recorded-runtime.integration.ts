import assert from 'node:assert/strict';
import { Client, Connection } from '@temporalio/client';
import type { TestWorkflowEnvironment } from '@temporalio/testing';
import type { WorkflowBundle } from '@temporalio/worker';
import { createIdentityRuntime } from '../../api/src/runtime.ts';
import { recordedRuntimeFixture } from '../../api/test/recorded-runtime-fixture.ts';
import { createManagedRecordedBriefScheduler } from '../src/client.ts';
import { createRecordedBriefWorker } from '../src/worker.ts';
import { createRecordedBriefActivities } from '../src/activities.ts';

/** Actual signed OIDC/native Git membership -> API runtime -> Temporal. The activity
 * result is explicitly synthetic; real Git/PostgreSQL projection has separate checks. */
export async function testRecordedIdentityRuntime(env: TestWorkflowEnvironment, bundle: WorkflowBundle,
  check: (name: string, run: () => Promise<void>) => Promise<void>) {
  const cleanup: (() => void)[] = [];
  let runtime: Awaited<ReturnType<typeof createIdentityRuntime>> | undefined;
  let worker: Awaited<ReturnType<typeof createRecordedBriefWorker>> | undefined, running: Promise<void> | undefined;
  let managed: Awaited<ReturnType<typeof createManagedRecordedBriefScheduler>> | undefined;
  try {
    const f = await recordedRuntimeFixture({ after: run => { cleanup.push(run); } });
    const connection = await Connection.connect({ address: env.address }); let closed = 0, activityCalls = 0;
    managed = await createManagedRecordedBriefScheduler(new Client({ connection, namespace: 'default' }),
      { namespace: 'default', taskQueue: 'steer-0176-runtime', target: f.target }, async () => { await connection.close(); closed++; });
    runtime = await createIdentityRuntime(f.profile, f.secrets, { ...f.ports, createRecordedScheduler: async () => managed! });
    const owned = runtime;
    await check('signed OIDC and native Git grants dispatch through the actual owned API-to-Temporal runtime and close only its connection', async () => {
      assert.equal(owned.status().database.connections, 0); assert.deepEqual(f.counts(), { jwks: 0, assertions: 0 });
      const first = await owned.fetch(f.request('status')); assert.equal(first.status, 200); assert.equal((await first.json()).outcome, 'not-found');
      f.publish({ ...f.grant, toolGrants: ['projection.ingest'] });
      assert.equal((await owned.fetch(f.request('start'))).status, 403); assert.equal(managed!.status().attempted, false);
      f.publish();
      const started = await owned.fetch(f.request('start')); assert.equal(started.status, 200); assert.equal((await started.json()).outcome, 'started');
      assert.equal((await (await owned.fetch(f.request('start'))).json()).outcome, 'already-attempted');
      const checkpoint = { revision: f.source.head(), status: 'different-revision', outcome: null };
      worker = await createRecordedBriefWorker({ connection: env.nativeConnection, namespace: 'default', taskQueue: 'steer-0176-runtime', workflowBundle: bundle },
        createRecordedBriefActivities(f.target, { runOnce: async () => { activityCalls++; return checkpoint; } }));
      running = worker.run();
      assert.deepEqual(await env.client.workflow.getHandle(f.workflowId).result(), checkpoint); assert.equal(activityCalls, 1);
      const observed = await owned.fetch(f.request('status')); assert.equal(observed.status, 200); assert.equal((await observed.json()).state, 'COMPLETED');
      f.publish({ ...f.grant, active: false }); assert.equal((await owned.fetch(f.request('status'))).status, 401);
      assert.equal(f.source.mutations(), 0); assert.ok(f.counts().jwks > 0 && f.counts().assertions > 0);
      await owned.shutdown(); assert.equal(closed, 1); assert.equal(managed!.status().state, 'stopped'); assert.equal(owned.status().database.closed, true);
      const reads = f.source.calls.length; assert.equal((await owned.fetch(f.request('status'))).status, 503); assert.equal(f.source.calls.length, reads);
      await assert.rejects(connection.workflowService.describeWorkflowExecution({ namespace: 'default', execution: { workflowId: f.workflowId } }));
      assert.equal((await env.client.workflow.getHandle(f.workflowId).describe()).status.name, 'COMPLETED');
    });
  } finally {
    try { if (worker) { worker.shutdown(); await running; } }
    finally { try { await runtime?.shutdown(); } finally { try { await managed?.shutdown(); } finally { for (const close of cleanup.reverse()) close(); } } }
  }
}
