import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import type { Pool } from 'pg';
import { createRuntimePool, DatabaseCapacityError } from '../src/runtime-pool.ts';
import { withTenant } from '../src/index.ts';
import type { Principal } from '@steer/tool-registry';

export async function testRuntimePool(deps: { host: string; port: number; password: string; database: string;
  admin: Pool; check: (name: string, run: () => Promise<void>) => Promise<void> }) {
  const pool = createRuntimePool({ host: deps.host, port: deps.port, password: deps.password, database: deps.database,
    user: 'steer_app', transport: { kind: 'isolated-loopback-test' } });
  const principal = (): Principal => ({ subject: 'synthetic', organizationId: 'synthetic-limit-org', type: 'human',
    hats: [], toolGrants: [], expiresAt: new Date(Date.now() + 300000).toISOString() });
  try {
    await deps.check('runtime pool bounds connections and waiting acquisition, then recovers after capacity returns', async () => {
      const previousOptions = process.env.PGOPTIONS;
      process.env.PGOPTIONS = '-c default_transaction_read_only=on';
      let held;
      try { held = await Promise.all(Array.from({ length: 8 }, () => pool.connect())); }
      finally { if (previousOptions === undefined) delete process.env.PGOPTIONS; else process.env.PGOPTIONS = previousOptions; }
      try {
        assert.equal(pool.status().connections, 8);
        assert.equal((await held[0]!.query('SHOW default_transaction_read_only')).rows[0].default_transaction_read_only, 'off');
        const queued = Array.from({ length: 32 }, () => pool.connect().then((client) => { client.release(); return false; }, (cause: unknown) => cause instanceof DatabaseCapacityError));
        assert.equal(pool.status().pending, 32);
        await assert.rejects(pool.connect(), DatabaseCapacityError);
        assert.ok((await Promise.all(queued)).every(Boolean));
        assert.equal(pool.status().pending, 0); assert.equal(pool.status().connections, 8);
      } finally { held.forEach((client) => client.release()); }
      const client = await pool.connect();
      try { assert.equal((await client.query('SELECT 1 AS value')).rows[0].value, 1); } finally { client.release(); }
    });
    await deps.check('server statement timeout aborts SQL and tenant rollback clears context for reuse', async () => {
      await assert.rejects(withTenant(pool, principal(), (client) => client.query('SELECT pg_sleep(6)')),
        (cause: unknown) => (cause as { code?: string }).code === '57014');
      const client = await pool.connect();
      try { assert.equal((await client.query("SELECT current_setting('steer.organization_id', true) AS org")).rows[0].org ?? '', ''); }
      finally { client.release(); }
      assert.equal(await withTenant(pool, principal(), async () => 'recovered'), 'recovered');
    });
    await deps.check('lock contention is cancelled by the server and does not disable future tenant work', async () => {
      const blocker = await deps.admin.connect();
      try {
        await blocker.query('SELECT pg_advisory_lock(220022)');
        await assert.rejects(withTenant(pool, principal(), (client) => client.query('SELECT pg_advisory_xact_lock(220022)')),
          (cause: unknown) => (cause as { code?: string }).code === '55P03');
      } finally { await blocker.query('SELECT pg_advisory_unlock(220022)'); blocker.release(); }
      assert.equal(await withTenant(pool, principal(), async () => 'recovered'), 'recovered');
    });
    await deps.check('transaction entry reapplies server limits after a reused connection was contaminated', async () => {
      const client = await pool.connect();
      try { await client.query("SET statement_timeout=0; SET lock_timeout=0; SET idle_in_transaction_session_timeout=0"); }
      finally { client.release(); }
      await withTenant(pool, principal(), async (current) => {
        const result = await current.query("SELECT current_setting('statement_timeout') AS statement, current_setting('lock_timeout') AS lock, current_setting('idle_in_transaction_session_timeout') AS idle");
        assert.deepEqual(result.rows[0], { statement: '5s', lock: '1s', idle: '5s' });
      });
    });
    await deps.check('idle transaction is terminated server-side and the runtime pool can replace the connection', async () => {
      const client = await pool.connect(); let terminated = false;
      const onError = (cause: Error & { code?: string }) => { if (cause.code === '25P03') terminated = true; };
      client.on('error', onError);
      try {
        await client.query('BEGIN'); await delay(6500);
        assert.equal(terminated, true); await assert.rejects(client.query('SELECT 1'));
      } finally { client.release(true); }
      assert.equal(await withTenant(pool, principal(), async () => 'recovered'), 'recovered');
    });
  } finally { await pool.end(); }
}
