import { Pool } from 'pg';
import { createPostgresBrowserSessionStore } from '../src/browser-session.ts';

// Only spawned by the disposable PostgreSQL harness, with synthetic credentials.
const input = JSON.parse(process.env.STEER_SYNTHETIC_SESSION_TEST!);
const pool = new Pool({ ...input.connection, max: 1, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
try {
  const store = createPostgresBrowserSessionStore(pool, { binding: input.binding,
    keyring: { currentKeyId: 'test', keys: { test: Buffer.from(input.key, 'hex') } } });
  if (input.action === 'read-session') {
    console.log(JSON.stringify({ verified: JSON.stringify(await store.readSession(input.hash)) === JSON.stringify(input.expected), pid: process.pid }));
  } else {
    console.log(JSON.stringify({ consumed: Boolean(await store.consumeTransaction(input.hash)), pid: process.pid }));
  }
} catch { console.error('Synthetic session child failed'); process.exitCode = 1; }
finally { await pool.end(); }
