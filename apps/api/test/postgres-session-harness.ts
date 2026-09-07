import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createPostgresBrowserSessionStore, sessionNamespace, type SessionIdentityBinding } from '@steer/data/browser-session';
import { createRuntimePool } from '@steer/data/runtime-pool';
import type { BrowserSession, LoginTransaction, BrowserSessionConfiguration } from '@steer/adapters/browser-session';
import type { GitHubBinding } from '@steer/adapters/github';
import type { SessionTestHarness } from './session-harness.ts';
import { createIdentityRuntime, createRecordedBriefProjectionRuntime, startLocalIdentityFromSecretProvider } from '../src/runtime.ts';
import { createEncryptedFileSecretProvider } from '@steer/adapters/secrets';
import { createSecretFixture } from '../../../packages/adapters/test/secret-fixture.ts';
import { reserveLocalPort, localHttpsRequest } from './local-tls-harness.ts';
import { createArtifactProjectionReader } from '@steer/data/artifact-reader';
import { createProjectionChangeReader } from '@steer/data/projection-changes';
import { createProjectionSnapshotReader } from '@steer/data/projection-snapshot';
import { ingestVerifiedArtifact, projectionKey } from '@steer/data/ingestion';
import { readProjection } from '@steer/data';
import { reconcileRepository, type SnapshotProjectionSink, type ProjectionOutcome } from '@steer/adapters/reconcile';
import type { Principal } from '@steer/tool-registry';

