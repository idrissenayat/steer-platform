import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { bundleWorkflowCode, DefaultLogger, Runtime, Worker } from '@temporalio/worker';
import { createReconciliationWorker } from '../src/worker.ts';
import { startReconciliation } from '../src/client.ts';
import { workflowId } from '../src/contracts.ts';

// Exact official test binary, no real cluster, OS installation or persistent database.
const version = '1.8.3';
const archives: Record<string, { name: string; digest: string }> = {
  'darwin-arm64': { name: 'darwin_arm64', digest: '77c5bef1753ddfcdcaced2a2d44207aeced1c776e7bcbf94520c7911bd0c4080' },
  'darwin-x64': { name: 'darwin_amd64', digest: '0eed9a02008ba0d1c5417fc1aa706c9016166eae7216ae161ad95eccc6a775ca' },
  'linux-arm64': { name: 'linux_arm64', digest: '5972ce781d7f28644b353e4177007e7da8e48a316b8458267054b24de2308e09' },
  'linux-x64': { name: 'linux_amd64', digest: '6f0afac1e9ddea71f480c43a49f5db5167a244c21db923707f069a79bcabdfea' },
};
const binary = archives[`${process.platform}-${process.arch}`]; assert.ok(binary, 'Unsupported isolated Temporal fixture platform.');
const temporary = await mkdtemp(join(tmpdir(), 'steer-temporal-0036-'));
const exec = promisify(execFile); let environment: TestWorkflowEnvironment | undefined;
let worker: Worker | undefined; let running: Promise<void> | undefined;
let passed = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); passed++; console.log(`PASS ${name}`); };
const scope = { organizationId: 'synthetic-org', repository: 'github:1', itemId: 'intent/0001' };
const queue = 'steer-0036-isolated'; let calls = 0; let fail = false;
function historyText(value: unknown): string {
  if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8');
  if (value && typeof value === 'object') return Object.values(value).map(historyText).join('\n');
  return typeof value === 'string' ? value : '';
}
const port = { runOnce: async () => {
  calls++; if (fail) throw new Error('private synthetic provider failure');
  return { revision: 'a'.repeat(40), status: 'reconciled' as const, outcomes: [{ content: 'synthetic-private-content' }] };
} };
Runtime.install({ logger: new DefaultLogger('ERROR') });
try {
  const archive = join(temporary, 'temporal.tar.gz');
  await exec('curl', ['--fail', '--silent', '--show-error', '--location', '--max-time', '60', '--output', archive,
    `https://github.com/temporalio/cli/releases/download/v${version}/temporal_cli_${version}_${binary.name}.tar.gz`], { timeout: 65000 });
  assert.equal(createHash('sha256').update(await readFile(archive)).digest('hex'), binary.digest);
  await exec('tar', ['-xzf', archive, '-C', temporary, 'temporal'], { timeout: 10000 });
  console.log((await exec(join(temporary, 'temporal'), ['--version'])).stdout.trim());
  environment = await TestWorkflowEnvironment.createLocal({ server: { executable: { type: 'existing-path', path: join(temporary, 'temporal') },
    ip: '127.0.0.1', ui: false, log: { format: 'json', level: 'error' } } });
  const env = environment;
  const bundle = await bundleWorkflowCode({ workflowsPath: fileURLToPath(new URL('../src/workflows.ts', import.meta.url)), logger: new DefaultLogger('ERROR') });
  const startWorker = async () => {
    worker = await createReconciliationWorker({ connection: env.nativeConnection, namespace: 'default', taskQueue: queue, workflowBundle: bundle }, scope, port);
    running = worker.run();
  };
  const stopWorker = async () => { worker?.shutdown(); await running; worker = undefined; running = undefined; };
  const waiting = async (handle: { query(name: string): Promise<unknown> }) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      try { const state = await handle.query('reconciliationProgress') as { phase: string }; if (state.phase === 'waiting') return; } catch { /* Worker startup. */ }
      await delay(50);
    }
    throw new Error('Workflow did not reach durable timer.');
  };
  await startWorker();
  await check('actual Temporal timer survives worker shutdown/recreation and history replay without repeating acknowledged activity', async () => {
    const handle = await startReconciliation(env.client, queue, { scope, rounds: 2, intervalMs: 3000 });
    await waiting(handle); assert.equal(calls, 1);
    await assert.rejects(startReconciliation(env.client, queue, { scope, rounds: 2, intervalMs: 3000 }));
    const firstRunId = (await handle.describe()).runId;
    await stopWorker(); assert.equal(calls, 1); await startWorker();
    assert.deepEqual(await handle.result(), { completed: 2, last: { revision: 'a'.repeat(40), status: 'reconciled', acknowledged: 1 } });
    assert.equal(calls, 2); assert.equal((await handle.describe()).runId, firstRunId);
    const history = await handle.fetchHistory();
    assert.ok(history.events?.some((event) => event.timerStartedEventAttributes));
    assert.equal(historyText(history).includes('synthetic-private-content'), false);
    await Worker.runReplayHistory({ workflowBundle: bundle }, history, workflowId(scope)); assert.equal(calls, 2);
    await assert.rejects(startReconciliation(env.client, queue, { scope, rounds: 1, intervalMs: 1000 }));
  });
  await check('foreign tenant workflow reaches fixed activity denial without touching the bound port', async () => {
    const handle = await startReconciliation(env.client, queue, { scope: { ...scope, organizationId: 'foreign' }, rounds: 1, intervalMs: 1000 });
    await assert.rejects(handle.result()); assert.equal(calls, 2);
  });
  await check('wrong workflow ID fails before any activity and cannot bypass deterministic identity', async () => {
    const handle = await env.client.workflow.start('reconcileItem', { workflowId: 'synthetic-wrong-id', taskQueue: queue, args: [{ scope, rounds: 1, intervalMs: 1000 }] });
    await assert.rejects(handle.result()); assert.equal(calls, 2);
  });
  await stopWorker();
  // A separate fixed item binding permits a fresh workflow without reusing a completed ID.
  const failureScope = { ...scope, itemId: 'intent/0002' };
  worker = await createReconciliationWorker({ connection: env.nativeConnection, namespace: 'default', taskQueue: queue, workflowBundle: bundle }, failureScope, port);
  running = worker.run(); fail = true;
  await check('uncertain activity failure stops without automatic retry or private provider failure details', async () => {
    const handle = await startReconciliation(env.client, queue, { scope: failureScope, rounds: 2, intervalMs: 1000 });
    await assert.rejects(handle.result()); assert.equal(calls, 3);
    assert.equal(historyText(await handle.fetchHistory()).includes('private synthetic provider failure'), false);
  });
  await stopWorker(); fail = false;
  const cancelScope = { ...scope, itemId: 'intent/0003' };
  worker = await createReconciliationWorker({ connection: env.nativeConnection, namespace: 'default', taskQueue: queue, workflowBundle: bundle }, cancelScope, port);
  running = worker.run();
  await check('cancellation while waiting ends the workflow without scheduling another activity', async () => {
    const handle = await startReconciliation(env.client, queue, { scope: cancelScope, rounds: 2, intervalMs: 60000 });
    await waiting(handle); const before = calls; await handle.cancel(); await assert.rejects(handle.result());
    assert.equal((await handle.describe()).status.name, 'CANCELLED'); assert.equal(calls, before);
  });
  await stopWorker();
  console.log(`Temporal integration: ${passed} checks passed; actual local server and recreated SDK workers, synthetic activity port only.`);
} finally {
  try { if (worker) { worker.shutdown(); await running; } }
  finally { try { await environment?.teardown(); } finally { await rm(temporary, { recursive: true, force: true }); } }
  console.log('Closed only owned Temporal worker/server and removed generated test binary files.');
}
