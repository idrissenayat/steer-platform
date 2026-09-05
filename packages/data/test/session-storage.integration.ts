import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import type { Pool, PoolConfig } from 'pg';
import { createPostgresBrowserSessionStore, sessionNamespace } from '../src/browser-session.ts';

export async function testBrowserSessionStorage(deps: { admin: Pool; app: Pool; projector: Pool;
  connect: (role: string) => Pool; connection: PoolConfig;
  check: (name: string, run: () => Promise<void>) => Promise<void> }) {
  const { admin, app, projector, connect, check } = deps;
  const auth = connect('steer_auth_runtime'); const auth2 = connect('steer_auth_runtime');
  const binding = { issuer: 'https://synthetic.example/realm', clientId: 'steer', redirectUri: 'https://synthetic.example/callback' };
  const namespace = sessionNamespace(binding); const key = randomBytes(32);
  const keyring = { currentKeyId: 'test', keys: { test: key } };
  const store = createPostgresBrowserSessionStore(auth, { binding, keyring });
  const second = createPostgresBrowserSessionStore(auth2, { binding, keyring });
  const other = createPostgresBrowserSessionStore(auth, { binding: { ...binding, clientId: 'other' }, keyring });
  const id = () => randomBytes(32).toString('hex');
  const session = () => ({ accessToken: 'synthetic-secret-access', subject: 'synthetic-human', organizationId: 'synthetic-org', createdAt: Date.now(), expiresAt: Date.now() + 240000 });
  const transaction = () => ({ browserHash: id(), verifier: randomBytes(32).toString('base64url'), nonce: randomBytes(32).toString('base64url'), createdAt: Date.now(), expiresAt: Date.now() + 240000 });
  await check('auth tables force namespace RLS and isolate runtime roles from business data', async () => {
    const rows = (await admin.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='steer_auth' AND c.relkind='r'")).rows;
    assert.equal(rows.length, 2); assert.ok(rows.every((row) => row.relrowsecurity && row.relforcerowsecurity));
    for (const pool of [app, projector]) await assert.rejects(pool.query('SELECT * FROM steer_auth.browser_sessions'), /permission denied/);
    await assert.rejects(auth.query('SELECT * FROM steer.projection_records'), /permission denied/);
    for (const sql of ['UPDATE steer_auth.browser_sessions SET encrypted_value=encrypted_value', 'TRUNCATE steer_auth.browser_sessions']) await assert.rejects(auth.query(sql), /permission denied/);
    await assert.rejects(createPostgresBrowserSessionStore(admin, { binding, keyring }).readSession(id()), /Session storage/);
  });
  await check('encrypted records survive store restart while same-key namespaces and reused connections stay isolated', async () => {
    const hash = id(); const value = session();
    assert.equal(await store.insertSession(hash, value), true);
    assert.equal(await store.insertSession(hash, value), false);
    assert.equal(await other.readSession(hash), null);
    assert.equal(await other.insertSession(hash, { ...value, subject: 'other-human' }), true);
    assert.deepEqual(await second.readSession(hash), value);
    // Each reader exits; the next process recovers the same encrypted session.
    const readInput = { connection: deps.connection, binding, key: key.toString('hex'), hash, action: 'read-session', expected: value };
    const runChild = promisify(execFile); const readerPids: number[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await runChild(process.execPath, [fileURLToPath(new URL('./consume-login.child.ts', import.meta.url))],
        { env: { ...process.env, STEER_SYNTHETIC_SESSION_TEST: JSON.stringify(readInput) }, timeout: 15000 });
      const output = JSON.parse(result.stdout); assert.equal(output.verified, true); readerPids.push(output.pid);
    }
    assert.notEqual(readerPids[0], readerPids[1]);
    assert.equal((await other.readSession(hash) as { subject: string }).subject, 'other-human');
    const raw = (await admin.query('SELECT encrypted_value FROM steer_auth.browser_sessions WHERE namespace=$1 AND key_hash=$2', [namespace, hash])).rows[0].encrypted_value;
    assert.ok(!JSON.stringify(raw).includes(value.accessToken)); assert.ok(!JSON.stringify(raw).includes(value.subject));
    assert.equal((await auth.query('SELECT * FROM steer_auth.browser_sessions')).rowCount, 0);
    await auth.query("SELECT set_config('steer.auth_namespace', $1, false)", [sessionNamespace({ ...binding, clientId: 'other' })]);
    assert.deepEqual(await store.readSession(hash), value);
    assert.equal((await auth.query('SELECT * FROM steer_auth.browser_sessions')).rowCount, 0);
    await store.deleteSession(hash); assert.equal(await second.readSession(hash), null);
    assert.ok(await other.readSession(hash));
  });
  await check('namespace policy rejects foreign inserts and database TTL constraint rejects long retention', async () => {
    const client = await auth.connect();
    try {
      for (const foreign of [true, false]) {
        await client.query('BEGIN'); await client.query("SELECT set_config('steer.auth_namespace', $1, true)", [namespace]);
        await assert.rejects(client.query('INSERT INTO steer_auth.browser_sessions VALUES ($1,$2,$3,now(),now()+$4::interval)', [foreign ? id() : namespace, id(), {}, foreign ? '4 minutes' : '6 minutes']), foreign ? /row-level security/ : /check constraint/);
        await client.query('ROLLBACK');
      }
    } finally { client.release(); }
  });
  await check('two separate Node processes consume one login exactly once', async () => {
    const hash = id(); assert.equal(await store.insertTransaction(hash, transaction()), true);
    const run = promisify(execFile);
    const env = { ...process.env, STEER_SYNTHETIC_SESSION_TEST: JSON.stringify({ connection: deps.connection, binding, key: key.toString('hex'), hash }) };
    const results = await Promise.all([1, 2].map(() => run(process.execPath, [fileURLToPath(new URL('./consume-login.child.ts', import.meta.url))], { env, timeout: 15000 })));
    const outputs = results.map((result) => JSON.parse(result.stdout));
    assert.notEqual(outputs[0].pid, outputs[1].pid);
    assert.deepEqual(outputs.map((value) => value.consumed).sort(), [false, true]);
    assert.equal(await store.consumeTransaction(hash), null);
  });
  await check('capacity is bounded under concurrent stores; expiry reclaims only ephemeral namespace rows', async () => {
    let time = Date.now(); const config = { binding: { ...binding, clientId: 'capacity' }, keyring, maxEntriesPerKind: 2, now: () => new Date(time) };
    const a = createPostgresBrowserSessionStore(auth, config); const b = createPostgresBrowserSessionStore(auth2, config);
    const value = { ...session(), createdAt: time, expiresAt: time + 1000 }; const hashes = [id(), id(), id(), id()];
    const results = await Promise.all(hashes.map((hash, i) => (i % 2 ? a : b).insertSession(hash, value)));
    assert.equal(results.filter(Boolean).length, 2);
    time += 1001; assert.equal(await a.readSession(hashes[0]!), null);
    assert.equal(await a.insertSession(id(), { ...value, createdAt: time, expiresAt: time + 1000 }), true);
    assert.equal((await admin.query('SELECT count(*)::int AS count FROM steer_auth.browser_sessions WHERE namespace=$1', [sessionNamespace(config.binding)])).rows[0].count, 1);
    await assert.rejects(a.insertSession(id(), value), /Session storage/);
    await assert.rejects(a.insertSession(id(), { ...value, createdAt: time + 1, expiresAt: time + 1000 }), /Session storage/);
  });
  await check('ciphertext transplants fail and corrupt consumed transactions are not restored', async () => {
    const hash = id(); const target = id(); assert.equal(await store.insertSession(hash, session()), true);
    await admin.query('INSERT INTO steer_auth.browser_sessions SELECT namespace,$1,encrypted_value,created_at,expires_at FROM steer_auth.browser_sessions WHERE namespace=$2 AND key_hash=$3', [target, namespace, hash]);
    await assert.rejects(store.readSession(target), /Session storage/);
    const login = id(); assert.equal(await store.insertTransaction(login, transaction()), true);
    await admin.query("UPDATE steer_auth.login_transactions SET encrypted_value='{}' WHERE namespace=$1 AND key_hash=$2", [namespace, login]);
    await assert.rejects(store.consumeTransaction(login), /Session storage/);
    assert.equal(await second.consumeTransaction(login), null);
  });
  await check('persistent key rotation keeps old sessions readable and unknown keys fail closed', async () => {
    const hash = id(); const value = session(); assert.equal(await store.insertSession(hash, value), true);
    const next = randomBytes(32);
    const rotated = createPostgresBrowserSessionStore(auth2, { binding, keyring: { currentKeyId: 'next', keys: { test: key, next } } });
    assert.deepEqual(await rotated.readSession(hash), value);
    const newHash = id(); assert.equal(await rotated.insertSession(newHash, value), true);
    assert.equal((await admin.query('SELECT encrypted_value FROM steer_auth.browser_sessions WHERE namespace=$1 AND key_hash=$2', [namespace, newHash])).rows[0].encrypted_value.keyId, 'next');
    await assert.rejects(store.readSession(newHash), /Session storage/);
  });
}
