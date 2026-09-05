import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createPostgresBrowserSessionStore, sessionNamespace, type SessionIdentityBinding } from '@steer/data/browser-session';
import type { BrowserSession, LoginTransaction } from '@steer/adapters/browser-session';
import type { SessionTestHarness } from './session-harness.ts';

/** Two disposable services only; no externally supplied connection or credential. */
export async function createPostgresSessionHarness(binding: SessionIdentityBinding): Promise<SessionTestHarness & { close(): Promise<void> }> {
  const image = 'postgres@sha256:16bc17c64a573ef34162af9298258d1aec548232985b33ed7b1eac33ba35c229';
  const exec = promisify(execFile);
  const docker = async (...args: string[]) => (await exec('docker', args, { timeout: 30000 })).stdout.trim();
  const name = `steer-0018-${randomUUID()}`; const password = randomBytes(24).toString('hex');
  const encryptionKey = randomBytes(32); const namespace = sessionNamespace(binding);
  const pools: Pool[] = []; let containerId: string | undefined; let closed = false;
  const close = async () => {
    if (closed) return;
    try { await Promise.all(pools.map((pool) => pool.end())); }
    finally {
      if (containerId && /^[a-f0-9]{64}$/.test(containerId)) {
        assert.equal(await docker('inspect', '--format', '{{index .Config.Labels "steer.integration"}}', containerId), '0018');
        await docker('stop', '--time', '5', containerId);
      }
      encryptionKey.fill(0); closed = true;
    }
    console.log('Removed only this run\'s synthetic authentication PostgreSQL container and tmpfs data.');
  };
  try {
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
    for (const role of ['steer_app', 'steer_projector', 'steer_auth_runtime']) {
      await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    }
    const migrationsFolder = fileURLToPath(new URL('../migrations/', import.meta.resolve('@steer/data')));
    await migrate(drizzle(admin), { migrationsFolder });
    assert.equal((await admin.query('SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations')).rows[0].count, 4);
    const config = { binding, keyring: { currentKeyId: 'synthetic', keys: { synthetic: encryptionKey } } };
    const freshStore = () => createPostgresBrowserSessionStore(connect('steer_auth_runtime'), config);
    const store = freshStore();
    const transactionKeys = async () => (await admin.query<{ key_hash: string }>(
      'SELECT key_hash FROM steer_auth.login_transactions WHERE namespace=$1', [namespace])).rows;
    return { kind: 'postgres', store, freshStore, close,
      wrongKeyStore: () => createPostgresBrowserSessionStore(connect('steer_auth_runtime'), { binding,
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
