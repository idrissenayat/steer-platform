import assert from 'node:assert/strict';
import { DefaultLogger, Runtime, Worker } from '@temporalio/worker';
import { Client, Connection } from '@temporalio/client';
import type { createIdentityRuntime, ManagedRuntimeRecordedScheduler, ManagedRuntimeRecoveryScheduler } from '../../api/src/runtime.ts';
import { createWorkerRecordedBriefRuntime, createWorkerRecordedBriefRecoveryRuntime } from '../src/runtime.ts';
import { createRecordedBriefWorker, createRecordedBriefRecoveryWorker } from '../src/worker.ts';
import { startRecordedBriefProjection, createManagedRecordedBriefScheduler, createManagedRecordedBriefRecoveryScheduler,
  createRecordedBriefFailedParentGuard, startRecordedBriefRecovery } from '../src/client.ts';
import { recordedBriefWorkflowId, recordedBriefRecoveryWorkflowId, type RecordedBriefRecoveryPlan } from '../src/contracts.ts';
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
  }, recovery?: {
    subject: string;
    create: (managed: ManagedRuntimeRecoveryScheduler, plan: RecordedBriefRecoveryPlan) => Promise<Awaited<ReturnType<typeof createIdentityRuntime>>>;
    request: (name: 'recover' | 'recovery.status', plan: RecordedBriefRecoveryPlan, swapped?: boolean) => Promise<Request>;
    publish: (mode: 'allowed' | 'dispatch-only' | 'revoked') => Promise<void>;
  }) {
  assert.equal(options.source.path, 'items/0167-created-fixture/BRIEF.md');
  assert.equal(options.target.scope.itemId, 'items/0167-created-fixture');
  assert.notEqual(projector.subject, dispatch.subject); assert.notEqual(projector.subject, options.source.subject);
  if (recovery) for (const subject of [projector.subject, dispatch.subject, options.source.subject]) assert.notEqual(recovery.subject, subject);
  Runtime.install({ logger: new DefaultLogger('ERROR') });
  const fixture = await createIsolatedTemporalHarness(), queue = 'steer-0168-browser-created';
  let runtime: Awaited<ReturnType<typeof createWorkerRecordedBriefRuntime>> | undefined;
  let identity: Awaited<ReturnType<typeof createIdentityRuntime>> | undefined;
  let managed: Awaited<ReturnType<typeof createManagedRecordedBriefScheduler>> | undefined;
  let recoveryRuntime: Awaited<ReturnType<typeof createWorkerRecordedBriefRecoveryRuntime>> | undefined;
  let recoveryIdentity: Awaited<ReturnType<typeof createIdentityRuntime>> | undefined;
  let recoveryManaged: Awaited<ReturnType<typeof createManagedRecordedBriefRecoveryScheduler>> | undefined;
  let worker: Worker | undefined, running: Promise<void> | undefined, stopped = false, attempted = false, reads = 0;
  let revokeAfterReceipt = false;
  const configure = async () => {
    runtime = await createWorkerRecordedBriefRuntime(options, secrets, { ...ports, readReceipt: async () => {
      reads++; const receipt = await ports.readReceipt();
      if (revokeAfterReceipt) await projector.publish('revoked');
      return receipt;
    } });
  };
  const stopWorker = async () => {
    try { if (worker) { worker.shutdown(); await running; } }
    finally { worker = undefined; running = undefined;
      try { await runtime?.shutdown(); } finally { await recoveryRuntime?.shutdown(); } }
  };
  const close = async () => {
    if (stopped) return;
    try { await stopWorker(); }
    finally { try { await identity?.shutdown(); }
      finally { try { await managed?.shutdown(); }
        finally { try { await recoveryIdentity?.shutdown(); }
          finally { try { await recoveryManaged?.shutdown(); } finally { await fixture.close(); stopped = true; } } } } }
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
        // An actual authorized browser read completes, then native Git revocation
        // lands before the worker's post-receipt identity check or first SQL access.
        revokeAfterReceipt = true;
        await assert.rejects(runtime!.activities.projectRecordedBrief(options.target));
        assert.equal(reads, 1); assert.equal(runtime!.status().database.connections, 0);
        revokeAfterReceipt = false; await projector.publish('allowed');
        const absent = await call('status'); assert.equal(absent.status, 200); assert.equal((await absent.json()).outcome, 'not-found');
        const started = await call('start'); assert.equal(started.status, 200); assert.equal((await started.json()).outcome, 'started');
        const repeat = await call('start'); assert.equal(repeat.status, 200); assert.equal((await repeat.json()).outcome, 'already-attempted');
        const handle = fixture.environment.client.workflow.getHandle(recordedBriefWorkflowId(options.target));
        const originalRun = (await handle.describe()).runId;
        // Queued work must not consume browser access until a recreated runtime runs it.
        await stopWorker(); assert.equal(reads, 1); await configure();
        // Recovery mode fails the actual original activity only after reading the
        // browser-created receipt, with current projector revocation before SQL.
        revokeAfterReceipt = !!recovery;
        worker = await createRecordedBriefWorker({ connection: fixture.environment.nativeConnection, namespace: 'default', taskQueue: queue,
          workflowBundle: fixture.bundle }, runtime!.activities); running = worker.run();
        if (recovery) {
          await assert.rejects(handle.result());
          assert.equal((await handle.describe()).status.name, 'FAILED');
          assert.equal(reads, 2); assert.equal(runtime!.status().database.connections, 0);
          await stopWorker(); revokeAfterReceipt = false; await projector.publish('allowed');
          const plan = { target: options.target, failedRunId: originalRun };
          const configuration = { namespace: 'default', sourceTaskQueue: queue, taskQueue: 'steer-0185-browser-recovery', plan };
          let closedConnections = 0;
          const configureRecoveryIdentity = async () => {
            const connection = await Connection.connect({ address: fixture.environment.address });
            recoveryManaged = await createManagedRecordedBriefRecoveryScheduler(new Client({ connection, namespace: 'default' }), configuration,
              async () => { await connection.close(); closedConnections++; });
            recoveryIdentity = await recovery.create(recoveryManaged, plan);
            assert.equal(recoveryIdentity.status().database.connections, 0);
          };
          await configureRecoveryIdentity();
          const request = async (name: 'recover' | 'recovery.status', selected = plan, swapped = false) => recoveryIdentity!.fetch(await recovery.request(name, selected, swapped));
          assert.equal((await (await request('recovery.status')).json()).outcome, 'not-found');
          assert.equal((await request('recover', plan, true)).status, 401);
          assert.equal((await request('recover', { ...plan, failedRunId: '18500000-0000-4000-8000-000000000099' })).status, 403);
          await recovery.publish('dispatch-only'); assert.equal((await request('recover')).status, 403);
          assert.equal(recoveryManaged!.status().attempted, false); assert.equal(reads, 2);
          await recovery.publish('allowed');
          const started = await request('recover'); assert.equal(started.status, 200); assert.equal((await started.json()).outcome, 'started');
          assert.equal((await (await request('recover')).json()).outcome, 'already-attempted');
          await recoveryIdentity!.shutdown(); assert.equal(closedConnections, 1);
          await configureRecoveryIdentity();
          assert.equal((await (await request('recover')).json()).outcome, 'duplicate'); assert.equal(reads, 2);
          const parent = createRecordedBriefFailedParentGuard(fixture.environment.client, { namespace: 'default', taskQueue: queue, plan });
          const configureRecoveryWorker = async () => {
            recoveryRuntime = await createWorkerRecordedBriefRecoveryRuntime({ plan, database: options.database, source: options.source }, secrets,
              { ...ports, parent, readReceipt: async () => { reads++; return ports.readReceipt(); } });
          };
          await configureRecoveryWorker(); await recoveryRuntime!.shutdown(); await configureRecoveryWorker();
          await projector.publish('revoked'); await assert.rejects(recoveryRuntime!.activities.recoverRecordedBrief(plan));
          assert.equal(reads, 2); assert.equal(recoveryRuntime!.status().database.connections, 0); await projector.publish('allowed');
          worker = await createRecordedBriefRecoveryWorker({ connection: fixture.environment.nativeConnection, namespace: 'default',
            taskQueue: configuration.taskQueue, workflowBundle: fixture.bundle }, recoveryRuntime!.activities); running = worker.run();
          const recovered = fixture.environment.client.workflow.getHandle(recordedBriefRecoveryWorkflowId(plan));
          assert.deepEqual(await recovered.result(), { revision, status: 'observed', outcome: 'applied' });
          assert.equal((await (await request('recovery.status')).json()).state, 'COMPLETED');
          assert.equal((await handle.describe()).status.name, 'FAILED'); assert.equal((await handle.describe()).runId, originalRun);
          assert.equal(reads, 3);
          for (const [execution, id] of [[handle, recordedBriefWorkflowId(options.target)], [recovered, recordedBriefRecoveryWorkflowId(plan)]] as const) {
            const history = await execution.fetchHistory(), text = historyText(history);
            for (const value of [options.source.subject, dispatch.subject, projector.subject, recovery.subject, secrets.databasePassword,
              'Browser-created request', 'Requests are entered twice.', 'synthetic-browser-write']) assert.equal(text.includes(value), false);
            await Worker.runReplayHistory({ workflowBundle: fixture.bundle }, history, id);
          }
          await assert.rejects(startRecordedBriefProjection(fixture.environment.client, queue, options.target));
          await assert.rejects(startRecordedBriefRecovery(fixture.environment.client, configuration)); assert.equal(reads, 3);
          await recovery.publish('revoked'); assert.equal((await request('recover')).status, 401); assert.equal((await request('recovery.status')).status, 401);
          const principal = await ports.authenticate() as { subject: string } | null; assert.equal(principal?.subject, projector.subject);
          await recoveryIdentity!.shutdown(); assert.equal(closedConnections, 2);
          console.log('Browser-created receipt recovered once; original run remains FAILED; separate Keycloak actors, reconstruction and replay verified.');
          return;
        }
        assert.deepEqual(await handle.result(), { revision, status: 'observed', outcome: 'applied' });
        const complete = await call('status'); assert.equal(complete.status, 200); assert.equal((await complete.json()).state, 'COMPLETED');
        await dispatch.publish('revoked'); assert.equal((await call('status')).status, 401);
        await dispatch.publish('allowed'); assert.equal((await call('status')).status, 200);
        assert.equal(reads, 2); assert.equal((await handle.describe()).runId, originalRun);
        const history = await handle.fetchHistory(), text = historyText(history);
        for (const privateValue of [options.source.subject, dispatch.subject, projector.subject, secrets.databasePassword, 'Browser-created request', 'Requests are entered twice.', 'synthetic-browser-write']) {
          assert.equal(text.includes(privateValue), false);
        }
        await Worker.runReplayHistory({ workflowBundle: fixture.bundle }, history, recordedBriefWorkflowId(options.target));
        assert.equal(reads, 2);
        await assert.rejects(startRecordedBriefProjection(fixture.environment.client, queue, options.target));
        assert.equal(reads, 2);
        await projector.publish('revoked'); await assert.rejects(runtime!.activities.projectRecordedBrief(options.target));
        assert.equal(reads, 2); await projector.publish('allowed');
      }, close,
    };
  } catch (error) { await close(); throw error; }
}