/** Two disposable services only; no externally supplied connection or credential. */
export async function createPostgresSessionHarness(binding: SessionIdentityBinding): Promise<SessionTestHarness & {
  close(): Promise<void>;
  createDestinationRuntime(configuration: BrowserSessionConfiguration, github: GitHubBinding, paths: string[], privateKeyPem: string,
    transports: { identity: typeof fetch; github: typeof fetch }): Promise<Awaited<ReturnType<typeof createIdentityRuntime>>>;
}> {
  // Use the verified local image configuration ID directly. The existing pinned
  // bits are unchanged; no registry name or floating tag needs resolution.
  const image = 'sha256:16bc17c64a573ef34162af9298258d1aec548232985b33ed7b1eac33ba35c229';
  const exec = promisify(execFile);
  const docker = async (...args: string[]) => (await exec('docker', args, { timeout: 30000 })).stdout.trim();
  const name = `steer-0018-${randomUUID()}`; const password = randomBytes(24).toString('hex');
  const encryptionKey = randomBytes(32); const namespace = sessionNamespace(binding);
  const pools: { end(): Promise<void> }[] = []; let containerId: string | undefined; let closed = false;
  const runtimePools: ReturnType<typeof createRuntimePool>[] = [];
  const identityRuntimes: Awaited<ReturnType<typeof createIdentityRuntime>>[] = [];
  let runtimeClosed = false; let runtimeShutdown: Promise<void> | undefined;
  const close = async () => {
    if (closed) return;
    try {
      const results = await Promise.allSettled(identityRuntimes.map(instance => instance.shutdown()));
      if (results.some(result => result.status === 'rejected')) throw new Error('Synthetic identity runtime cleanup failed.');
    } finally {
      try { await Promise.all(pools.map((pool) => pool.end())); }
      finally {
        if (containerId && /^[a-f0-9]{64}$/.test(containerId)) {
          assert.equal(await docker('inspect', '--format', '{{index .Config.Labels "steer.integration"}}', containerId), '0018');
          await docker('stop', '--time', '5', containerId);
        }
        encryptionKey.fill(0); closed = true;
      }
    }
    console.log('Removed only this run\'s synthetic authentication PostgreSQL container and tmpfs data.');
  };
  try {
    assert.equal(await docker('image', 'inspect', image, '--format', '{{.Id}}'), image);
    containerId = await docker('run', '--detach', '--rm', '--pull=never', '--name', name,
      '--label', 'steer.integration=0018', '--memory', '512m', '--tmpfs', '/var/lib/postgresql/data',
      '-e', `POSTGRES_PASSWORD=${password}`, '-e', 'POSTGRES_DB=steer_auth_test', '-p', '127.0.0.1::5432', image);
    assert.match(containerId, /^[a-f0-9]{64}$/);
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try { await docker('exec', containerId, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'steer_auth_test'); ready = true; break; }
      catch { await delay(300); }
    }
    assert.ok(ready, 'Disposable authentication PostgreSQL did not become ready');
    const mapping = await docker('port', containerId, '5432/tcp'); assert.match(mapping, /^127\.0\.0\.1:\d+$/);
    const connect = (user: string) => {
      const pool = new Pool({ host: '127.0.0.1', port: Number(mapping.split(':')[1]), user, password,
        database: 'steer_auth_test', max: 1, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
      pools.push(pool); return pool;
    };
    const admin = connect('postgres');
    const serverVersion = Number((await admin.query("SELECT current_setting('server_version_num') AS version")).rows[0].version);
    assert.ok(serverVersion >= 160000 && serverVersion < 170000, 'The isolated authentication database must be PostgreSQL 16');
    for (const role of ['steer_app', 'steer_projector', 'steer_auth_runtime']) {
      await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    }
    const migrationsFolder = fileURLToPath(new URL('../migrations/', import.meta.resolve('@steer/data')));
    await migrate(drizzle(admin), { migrationsFolder });
    assert.equal((await admin.query('SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations')).rows[0].count, 5);
    const config = { binding, keyring: { currentKeyId: 'synthetic', keys: { synthetic: encryptionKey } } };
    const runtime = (user: 'steer_auth_runtime' | 'steer_app' | 'steer_projector' = 'steer_auth_runtime') => {
      if (runtimeClosed) throw new Error('Synthetic runtime resources are closed.');
      const pool = createRuntimePool({ host: '127.0.0.1', port: Number(mapping.split(':')[1]),
        user, password, database: 'steer_auth_test', transport: { kind: 'isolated-loopback-test' } });
      pools.push(pool); runtimePools.push(pool); return pool;
    };
    const freshStore = () => createPostgresBrowserSessionStore(runtime(), config);
    const store = freshStore();
    const transactionKeys = async () => (await admin.query<{ key_hash: string }>(
      'SELECT key_hash FROM steer_auth.login_transactions WHERE namespace=$1', [namespace])).rows;
    return { kind: 'postgres', store, freshStore, close,
      createDestinationRuntime: async (configuration, github, paths, privateKeyPem, transports) => {
        if (closed || runtimeClosed) throw new Error('Synthetic runtime resources are closed.');
        if (typeof transports?.identity !== 'function' || typeof transports?.github !== 'function') throw new Error('Synthetic transports are required.');
        // All database authority remains inside this disposable harness. Callers
        // must provide both synthetic HTTP transports; no real provider fallback.
        const { clientSecret, ...browser } = configuration;
        const instance = await createIdentityRuntime({ version: 'steer-identity-runtime/v1', browser,
          github: { appId: '1', authorizationPath: 'access/authorization.json', binding: github },
          database: { host: '127.0.0.1', port: Number(mapping.split(':')[1]), database: 'steer_auth_test', transport: { kind: 'isolated-loopback-test' } },
          briefDestination: { paths }, sessionKeyId: 'synthetic',
        }, { browserClientSecret: clientSecret, githubPrivateKeyPem: privateKeyPem, databasePassword: password,
          sessionKeys: { synthetic: encryptionKey } }, transports);
        identityRuntimes.push(instance); return instance;
      },
      createProjectionFixture: async (reader, paths) => {
        const projector = runtime('steer_projector'); const app = runtime('steer_app');
        const organizationId = reader.binding.organizationId; const repository = `github:${reader.binding.repositoryId}`;
        const principal: Principal = { subject: 'synthetic-projector', organizationId, type: 'agent', hats: [],
          toolGrants: ['projection.ingest'], expiresAt: new Date(Date.now() + 300000).toISOString() };
        const sink = (): SnapshotProjectionSink<ProjectionOutcome> => ({
          currentRevision: async (_repository, path) => (await readProjection(projector, principal, projectionKey(repository, path)))?.sourceRevision ?? null,
          ingest: (snapshot, expected) => ingestVerifiedArtifact(projector, principal, snapshot, expected),
        });
        // Select by filename, not full path. The exact expected manifest below
        // remains the guard against accidentally broadening this test fixture.
        const selection = { roots: [''], fileNames: [...new Set(paths.map((path) => path.slice(path.lastIndexOf('/') + 1)))] };
        const inventory = await reader.readInventory(selection, await reader.readHead());
        assert.deepEqual(inventory.entries.map((item) => item.path).sort(), [...paths].sort());
        const first = await reconcileRepository(reader, selection, sink());
        assert.equal(first.status, 'reconciled'); assert.ok(first.outcomes.every((item) => item.outcome === 'applied'));
        const events = Number((await admin.query('SELECT count(*) AS count FROM steer.ingestion_events WHERE organization_id=$1', [organizationId])).rows[0].count);
        assert.ok((await reconcileRepository(reader, selection, sink())).outcomes.every((item) => item.outcome === 'duplicate'));
        const path = paths[0]!;
        await admin.query('UPDATE steer.projection_records SET content_digest=$1 WHERE organization_id=$2 AND record_key=$3', ['0'.repeat(64), organizationId, projectionKey(repository, path)]);
        const repaired = await reconcileRepository(reader, selection, sink());
        assert.equal(repaired.outcomes.find((item) => item.path === path)?.outcome, 'repaired');
        assert.equal(Number((await admin.query('SELECT count(*) AS count FROM steer.ingestion_events WHERE organization_id=$1', [organizationId])).rows[0].count), events);
        const projectionReader = createArtifactProjectionReader(app, { organizationId, repository, paths });
        for (const item of paths) {
          const actual = await projectionReader.read({ organizationId, repository, path: item, revision: first.revision },
            { ...principal, toolGrants: ['projection.artifact.read'] }) as { content: string };
          assert.equal(actual.content, (await reader.readArtifact(item, first.revision)).content);
        }
        console.log('PASS revision-bound Git inventory selects two artifacts, then replays and repairs PostgreSQL without rewriting history');
        return { services: { artifactProjection: projectionReader, projectionChanges: createProjectionChangeReader(app, { organizationId, repository }),
          projectionSnapshot: createProjectionSnapshotReader(app, { organizationId, repository }) }, input: { organizationId, repository, path, revision: first.revision } };
      },
      createDecisionProjection: async (reader, paths, revision) => {
        const briefPath = 'items/0125-synthetic-outcome/BRIEF.md';
        assert.deepEqual(paths, [1, 2].map(gate => `items/0125-synthetic-outcome/signatures/gate-${gate}.json`));
        const organizationId = reader.binding.organizationId, repository = `github:${reader.binding.repositoryId}`;
        const projector = runtime('steer_projector'), app = runtime('steer_app');
        const principal: Principal = { subject: 'synthetic-decision-projector', organizationId, type: 'agent', hats: [],
          toolGrants: ['projection.ingest'], expiresAt: new Date(Date.now() + 300000).toISOString() };
        for (const path of paths) {
          assert.equal(await readProjection(projector, principal, projectionKey(repository, path)), null);
          const { repositoryId, ...artifact } = await reader.readArtifact(path, revision);
          assert.equal(await ingestVerifiedArtifact(projector, principal, { ...artifact, repository }, null), 'applied');
        }
        // Existing Brief selection is intentionally unchanged; the decision record
        // is a later source commit referring to that exact earlier Brief revision.
        // Rows remain owned by this disposable container and its final cleanup.
        return { artifactProjection: createArtifactProjectionReader(app, { organizationId, repository, paths: [briefPath, 'SPEC.md', ...paths] }) };
      },
      createReceiptProjection: async (reader, path, revision, readReceipt) => {
        // Only the dedicated fixture artifact in this disposable database is owned
        // here. Other projection rows/events remain untouched for the broader suite.
        assert.ok(['items/0156-recorded-fixture/BRIEF.md', 'items/0001-demo/BRIEF.md', 'items/0167-created-fixture/BRIEF.md'].includes(path));
        const organizationId = reader.binding.organizationId, repository = `github:${reader.binding.repositoryId}`;
        const projector = runtime('steer_projector'), app = runtime('steer_app'), recordKey = projectionKey(repository, path);
        const principal: Principal = { subject: 'synthetic-receipt-projector', organizationId, type: 'agent', hats: [],
          toolGrants: ['projection.ingest'], expiresAt: new Date(Date.now() + 300000).toISOString() };
        assert.equal(await readProjection(projector, principal, recordKey), null);
        let current: string | null = null, stopped = false; const events = new Set<string>();
        const projectionScope = { organizationId, repository, branch: reader.binding.branch, paths: [path] };
        const job = await createRecordedBriefProjectionRuntime({ version: 'steer-recorded-brief-projection-runtime/v1',
          scope: projectionScope, database: { host: '127.0.0.1', port: Number(mapping.split(':')[1]), database: 'steer_auth_test',
            transport: { kind: 'isolated-loopback-test' } },
        }, { databasePassword: password }, { reader, authenticate: async () => principal, readReceipt });
        assert.equal(job.status().database.connections, 0);
        const ingest = async (target: string) => {
          assert.equal(stopped, false);
          const { repositoryId, ...artifact } = await reader.readArtifact(path, target);
          assert.equal(repositoryId, reader.binding.repositoryId); assert.equal(artifact.path, path); assert.equal(artifact.revision, target);
          assert.equal(await ingestVerifiedArtifact(projector, principal, { ...artifact, repository }, current), 'applied');
          events.add(`source:${createHash('sha256').update(JSON.stringify([repository, path, target])).digest('hex')}`); current = target;
        };
        const close = async () => {
          if (stopped) return; await job.shutdown(); stopped = true;
          assert.equal(job.status().database.closed, true); assert.equal(job.status().database.active, 0);
          await assert.rejects(job.runOnce(), /did not complete/);
          await admin.query('DELETE FROM steer.projection_records WHERE organization_id=$1 AND record_key=$2', [organizationId, recordKey]);
          await admin.query('DELETE FROM steer.ingestion_events WHERE organization_id=$1 AND event_id=ANY($2::text[])', [organizationId, [...events]]);
        };
        return { services: { artifactProjection: createArtifactProjectionReader(app, { organizationId, repository, paths: [path] }) },
          project: async () => {
            const outcome = current === null ? 'applied' : 'duplicate';
            // Exact owned source event is tracked before dispatch so an uncertain
            // post-ingestion acknowledgement cannot strand fixture data.
            events.add(`source:${createHash('sha256').update(JSON.stringify([repository, path, revision])).digest('hex')}`);
            assert.deepEqual(await job.runOnce(), { status: 'observed', revision, outcome });
            assert.equal((await readProjection(projector, principal, recordKey))?.sourceRevision, revision); current = revision;
            assert.deepEqual(await job.runOnce(), { status: 'observed', revision, outcome: 'duplicate' });
          },
          advance: async () => {
            await ingest(await reader.readHead());
            assert.deepEqual(await job.runOnce(), { status: 'different-revision', revision, outcome: null });
            assert.equal((await readProjection(projector, principal, recordKey))?.sourceRevision, current);
          }, close };
      },
      verifyRuntimeBootstrap: async (configuration, privateKeyPem) => {
        const { clientSecret, ...browser } = configuration;
        let providerCalls = 0;
        const denyTransport: typeof fetch = async () => { providerCalls++; throw new Error('Unexpected synthetic provider request.'); };
        const instance = await createIdentityRuntime({ version: 'steer-identity-runtime/v1', browser,
          github: { appId: '1', authorizationPath: 'access/authorization.json', binding: {
            organizationId: 'synthetic-org', installationId: 1, repositoryId: 1, owner: 'synthetic', repository: 'synthetic', branch: 'synthetic' } },
          database: { host: '127.0.0.1', port: Number(mapping.split(':')[1]), database: 'steer_auth_test', transport: { kind: 'isolated-loopback-test' } },
          sessionKeyId: 'synthetic',
        }, { browserClientSecret: clientSecret, githubPrivateKeyPem: privateKeyPem, databasePassword: password,
          sessionKeys: { synthetic: encryptionKey } }, { identity: denyTransport, github: denyTransport });
        try {
          const origin = new URL(configuration.redirectUri).origin;
          const response = await instance.fetch(new Request(`${origin}/auth/login`, { method: 'POST', headers: { origin } }));
          assert.equal(response.status, 303); assert.equal(providerCalls, 0);
          assert.ok(response.headers.getSetCookie()[0]?.startsWith('__Host-steer-login='));
          const rows = await transactionKeys(); assert.equal(rows.length, 1);
          assert.ok(await store.consumeTransaction(rows[0]!.key_hash));
        } finally { await instance.shutdown(); }
        assert.equal(instance.status().state, 'stopped'); assert.equal(instance.status().database.connections, 0);
      },
      shutdown: () => {
        runtimeClosed = true;
        runtimeShutdown ??= Promise.all(runtimePools.map((pool) => pool.shutdown())).then(() => {});
        return runtimeShutdown;
      },
      verifySecretBootstrap: async (configuration, tls) => {
        const origin = `https://localhost:${await reserveLocalPort()}`;
        const { clientSecret, ...browser } = configuration; const redirectUri = `${origin}/auth/callback`;
        const secretFixture = await createSecretFixture(new TextEncoder().encode(JSON.stringify({ version: 'steer-local-identity-secrets/v1',
          identity: { browserClientSecret: clientSecret, githubPrivateKeyPem: tls.key, databasePassword: password,
            sessionKeys: { synthetic: encryptionKey.toString('base64') } }, tls })));
        let secretBytes: Uint8Array | undefined; let providerCalls = 0;
        const deny: typeof fetch = async () => { providerCalls++; throw new Error('Unexpected synthetic provider request'); };
        try {
          const provider = await createEncryptedFileSecretProvider(secretFixture, secretFixture.keyProvider);
          const instance = await startLocalIdentityFromSecretProvider({ version: 'steer-local-identity/v1', rendererOrigin: 'http://127.0.0.1:49001', identity: {
            version: 'steer-identity-runtime/v1', browser: { ...browser, redirectUri },
            github: { appId: '1', authorizationPath: 'access/authorization.json', binding: { organizationId: 'synthetic-org', installationId: 1,
              repositoryId: 1, owner: 'synthetic', repository: 'synthetic', branch: 'synthetic' } },
            database: { host: '127.0.0.1', port: Number(mapping.split(':')[1]), database: 'steer_auth_test', transport: { kind: 'isolated-loopback-test' } }, sessionKeyId: 'synthetic',
          } }, secretFixture.reference, { read: async (reference) => { secretBytes = await provider.read(reference); return secretBytes; } },
          { identity: deny, github: deny, renderer: deny });
          try {
            assert.ok(secretBytes?.every((byte) => byte === 0));
            const response = await localHttpsRequest(origin, tls.cert, '/auth/login', { method: 'POST', headers: { origin } });
            assert.equal(response.status, 303); assert.equal(providerCalls, 0);
            const localBinding = { ...binding, redirectUri }; const localNamespace = sessionNamespace(localBinding);
            const rows = (await admin.query<{ key_hash: string }>('SELECT key_hash FROM steer_auth.login_transactions WHERE namespace=$1', [localNamespace])).rows;
            assert.equal(rows.length, 1);
            const verifier = createPostgresBrowserSessionStore(runtime(), { binding: localBinding, keyring: config.keyring });
            assert.ok(await verifier.consumeTransaction(rows[0]!.key_hash));
          } finally { await instance.shutdown(); }
          assert.equal(instance.status().listener.state, 'stopped'); assert.equal(instance.status().identity.database.connections, 0);
        } finally { await secretFixture.close(); }
      },
      wrongKeyStore: () => createPostgresBrowserSessionStore(runtime(), { binding,
        keyring: { currentKeyId: 'synthetic', keys: { synthetic: randomBytes(32) } } }),
      counts: async () => ({
        transactions: (await admin.query('SELECT count(*)::int AS count FROM steer_auth.login_transactions WHERE namespace=$1', [namespace])).rows[0].count,
        sessions: (await admin.query('SELECT count(*)::int AS count FROM steer_auth.browser_sessions WHERE namespace=$1', [namespace])).rows[0].count,
      }),
      firstSession: async () => {
        const row = (await admin.query<{ key_hash: string }>('SELECT key_hash FROM steer_auth.browser_sessions WHERE namespace=$1 LIMIT 1', [namespace])).rows[0];
        return row ? await store.readSession(row.key_hash) as BrowserSession : undefined;
      },
      abandonTransactions: async () => { for (const row of await transactionKeys()) await store.consumeTransaction(row.key_hash); },
      corruptVerifier: async () => {
        const rows = await transactionKeys(); assert.equal(rows.length, 1);
        const hash = rows[0]!.key_hash; const value = await store.consumeTransaction(hash) as LoginTransaction;
        assert.equal(await store.insertTransaction(hash, { ...value, verifier: randomBytes(32).toString('base64url') }), true);
      },
      verifyCiphertext: async () => {
        const rows = (await admin.query('SELECT key_hash, encrypted_value FROM steer_auth.browser_sessions WHERE namespace=$1', [namespace])).rows;
        assert.equal(rows.length, 1);
        const value = await store.readSession(rows[0].key_hash) as BrowserSession;
        const stored = JSON.stringify(rows[0].encrypted_value);
        assert.equal(rows[0].encrypted_value.version, 1); assert.equal(rows[0].encrypted_value.keyId, 'synthetic');
        assert.ok(!stored.includes(value.accessToken)); assert.ok(!stored.includes(value.subject)); assert.ok(!stored.includes(value.organizationId));
      },
    };
  } catch {
    await close(); throw new Error('Disposable authentication database failed; credentials omitted.');
  }
}
