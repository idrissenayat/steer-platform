import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker, type WorkflowBundle } from '@temporalio/worker';
import { createGitAuthorizationHarness } from '../../api/test/git-authorization-harness.ts';
import { createGitAuthorizationResolver } from '@steer/adapters/authorization';
import type { AuthorizationRecord } from '@steer/adapters/identity';
import { projectionKey } from '@steer/data/ingestion';
import { createWorkerProjectionRuntime } from '../src/runtime.ts';
import { createActivityWorker } from '../src/worker.ts';
import { startReconciliation } from '../src/client.ts';
import { workflowId } from '../src/contracts.ts';

export async function testProjectedWorkflow(env: TestWorkflowEnvironment, bundle: WorkflowBundle, temporary: string,
  check: (name: string, run: () => Promise<void>) => Promise<void>) {
  const exec = promisify(execFile); const docker = async (...args: string[]) => (await exec('docker', args, { timeout: 30000 })).stdout.trim();
  const name = `steer-0037-${randomUUID()}`, password = randomBytes(24).toString('hex');
  let container: string | undefined, admin: Pool | undefined;
  let runtime: Awaited<ReturnType<typeof createWorkerProjectionRuntime>> | undefined, worker: Worker | undefined, running: Promise<void> | undefined;
  const scope = { organizationId: 'synthetic-projection', repository: 'github:1', itemId: 'intent/0001' };
  const grant: AuthorizationRecord = { issuer: 'https://synthetic.invalid/issuer', subject: 'synthetic-projector', organizationId: scope.organizationId,
    type: 'agent', hats: [], toolGrants: ['projection.ingest'], active: true, validAfter: new Date(0).toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString() };
  const source = await createGitAuthorizationHarness(temporary, grant);
  const resolve = createGitAuthorizationResolver(source.reader, source.authorizationPath);
  // Fixed synthetic service identity, actual committed grants; not a real provider token.
  const authenticate = async () => {
    const record = await resolve({ issuer: grant.issuer, subject: grant.subject, organizationId: scope.organizationId });
    if (!record?.active || Date.parse(record.validAfter) > Date.now() || Date.parse(record.expiresAt) <= Date.now()) return null;
    return { subject: record.subject, organizationId: record.organizationId, type: record.type, hats: record.hats,
      toolGrants: record.toolGrants, expiresAt: record.expiresAt };
  };
  try {
    container = await docker('run', '--detach', '--rm', '--name', name, '--label', 'steer.integration=0037', '--tmpfs', '/var/lib/postgresql/data',
      '-e', `POSTGRES_PASSWORD=${password}`, '-e', 'POSTGRES_DB=steer_projection_test', '-p', '127.0.0.1::5432',
      'postgres@sha256:16bc17c64a573ef34162af9298258d1aec548232985b33ed7b1eac33ba35c229');
    assert.match(container, /^[a-f0-9]{64}$/);
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) { try { await docker('exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'); ready = true; break; } catch { await delay(200); } }
    assert.ok(ready); const mapping = await docker('port', container, '5432/tcp'); assert.match(mapping, /^127\.0\.0\.1:\d+$/);
    const database = { host: '127.0.0.1', port: Number(mapping.split(':')[1]), database: 'steer_projection_test', transport: { kind: 'isolated-loopback-test' } };
    admin = new Pool({ host: database.host, port: database.port, database: database.database, user: 'postgres', password, max: 1, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
    for (const role of ['steer_app', 'steer_projector', 'steer_auth_runtime']) await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    await migrate(drizzle(admin), { migrationsFolder: fileURLToPath(new URL('../migrations/', import.meta.resolve('@steer/data'))) });
    const options = { scope, database, selector: { paths: [source.artifactPath, source.secondArtifactPath] } };
    const start = async (itemId = scope.itemId) => {
      runtime = await createWorkerProjectionRuntime({ ...options, scope: { ...scope, itemId } }, { databasePassword: password }, { reader: source.reader, authenticate });
      worker = await createActivityWorker({ connection: env.nativeConnection, namespace: 'default', taskQueue: 'steer-0037', workflowBundle: bundle }, runtime.activities);
      running = worker.run();
    };
    const stop = async () => {
      worker?.shutdown(); await running; worker = undefined; running = undefined;
      if (runtime) { await runtime.shutdown(); assert.equal(runtime.status().database.closed, true); assert.equal(runtime.status().active, false); }
    };
    const count = async () => Number((await admin!.query('SELECT count(*) AS count FROM steer.ingestion_events')).rows[0].count);
    await start();
    await check('Temporal projects actual Git artifacts into PostgreSQL and worker/runtime recreation preserves idempotent event history', async () => {
      const handle = await startReconciliation(env.client, 'steer-0037', { scope, rounds: 2, intervalMs: 5000 });
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        try { if ((await handle.query('reconciliationProgress') as { phase: string }).phase === 'waiting') { waiting = true; break; } } catch { /* Poll startup. */ }
        await delay(50);
      }
      assert.ok(waiting); assert.equal(await count(), 2); const revision = await source.reader.readHead();
      await stop(); await start();
      assert.deepEqual(await handle.result(), { completed: 2, last: { revision, status: 'reconciled', acknowledged: 2 } });
      assert.equal(await count(), 2);
      for (const path of [source.artifactPath, source.secondArtifactPath]) {
        const row = (await admin!.query('SELECT value FROM steer.projection_records WHERE organization_id=$1 AND record_key=$2', [scope.organizationId, projectionKey(scope.repository, path)])).rows[0];
        assert.equal(row.value.content, (await source.reader.readArtifact(path, revision)).content);
      }
      await Worker.runReplayHistory({ workflowBundle: bundle }, await handle.fetchHistory(), workflowId(scope)); assert.equal(await count(), 2);
    });
    await check('source-based repair and replay after a discarded completed receipt do not duplicate PostgreSQL events', async () => {
      await admin!.query('UPDATE steer.projection_records SET content_digest=$1 WHERE organization_id=$2 AND record_key=$3', ['0'.repeat(64), scope.organizationId, projectionKey(scope.repository, source.artifactPath)]);
      await runtime!.activities.reconcile(scope); // The caller intentionally discards a completed receipt.
      await stop(); await start(); await runtime!.activities.reconcile(scope); assert.equal(await count(), 2);
      const row = (await admin!.query('SELECT content_digest FROM steer.projection_records WHERE organization_id=$1 AND record_key=$2', [scope.organizationId, projectionKey(scope.repository, source.artifactPath)])).rows[0];
      assert.equal(row.content_digest, (await source.reader.readArtifact(source.artifactPath, await source.reader.readHead())).contentDigest);
    });
    await stop(); await start('intent/0002');
    await check('Git-committed revocation denies a later durable round without further PostgreSQL ingestion', async () => {
      const revokedScope = { ...scope, itemId: 'intent/0002' };
      const handle = await startReconciliation(env.client, 'steer-0037', { scope: revokedScope, rounds: 2, intervalMs: 5000 });
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        try { if ((await handle.query('reconciliationProgress') as { phase: string }).phase === 'waiting') { waiting = true; break; } } catch { /* Poll startup. */ }
        await delay(50);
      }
      assert.ok(waiting); const before = await count(); await source.publish([{ ...grant, active: false }]);
      await assert.rejects(handle.result()); assert.equal(await count(), before);
      await assert.rejects(runtime!.activities.reconcile({ ...revokedScope, organizationId: 'foreign' })); assert.equal(await count(), before);
    });
    await stop();
  } finally {
    try { if (worker) { worker.shutdown(); await running; } }
    finally { try { await runtime?.shutdown(); await admin?.end(); }
      finally { if (container && /^[a-f0-9]{64}$/.test(container)) {
        assert.equal(await docker('inspect', '--format', '{{index .Config.Labels "steer.integration"}}', container), '0037'); await docker('stop', '--time', '5', container);
      } } }
    console.log('Closed owned projection runtimes and removed only synthetic PostgreSQL container/tmpfs data.');
  }
}
