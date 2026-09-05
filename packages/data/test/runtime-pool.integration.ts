import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import type { Pool } from 'pg';
import { createRuntimePool, DatabaseCapacityError, DatabaseCommitOutcomeUnknownError } from '../src/runtime-pool.ts';
import { withTenant } from '../src/index.ts';
import type { Principal } from '@steer/tool-registry';
import { createPostgresRelay } from './postgres-relay.ts';

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
    await deps.check('a checked-out connection failing between queries is observed without crashing and is evicted', async () => {
      const before = pool.status().activeErrors;
      const client = await pool.connect();
      try {
        const pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid as number;
        assert.ok(Number.isInteger(pid) && pid > 0);
        await deps.admin.query('SELECT pg_terminate_backend($1)', [pid]);
        for (let attempt = 0; attempt < 50 && pool.status().activeErrors === before; attempt++) await delay(20);
        assert.ok(pool.status().activeErrors > before);
        await assert.rejects(client.query('SELECT 1'));
      } finally { client.release(); }
      assert.equal(pool.status().active, 0);
      assert.equal(await withTenant(pool, principal(), async () => 'recovered'), 'recovered');
    });
    await deps.check('shutdown stops admission while an ordinary active lease drains without forced eviction', async () => {
      const closing = createRuntimePool({ host: deps.host, port: deps.port, password: deps.password, database: deps.database,
        user: 'steer_app', transport: { kind: 'isolated-loopback-test' } });
      const client = await closing.connect(); let drained = false;
      const stop = closing.shutdown(); assert.equal(closing.shutdown(), stop);
      void stop.then(() => { drained = true; });
      await assert.rejects(closing.connect(), DatabaseCapacityError);
      await delay(20); assert.equal(drained, false);
      assert.equal((await client.query('SELECT 1 AS value')).rows[0].value, 1);
      client.release(); await stop;
      assert.equal(closing.status().active, 0); assert.equal(closing.status().connections, 0);
      assert.equal(closing.status().forcedReleases, 0);
    });
    await deps.check('lost COMMIT acknowledgement remains an unknown caller outcome; shutdown evicts without retry', async () => {
      const relay = await createPostgresRelay(deps.port);
      const closing = createRuntimePool({ host: '127.0.0.1', port: relay.port, password: deps.password, database: deps.database,
        user: 'steer_projector', transport: { kind: 'isolated-loopback-test' } });
      let calls = 0; let settled = false;
      try {
        const outcome = withTenant(closing, principal(), async (client) => {
          calls++;
          await client.query('INSERT INTO steer.ingestion_events VALUES ($1,$2,$3,$4,$5,now())',
            [principal().organizationId, 'synthetic-commit-ack-loss', 'synthetic/repo', 'a'.repeat(40), 'b'.repeat(64)]);
          relay.cutReplies();
          return 'must-not-claim-confirmed';
        }).then(() => { settled = true; return false; }, (cause: unknown) => { settled = true; return cause instanceof DatabaseCommitOutcomeUnknownError; });
        let committed = 0;
        for (let attempt = 0; attempt < 75 && !committed; attempt++) {
          committed = (await deps.admin.query('SELECT count(*)::int AS count FROM steer.ingestion_events WHERE organization_id=$1 AND event_id=$2',
            [principal().organizationId, 'synthetic-commit-ack-loss'])).rows[0].count;
          if (!committed) await delay(20);
        }
        assert.equal(committed, 1, 'Only the independent test observer knows the commit succeeded');
        assert.equal(settled, false);
        const started = performance.now(); await closing.shutdown();
        assert.ok(performance.now() - started < 8000);
        assert.equal(await outcome, true); assert.equal(calls, 1);
        assert.equal(closing.status().forcedReleases, 1); assert.equal(closing.status().active, 0);
        assert.equal(closing.status().connections, 0);
      } finally { await closing.shutdown(); await relay.close(); }
    });
  } finally { await pool.end(); }
}
