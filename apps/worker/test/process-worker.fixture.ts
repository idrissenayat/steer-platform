import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { NativeConnection, Runtime, DefaultLogger, type WorkflowBundle } from '@temporalio/worker';
import type { RepositoryReader } from '@steer/adapters/github';
import { createGitAuthorizationResolver } from '@steer/adapters/authorization';
import { createWorkerProjectionRuntime } from '../src/runtime.ts';
import { createActivityWorker } from '../src/worker.ts';
import { createWorkerService } from '../src/service.ts';
import type { ReconciliationScope } from '../src/contracts.ts';

export interface ProcessFixtureConfiguration {
  address: string; taskQueue: string; bundle: WorkflowBundle; scope: ReconciliationScope;
  database: { host: string; port: number; database: string; transport: { kind: string } };
  password: string; directory: string; issuer: string; subject: string;
}
// Only invoked as an owned isolated fixture. Configuration/password cross IPC, never argv or inherited credentials.
assert.ok(process.send); Runtime.install({ logger: new DefaultLogger('ERROR'), shutdownSignals: [] });
process.once('message', async (raw) => {
  const config = raw as ProcessFixtureConfiguration;
  let connection: NativeConnection | undefined, runtime: Awaited<ReturnType<typeof createWorkerProjectionRuntime>> | undefined;
  try {
    assert.match(config.address, /^(127\.0\.0\.1|localhost):\d+$/); assert.equal(config.database.host, '127.0.0.1');
    assert.equal(config.database.transport.kind, 'isolated-loopback-test'); assert.ok(config.directory.includes('steer-temporal-0036-'));
    const exec = promisify(execFile);
    const git = async (...args: string[]) => (await exec('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd: config.directory, timeout: 10000 })).stdout;
    const reader: RepositoryReader = {
      binding: { organizationId: config.scope.organizationId, repositoryId: 1, installationId: 1, owner: 'synthetic', repository: 'synthetic', branch: 'synthetic' },
      readHead: async () => (await git('rev-parse', 'HEAD')).trim(),
      readInventory: async () => { throw new Error('This fixture uses a fixed manifest.'); },
      readArtifact: async (path, revision) => {
        assert.ok(['BRIEF.md', 'SPEC.md', 'access/authorization.json'].includes(path)); assert.match(revision, /^[a-f0-9]{40}$/);
        const content = await git('show', `${revision}:${path}`);
        return { organizationId: config.scope.organizationId, repositoryId: 1, revision, path, content,
          contentDigest: createHash('sha256').update(content).digest('hex'), blobSha: (await git('rev-parse', `${revision}:${path}`)).trim() };
      },
    };
    const resolve = createGitAuthorizationResolver(reader, 'access/authorization.json');
    const authenticate = async () => {
      const record = await resolve({ issuer: config.issuer, subject: config.subject, organizationId: config.scope.organizationId });
      if (!record?.active || Date.parse(record.validAfter) > Date.now() || Date.parse(record.expiresAt) <= Date.now()) return null;
      return { subject: record.subject, organizationId: record.organizationId, type: record.type, hats: record.hats, toolGrants: record.toolGrants, expiresAt: record.expiresAt };
    };
    connection = await NativeConnection.connect({ address: config.address });
    runtime = await createWorkerProjectionRuntime({ scope: config.scope, database: config.database, selector: { paths: ['BRIEF.md', 'SPEC.md'] } },
      { databasePassword: config.password }, { reader, authenticate });
    const ownedConnection = connection; const ownedRuntime = runtime; let connectionClosed = false;
    const service = createWorkerService({ createWorker: () => createActivityWorker({ connection: ownedConnection, namespace: 'default', taskQueue: config.taskQueue, workflowBundle: config.bundle }, ownedRuntime.activities),
      runtime, closeConnection: async () => { await ownedConnection.close(); connectionClosed = true; } });
    process.once('SIGTERM', () => { void service.shutdown().catch(() => {}); });
    const run = service.start(); void run.catch(() => {});
    while (service.status().state === 'starting') await delay(10);
    if (service.status().state === 'running') process.send?.({ type: 'ready', pid: process.pid });
    await run;
    process.send?.({ type: 'stopped', state: service.status().state, databaseClosed: ownedRuntime.status().database.closed, connectionClosed });
    process.disconnect?.();
  } catch {
    try { await runtime?.shutdown(); } catch { /* Sanitized below. */ }
    try { await connection?.close(); } catch { /* Sanitized below. */ }
    process.send?.({ type: 'failed' }); process.exitCode = 1; if (process.connected) process.disconnect?.();
  }
});
