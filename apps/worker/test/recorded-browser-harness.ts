import assert from 'node:assert/strict';
import { DefaultLogger, Runtime, Worker } from '@temporalio/worker';
import { createWorkerRecordedBriefRuntime } from '../src/runtime.ts';
import { createRecordedBriefWorker } from '../src/worker.ts';
import { startRecordedBriefProjection } from '../src/client.ts';
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
  ports: Parameters<typeof createWorkerRecordedBriefRuntime>[2]) {
  assert.equal(options.source.path, 'items/0167-created-fixture/BRIEF.md');
  assert.equal(options.target.scope.itemId, 'items/0167-created-fixture');
  Runtime.install({ logger: new DefaultLogger('ERROR') });
  const fixture = await createIsolatedTemporalHarness(), queue = 'steer-0168-browser-created';
  let runtime: Awaited<ReturnType<typeof createWorkerRecordedBriefRuntime>> | undefined;
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
    try { await stopWorker(); } finally { await fixture.close(); stopped = true; }
    console.log('Closed only owned browser-projection Temporal worker/server and generated test binary files.');
  };
  try {
    await configure();
    return {
      async project(revision: string) {
        assert.equal(stopped || attempted, false); attempted = true;
        const handle = await startRecordedBriefProjection(fixture.environment.client, queue, options.target);
        const originalRun = (await handle.describe()).runId;
        // Queued work must not consume browser access until a recreated runtime runs it.
        await stopWorker(); assert.equal(reads, 0); await configure();
        worker = await createRecordedBriefWorker({ connection: fixture.environment.nativeConnection, namespace: 'default', taskQueue: queue,
          workflowBundle: fixture.bundle }, runtime!.activities); running = worker.run();
        assert.deepEqual(await handle.result(), { revision, status: 'observed', outcome: 'applied' });
        assert.equal(reads, 1); assert.equal((await handle.describe()).runId, originalRun);
        const history = await handle.fetchHistory(), text = historyText(history);
        for (const privateValue of [options.source.subject, secrets.databasePassword, 'Browser-created request', 'Requests are entered twice.', 'synthetic-browser-write']) {
          assert.equal(text.includes(privateValue), false);
        }
        await Worker.runReplayHistory({ workflowBundle: fixture.bundle }, history, recordedBriefWorkflowId(options.target));
        assert.equal(reads, 1);
        await assert.rejects(startRecordedBriefProjection(fixture.environment.client, queue, options.target));
        assert.equal(reads, 1);
      }, close,
    };
  } catch (error) { await close(); throw error; }
}
