import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Client, Connection } from '@temporalio/client';
import { DefaultLogger, Runtime, Worker } from '@temporalio/worker';
import { createReconciliationWorker } from '../src/worker.ts';
import { startReconciliation, createReconciliationSchedulerClient, createManagedReconciliationScheduler } from '../src/client.ts';
import { invokeTool, ToolError } from '@steer/tool-registry';
import { createIdentityRuntime } from '../../api/src/runtime.ts';
import { workflowId } from '../src/contracts.ts';
import { testProjectedWorkflow } from './projection.integration.ts';
import { testGateWatch } from './gate-watch.integration.ts';
import { testGitGateSource } from './gate-source.integration.ts';
import { createIsolatedTemporalHarness } from './isolated-temporal-harness.ts';
import { testRecordedIdentityRuntime } from './recorded-runtime.integration.ts';

let fixture: Awaited<ReturnType<typeof createIsolatedTemporalHarness>> | undefined;
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
  fixture = await createIsolatedTemporalHarness();
  const { environment: env, bundle, directory: temporary } = fixture;
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
  await testProjectedWorkflow(env, bundle, temporary, check);
  const scheduledScope = { ...scope, itemId: 'intent/0039' };
  worker = await createReconciliationWorker({ connection: env.nativeConnection, namespace: 'default', taskQueue: queue, workflowBundle: bundle }, scheduledScope, port);
  running = worker.run();
  await check('canonical authorized scheduling uses actual Temporal starts, fixed routing, status and retained duplicate denial', async () => {
    const scheduler = createReconciliationSchedulerClient(env.client, { namespace: 'default', taskQueue: queue, scope: scheduledScope, maxRounds: 1, minIntervalMs: 1000 });
    const now = new Date();
    const principal = { subject: 'synthetic-scheduler', organizationId: scope.organizationId, type: 'agent', hats: [],
      toolGrants: ['workflow.reconciliation.start', 'workflow.reconciliation.status'], expiresAt: new Date(now.getTime() + 60000).toISOString() };
    const context = { principal, now, revalidate: async () => principal, services: { reconciliationScheduler: scheduler } };
    const request = { ...scheduledScope, rounds: 1, intervalMs: 1000 };
    const before = calls;
    assert.deepEqual(await invokeTool('workflow.reconciliation.status', scheduledScope, context), { workflowId: scheduler.workflowId, outcome: 'not-found' });
    await assert.rejects(invokeTool('workflow.reconciliation.start', request, { ...context, revalidate: async () => null }), (error) => error instanceof ToolError && error.code === 'UNAUTHENTICATED');
    await assert.rejects(invokeTool('workflow.reconciliation.start', { ...request, rounds: 2 }, context), (error) => error instanceof ToolError && error.code === 'FORBIDDEN');
    assert.equal(calls, before);
    assert.equal((await invokeTool('workflow.reconciliation.status', scheduledScope, context)).outcome, 'not-found');
    const result = await invokeTool('workflow.reconciliation.start', request, context);
    assert.equal(result.outcome, 'started'); assert.ok('runId' in result);
    await env.client.workflow.getHandle(scheduler.workflowId).result();
    assert.equal(calls, before + 1);
    assert.deepEqual(await invokeTool('workflow.reconciliation.status', scheduledScope, context), { workflowId: scheduler.workflowId, outcome: 'found', runId: result.runId, state: 'COMPLETED' });
    assert.deepEqual(await invokeTool('workflow.reconciliation.start', request, context), { workflowId: scheduler.workflowId, outcome: 'duplicate' });
    assert.equal(calls, before + 1);
  });
  await stopWorker();
  await check('identity runtime owns a separate actual Temporal scheduler connection and closes it without disturbing the worker/server', async () => {
    const connection = await Connection.connect({ address: env.address }); let closed = 0;
    const managed = await createManagedReconciliationScheduler(new Client({ connection, namespace: 'default' }), {
      namespace: 'default', taskQueue: queue, scope: scheduledScope, maxRounds: 1, minIntervalMs: 1000,
    }, async () => { await connection.close(); closed++; });
    const key = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    let runtime: Awaited<ReturnType<typeof createIdentityRuntime>> | undefined;
    try {
      runtime = await createIdentityRuntime({ version: 'steer-identity-runtime/v1',
        browser: { issuer: 'https://id.example/realm', jwksUri: 'https://id.example/jwks', authorizationEndpoint: 'https://id.example/auth',
          tokenEndpoint: 'https://id.example/token', redirectUri: 'https://steer.example/auth/callback', clientId: 'steer-web', audience: 'steer-api' },
        github: { appId: '1', authorizationPath: 'access/authorization.json', binding: { organizationId: scope.organizationId,
          installationId: 1, repositoryId: 1, owner: 'synthetic', repository: 'synthetic', branch: 'synthetic' } },
        database: { host: '127.0.0.1', port: 5432, database: 'unused', transport: { kind: 'isolated-loopback-test' } },
        sessionKeyId: 'synthetic', scheduling: { itemId: scheduledScope.itemId, maxRounds: 1, minIntervalMs: 1000 },
      }, { browserClientSecret: 'synthetic-not-a-real-client-secret', githubPrivateKeyPem: key,
        databasePassword: 'unused-synthetic-password', sessionKeys: { synthetic: randomBytes(32) } }, { createScheduler: async () => managed });
      assert.equal((await managed.scheduler.inspect()).outcome, 'found');
      assert.equal(runtime.status().database.connections, 0);
      await runtime.shutdown(); assert.equal(closed, 1); assert.equal(managed.status().state, 'stopped');
      await assert.rejects(managed.scheduler.inspect());
      await assert.rejects(connection.workflowService.describeWorkflowExecution({ namespace: 'default', execution: { workflowId: managed.scheduler.workflowId } }));
      // The environment owns a different connection: closing this one must not close the server.
      assert.equal((await env.client.workflow.getHandle(managed.scheduler.workflowId).describe()).status.name, 'COMPLETED');
    } finally { await runtime?.shutdown(); await managed.shutdown(); }
  });
  await testGateWatch(env, bundle, check);
  await testGitGateSource(env, bundle, temporary, check);
  await testRecordedIdentityRuntime(env, bundle, check);
  console.log(`Temporal integration: ${passed} checks passed; actual local server, Git/PostgreSQL and recreated SDK workers; synthetic identities only.`);
} finally {
  try { if (worker) { worker.shutdown(); await running; } }
  finally { await fixture?.close(); }
  console.log('Closed only owned Temporal worker/server and removed generated test binary files.');
}
