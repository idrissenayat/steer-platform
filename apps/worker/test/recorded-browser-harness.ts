import assert from 'node:assert/strict';
import { DefaultLogger, Runtime, Worker } from '@temporalio/worker';
import { Client, Connection } from '@temporalio/client';
import type { createIdentityRuntime, ManagedRuntimeRecordedScheduler } from '../../api/src/runtime.ts';
import { createWorkerRecordedBriefRuntime } from '../src/runtime.ts';
import { createRecordedBriefWorker } from '../src/worker.ts';
import { startRecordedBriefProjection, createManagedRecordedBriefScheduler } from '../src/client.ts';
import { recordedBriefWorkflowId } from '../src/contracts.ts';
import { createIsolatedTemporalHarness } from './isolated-temporal-harness.ts';

function historyText(value: unknown): string {
  if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8');
  if (value && typeof value === 'object') return Object.values(value).map(historyText).join('\n');
  return typeof value === 'string' ? value : '';
}

/** TEST ONLY. The caller owns disposable Git/Postgres and a current browser status callback. */
export async function createRecordedBrowserHarness(options: { target: { scope: { organizationId: string; repository: string; itemId: string }; idempotencyKey: string };
  database: unknown; source: { branch: string; path: string; subject: string } }, secrets: { databasePassword: string },
  ports: Parameters<typeof createWorkerRecordedBriefRuntime>[2], dispatch: {
    subject: string;
    create: (managed: ManagedRuntimeRecordedScheduler) => Promise<Awaited<ReturnType<typeof createIdentityRuntime>>>;
    request: (name: 'start' | 'status') => Promise<Request>;
    publish: (mode: 'allowed' | 'projection-only' | 'revoked') => Promise<void>;
  }, projector: {
    subject: string;
    publish: (mode: 'allowed' | 'dispatch-only' | 'revoked' | 'invalid-token' | 'dispatcher-token') => Promise<void>;
  }) {
  assert.equal(options.source.path, 'items/0167-created-fixture/BRIEF.md');
  assert.equal(options.target.scope.itemId, 'items/0167-created-fixture');
  assert.notEqual(projector.subject, dispatch.subject); assert.notEqual(projector.subject, options.source.subject);
  Runtime.install({ logger: new DefaultLogger('ERROR') });
  const fixture = await createIsolatedTemporalHarness(), queue = 'steer-0168-browser-created';
  let runtime: Awaited<ReturnType<typeof createWorkerRecordedBriefRuntime>> | undefined;
  let identity: Awaited<ReturnType<typeof createIdentityRuntime>> | undefined;
  let managed: Awaited<ReturnType<typeof createManagedRecordedBriefScheduler>> | undefined;
  let worker: Worker | undefined, running: Promise<void> | undefined, stopped = false, attempted = false, reads = 0;
  const configure = async () => {
    runtime = await createWorkerRecordedBriefRuntime(options, secrets, { ...ports, readReceipt: async () => { reads++; return ports.readReceipt(); } });
  };
  const stopWorker = async () => {
    try { if (worker) { worker.shutdown(); await running; } }
    finally { worker = undefined; running = undefined; await runtime?.shutdown(); }
  };
  const close = async () => {
    if (stopped) return;
    try { await stopWorker(); }
    finally { try { await identity?.shutdown(); }
      finally { try { await managed?.shutdown(); } finally { await fixture.close(); stopped = true; } } }
    console.log('Closed only owned browser-projection Temporal worker/server and generated test binary files.');
  };
  try {
    await configure();
    const connection = await Connection.connect({ address: fixture.environment.address });
    managed = await createManagedRecordedBriefScheduler(new Client({ connection, namespace: 'default' }),
      { namespace: 'default', taskQueue: queue, target: options.target }, () => connection.close());
    identity = await dispatch.create(managed);
    assert.equal(identity.status().database.connections, 0);
    const call = async (name: 'start' | 'status') => identity!.fetch(await dispatch.request(name));
    return {
      async project(revision: string) {
        assert.equal(stopped || attempted, false); attempted = true;
        await dispatch.publish('projection-only'); assert.equal((await call('start')).status, 403);
        assert.equal(managed!.status().attempted, false); assert.equal(reads, 0);
        await dispatch.publish('allowed');
        for (const mode of ['dispatch-only', 'revoked', 'invalid-token', 'dispatcher-token'] as const) {
          await projector.publish(mode);
          await assert.rejects(runtime!.activities.projectRecordedBrief(options.target));
          assert.equal(reads, 0); assert.equal(runtime!.status().database.connections, 0);
        }
        await projector.publish('allowed');
        const absent = await call('status'); assert.equal(absent.status, 200); assert.equal((await absent.json()).outcome, 'not-found');
        const started = await call('start'); assert.equal(started.status, 200); assert.equal((await started.json()).outcome, 'started');
        const repeat = await call('start'); assert.equal(repeat.status, 200); assert.equal((await repeat.json()).outcome, 'already-attempted');
        const handle = fixture.environment.client.workflow.getHandle(recordedBriefWorkflowId(options.target));
        const originalRun = (await handle.describe()).runId;
        // Queued work must not consume browser access until a recreated runtime runs it.
        await stopWorker(); assert.equal(reads, 0); await configure();
        worker = await createRecordedBriefWorker({ connection: fixture.environment.nativeConnection, namespace: 'default', taskQueue: queue,
          workflowBundle: fixture.bundle }, runtime!.activities); running = worker.run();
        assert.deepEqual(await handle.result(), { revision, status: 'observed', outcome: 'applied' });
        const complete = await call('status'); assert.equal(complete.status, 200); assert.equal((await complete.json()).state, 'COMPLETED');
        await dispatch.publish('revoked'); assert.equal((await call('status')).status, 401);
        await dispatch.publish('allowed'); assert.equal((await call('status')).status, 200);
        assert.equal(reads, 1); assert.equal((await handle.describe()).runId, originalRun);
        const history = await handle.fetchHistory(), text = historyText(history);
        for (const privateValue of [options.source.subject, dispatch.subject, projector.subject, secrets.databasePassword, 'Browser-created request', 'Requests are entered twice.', 'synthetic-browser-write']) {
          assert.equal(text.includes(privateValue), false);
        }
        await Worker.runReplayHistory({ workflowBundle: fixture.bundle }, history, recordedBriefWorkflowId(options.target));
        assert.equal(reads, 1);
        await assert.rejects(startRecordedBriefProjection(fixture.environment.client, queue, options.target));
        assert.equal(reads, 1);
        await projector.publish('revoked'); await assert.rejects(runtime!.activities.projectRecordedBrief(options.target));
        assert.equal(reads, 1); await projector.publish('allowed');
      }, close,
    };
  } catch (error) { await close(); throw error; }
}
