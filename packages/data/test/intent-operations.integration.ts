import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import type { Pool, PoolClient, PoolConfig } from 'pg';
import { createIntentOperationStore, type IntentCheckpointReference } from '../src/intent-operations.ts';
import { createModelBudgetPermit } from '../src/model-budget.ts';
import type { DatabasePool } from '../src/runtime-pool.ts';

export async function testIntentOperations({ admin, app, connect, check, connection }: {
  admin: Pool; app: Pool; connect(user: string): Pool; check(name: string, run: () => Promise<void>): Promise<void>; connection: PoolConfig;
}) {
  // The synthetic readback port persists only fixture bytes in this disposable DB.
  // This is not the missing encrypted draft/result store or a records-policy grant.
  await admin.query('CREATE TABLE public.synthetic_execution_results (id uuid PRIMARY KEY, binding jsonb NOT NULL, content text NOT NULL, policy text NOT NULL)');
  const verifyCheckpoint = async (ref: IntentCheckpointReference) => {
    const row = (await admin.query('SELECT * FROM public.synthetic_execution_results WHERE id=$1', [ref.resultRef])).rows[0];
    if (!row || JSON.stringify(Object.entries(row.binding).sort()) !== JSON.stringify(Object.entries(ref.binding).sort())
      || row.policy !== ref.recordsPolicyDigest || createHash('sha256').update(row.content).digest('hex') !== ref.resultDigest) throw new Error('Synthetic checkpoint mismatch');
  };
  const persist = async (ref: Omit<IntentCheckpointReference, 'resultRef' | 'resultDigest'>) => {
    const resultRef = randomUUID(), content = 'Synthetic result only', resultDigest = createHash('sha256').update(content).digest('hex');
    await admin.query('INSERT INTO public.synthetic_execution_results VALUES ($1,$2,$3,$4)', [resultRef, ref.binding, content, ref.recordsPolicyDigest]);
    return { resultRef, resultDigest };
  };
  const setup = async (action: 'develop' | 'candidate-save' = 'develop', cap = 30) => {
    const budget = { organizationId: `execution-${randomUUID()}`, budgetId: randomUUID(), subject: 'synthetic-human', configurationRevision: 'execution-r1',
      approvalDigest: 'a'.repeat(64), capMicrousd: cap, architectMicrousd: 3, testAgentMicrousd: 2 };
    if (action === 'develop') await admin.query(`INSERT INTO steer_usage.model_budgets VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now()-interval '1 minute',now()+interval '1 hour',true)`,
      [budget.organizationId, budget.budgetId, budget.subject, budget.configurationRevision, budget.approvalDigest, cap, 3, 2]);
    const config = { organizationId: budget.organizationId, subject: budget.subject, productId: 'synthetic-product', repository: 'github:52',
      branch: 'codex/synthetic', action, configurationRevision: budget.configurationRevision, recordsPolicyDigest: 'b'.repeat(64),
      expiresAt: new Date(Date.now() + 3600000).toISOString(), budget: action === 'develop' ? budget : null };
    const make = (pool: DatabasePool = app, authorize: () => Promise<void> = async () => {}, overrides = {}) =>
      createIntentOperationStore(pool, { ...config, ...overrides }, { authorize, verifyCheckpoint });
    const input = { draftId: randomUUID(), draftRevision: 1, inputDigest: 'c'.repeat(64) };
    const create = async () => {
      const result = await make().create(input); assert.equal(result.outcome, 'ok');
      if (result.outcome !== 'ok') throw new Error('Missing synthetic operation');
      return { operationId: result.value.operationId, inputDigest: input.inputDigest };
    };
    const claimInput = (ref: Awaited<ReturnType<typeof create>>, extra = {}) => ({ ...ref, stepId: action === 'develop' ? 'architect' : 'candidate-save',
      stepInputDigest: 'd'.repeat(64), predecessorResultDigest: null as string | null, owner: 'worker-1', leaseMs: 300000, ...extra });
    const stepRef = (claim: ReturnType<typeof claimInput>) => { const { owner: _owner, leaseMs: _lease, ...ref } = claim; return ref; };
    const dispatch = (claim: ReturnType<typeof claimInput>, fencingToken = 1) => ({ ...stepRef(claim), event: { type: 'commit-dispatch', owner: claim.owner, fencingToken } });
    const used = async () => Number((await admin.query('SELECT COALESCE(sum(amount_microusd),0) AS used FROM steer_usage.model_reservations WHERE budget_id=$1', [budget.budgetId])).rows[0].used);
    return { config, budget, make, input, create, claimInput, stepRef, dispatch, used };
  };
  const lostCommit = (pool: Pool): DatabasePool => ({ async connect() {
    const client = await pool.connect();
    return { query: async (sql: string, values?: unknown[]) => {
      const result = await client.query(sql, values); if (sql === 'COMMIT') throw new Error('Synthetic lost COMMIT acknowledgement'); return result;
    }, release: (broken: boolean) => client.release(broken) } as PoolClient;
  } });
  const checkpointFixture = async () => {
    const f = await setup(), ref = await f.create(), claim = f.claimInput(ref), claimed = await f.make().claim(claim);
    assert.equal(claimed.outcome, 'ok'); if (claimed.outcome !== 'ok') throw new Error('Synthetic claim unavailable');
    assert.equal((await f.make().transition(f.dispatch(claim))).dispatchAllowed, true);
    const result = await persist({ binding: claimed.value.record.binding, recordsPolicyDigest: f.config.recordsPolicyDigest });
    const checkpoint = { ...f.stepRef(claim), event: { type: 'checkpoint', owner: claim.owner, fencingToken: 1, ...result } };
    return { ...f, ref, claim, result, checkpoint };
  };

  await check('execution metadata forces owner RLS and forbids binding rewrites, deletion, truncate and foreign roles', async () => {
    const tables = (await admin.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='steer_execution' AND c.relkind='r'")).rows;
    assert.equal(tables.length, 2); assert.ok(tables.every(row => row.relrowsecurity && row.relforcerowsecurity));
    for (const table of ['intent_operations', 'intent_steps']) {
      assert.equal((await app.query(`SELECT * FROM steer_execution.${table}`)).rowCount, 0);
      for (const verb of ['DELETE FROM', 'TRUNCATE']) await assert.rejects(app.query(`${verb} steer_execution.${table}`), { code: '42501' });
    }
    await assert.rejects(app.query("UPDATE steer_execution.intent_operations SET binding='{}'"), { code: '42501' });
    await assert.rejects(app.query("UPDATE steer_execution.intent_steps SET reservation_id=gen_random_uuid()"), { code: '42501' });
    for (const role of ['steer_projector', 'steer_auth_runtime']) await assert.rejects(connect(role).query('SELECT * FROM steer_execution.intent_operations'), { code: '42501' });
  });
  await check('parallel create requests and restart converge on one immutable operation without dispatch', async () => {
    const f = await setup(); const pools = Array.from({ length: 8 }, () => connect('steer_app'));
    for (const pool of pools) await pool.query("SET default_transaction_isolation='repeatable read'");
    const results = await Promise.all(pools.map(pool => f.make(pool).create(f.input)));
    assert.ok(results.every(r => r.outcome === 'ok' && !r.dispatchAllowed));
    assert.equal(new Set(results.map(r => r.outcome === 'ok' ? r.value.operationId : '')).size, 1);
    assert.equal(results.filter(r => r.outcome === 'ok' && r.value.created).length, 1);
    assert.equal(await f.used(), 0);
    assert.equal((await f.make().create({ ...f.input, inputDigest: 'e'.repeat(64) })).outcome, 'conflict');
    const existing = await f.create(); assert.equal((await f.make().inspect(existing)).outcome, 'ok');
    assert.equal((await f.make().inspect({ ...existing, operationId: randomUUID() })).outcome, 'unavailable');
  });
  await check('parallel claims reserve once in the same transaction and expose only one unambiguous dispatch', async () => {
    const f = await setup(), ref = await f.create(), claim = f.claimInput(ref);
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => f.make(connect('steer_app')).claim({ ...claim, owner: `worker-${i}` })));
    assert.ok(results.every(r => r.outcome === 'ok' && !r.dispatchAllowed));
    assert.equal(new Set(results.map(r => r.outcome === 'ok' ? r.value.record.reservationId : '')).size, 1);
    assert.equal(await f.used(), 3);
    const winner = results[0]!; assert.equal(winner.outcome, 'ok'); if (winner.outcome !== 'ok') return;
    const event = f.dispatch({ ...claim, owner: winner.value.record.owner! });
    const sends = await Promise.all(Array.from({ length: 6 }, () => f.make(connect('steer_app')).transition(event)));
    assert.equal(sends.filter(r => r.dispatchAllowed).length, 1);
    assert.ok(sends.every(r => r.outcome === 'ok'));
    assert.equal((await f.make().inspect(ref)).dispatchAllowed, false);
    assert.equal((await f.make().claim({ ...claim, owner: 'later-worker' })).dispatchAllowed, false);
    assert.equal(await f.used(), 3);
  });
  await check('lease takeover before dispatch reuses the charge and fences every stale worker action', async () => {
    const f = await setup(), ref = await f.create(), first = f.claimInput(ref, { leaseMs: 100 });
    assert.equal((await f.make().claim(first)).outcome, 'ok'); await delay(130);
    const second = f.claimInput(ref, { owner: 'worker-2' }), claimed = await f.make().claim(second);
    assert.equal(claimed.outcome, 'ok'); if (claimed.outcome !== 'ok') return;
    assert.equal(claimed.value.record.fencingToken, 2); assert.equal(await f.used(), 3);
    assert.equal((await f.make().transition(f.dispatch(first))).outcome, 'conflict');
    assert.equal((await f.make().transition(f.dispatch(second, 2))).dispatchAllowed, true);
    await delay(10);
    assert.equal((await f.make().claim({ ...second, owner: 'worker-3' })).dispatchAllowed, false);
    assert.equal(await f.used(), 3);
  });
  await check('lost create or claim acknowledgement survives reconstruction without a second operation or reservation', async () => {
    const f = await setup(); assert.equal((await f.make(lostCommit(app)).create(f.input)).outcome, 'unknown');
    const ref = await f.create(), claim = f.claimInput(ref);
    assert.equal((await f.make(lostCommit(app)).claim(claim)).outcome, 'unknown');
    assert.equal(await f.used(), 3);
    assert.equal((await f.make().claim(claim)).dispatchAllowed, false); assert.equal(await f.used(), 3);
    const status = await f.make().inspect(ref); assert.equal(status.outcome, 'ok');
    if (status.outcome === 'ok') assert.equal(status.value.steps[0]?.record.state, 'claimed');
  });
  await check('lost dispatch COMMIT acknowledgement never becomes dispatch permission on retry or status', async () => {
    const f = await setup(), ref = await f.create(), claim = f.claimInput(ref); await f.make().claim(claim);
    const result = await f.make(lostCommit(app)).transition(f.dispatch(claim)); assert.equal(result.outcome, 'unknown'); assert.equal(result.dispatchAllowed, false);
    assert.equal((await f.make().transition(f.dispatch(claim))).dispatchAllowed, false);
    const status = await f.make().inspect(ref); assert.equal(status.outcome, 'ok');
    if (status.outcome === 'ok') assert.equal(status.value.steps[0]?.record.state, 'dispatch-committed');
    assert.equal((await f.make().transition({ ...f.stepRef(claim), event: { type: 'outcome-unknown', fencingToken: 1 } })).outcome, 'ok');
    assert.equal((await f.make().claim({ ...claim, owner: 'resurrected' })).dispatchAllowed, false);
    assert.equal(await f.used(), 3);
  });
  await check('checkpoint requires exact durable readback; the next role resumes without buying another Architect run', async () => {
    const f = await setup(), ref = await f.create(), claim = f.claimInput(ref), saved = await f.make().claim(claim);
    assert.equal(saved.outcome, 'ok'); if (saved.outcome !== 'ok') return;
    const next = f.claimInput(ref, { stepId: 'test-agent', stepInputDigest: 'e'.repeat(64), predecessorResultDigest: 'f'.repeat(64) });
    assert.equal((await f.make().claim(next)).outcome, 'unavailable');
    await f.make().transition(f.dispatch(claim));
    const result = await persist({ binding: saved.value.record.binding, recordsPolicyDigest: f.config.recordsPolicyDigest });
    const checkpoint = { ...f.stepRef(claim), event: { type: 'checkpoint', owner: claim.owner, fencingToken: 1, ...result } };
    assert.equal((await f.make().transition({ ...checkpoint, event: { ...checkpoint.event, resultRef: randomUUID() } })).outcome, 'unknown');
    assert.equal((await f.make(lostCommit(app)).transition(checkpoint)).outcome, 'unknown');
    assert.equal((await f.make().transition(checkpoint)).outcome, 'ok');
    assert.equal((await f.make().transition(f.dispatch(claim))).dispatchAllowed, false);
    const testClaim = { ...next, predecessorResultDigest: result.resultDigest };
    assert.equal((await f.make().claim(testClaim)).outcome, 'ok'); assert.equal(await f.used(), 5);
    assert.equal((await f.make().transition(f.dispatch(testClaim))).dispatchAllowed, true);
    assert.equal((await f.make().transition({ ...f.stepRef(testClaim), event: { type: 'known-failure', owner: claim.owner, fencingToken: 1 } })).outcome, 'ok');
    assert.equal((await f.make().claim(testClaim)).dispatchAllowed, false); assert.equal(await f.used(), 5);
    await admin.query('DELETE FROM public.synthetic_execution_results WHERE id=$1', [result.resultRef]);
    assert.notEqual((await f.make().transition(checkpoint)).outcome, 'ok');
  });
  await check('checkpoint and predecessor readback run after rollback and lease release, even with the same single-connection pool', async () => {
    const f = await checkpointFixture(), pool = connect('steer_app'); let leases = 0, inTransaction = false, verifications = 0;
    const observed: DatabasePool = { async connect() {
      const client = await pool.connect(); leases++;
      return { query: async (sql: string, values?: unknown[]) => {
        const result = await client.query(sql, values);
        if (sql.startsWith('BEGIN')) inTransaction = true;
        if (sql === 'COMMIT' || sql === 'ROLLBACK') inTransaction = false;
        return result;
      }, release: (broken: boolean) => { assert.equal(inTransaction, false); leases--; client.release(broken); } } as PoolClient;
    } };
    const store = createIntentOperationStore(observed, f.config, { authorize: async () => {}, verifyCheckpoint: async target => {
      assert.equal(inTransaction, false); assert.equal(leases, 0); verifications++;
      // This query needs the exact pool lease the preflight used. It also proves
      // that no execution/usage context is inherited by the external result reader.
      assert.equal((await pool.query('SELECT * FROM steer_execution.intent_steps')).rowCount, 0);
      assert.equal((await pool.query('SELECT * FROM steer_usage.model_reservations')).rowCount, 0);
      await verifyCheckpoint(target);
    } });
    assert.equal((await store.transition(f.checkpoint)).outcome, 'ok');
    const next = f.claimInput(f.ref, { stepId: 'test-agent', stepInputDigest: 'e'.repeat(64), predecessorResultDigest: f.result.resultDigest });
    assert.equal((await store.claim(next)).outcome, 'ok');
    assert.equal((await store.transition(f.dispatch(next))).dispatchAllowed, true);
    assert.equal(verifications, 3); assert.equal(leases, 0); assert.equal(await f.used(), 5); store.close();
  });
  await check('a quarantine recorded during checkpoint readback is reread and cannot be overwritten by the preflight', async () => {
    const f = await checkpointFixture(), pool = connect('steer_app'); let calls = 0;
    const store = createIntentOperationStore(pool, f.config, { authorize: async () => {}, verifyCheckpoint: async target => {
      calls++; await verifyCheckpoint(target);
      const quarantined = await f.make(pool).transition({ ...f.stepRef(f.claim), event: { type: 'outcome-unknown', fencingToken: 1 } });
      assert.equal(quarantined.outcome, 'ok');
    } });
    assert.equal((await store.transition(f.checkpoint)).outcome, 'conflict'); assert.equal(calls, 1);
    const current = await f.make().inspect(f.ref); assert.equal(current.outcome, 'ok');
    if (current.outcome === 'ok') assert.equal(current.value.steps[0]?.record.state, 'outcome-unknown');
    assert.equal((await f.make().transition(f.dispatch(f.claim))).dispatchAllowed, false); assert.equal(await f.used(), 3); store.close();
  });
  await check('readback does not grant current authority or bypass a budget revoked before the second transaction', async () => {
    const f = await checkpointFixture(); let denied = false;
    const store = createIntentOperationStore(app, f.config, { authorize: async () => { if (denied) throw new Error('private-revocation-marker'); },
      verifyCheckpoint: async target => { await verifyCheckpoint(target); denied = true; } });
    const rejected = await store.transition(f.checkpoint); assert.notEqual(rejected.outcome, 'ok');
    assert.equal(JSON.stringify(rejected).includes('private-revocation-marker'), false); assert.equal(rejected.dispatchAllowed, false);
    assert.equal((await f.make().transition(f.checkpoint)).outcome, 'ok');
    const next = f.claimInput(f.ref, { stepId: 'test-agent', stepInputDigest: 'e'.repeat(64), predecessorResultDigest: f.result.resultDigest });
    const revokedBudget = createIntentOperationStore(app, f.config, { authorize: async () => {}, verifyCheckpoint: async target => {
      await verifyCheckpoint(target); await admin.query('UPDATE steer_usage.model_budgets SET active=false WHERE budget_id=$1', [f.budget.budgetId]);
    } });
    assert.equal((await revokedBudget.claim(next)).outcome, 'unavailable'); assert.equal(await f.used(), 3);
    store.close(); revokedBudget.close();
  });
  await check('expired readback proof cannot checkpoint after slow reauthorization and never authorizes another dispatch', async () => {
    const f = await checkpointFixture(); let authorizations = 0, readbacks = 0;
    const store = createIntentOperationStore(app, f.config, {
      authorize: async () => { if (++authorizations === 3) await delay(2700); },
      verifyCheckpoint: async target => { readbacks++; await verifyCheckpoint(target); await delay(2700); },
    });
    assert.equal((await store.transition(f.checkpoint)).outcome, 'unavailable'); assert.equal(readbacks, 1);
    const current = await f.make().inspect(f.ref); assert.equal(current.outcome, 'ok');
    if (current.outcome === 'ok') assert.equal(current.value.steps[0]?.record.state, 'dispatch-committed');
    assert.equal((await f.make().transition(f.dispatch(f.claim))).dispatchAllowed, false); store.close();
  });
  await check('timed-out readback retains all admission slots until callbacks drain, with no held SQL leases or late checkpoints', async () => {
    const f = await checkpointFixture(); let release!: () => void, entered = 0;
    const held = new Promise<void>(resolve => { release = resolve; });
    const store = createIntentOperationStore(app, f.config, { authorize: async () => {}, verifyCheckpoint: async target => {
      await verifyCheckpoint(target); entered++; await held;
    } });
    const requests = Array.from({ length: 8 }, () => store.transition(f.checkpoint));
    const limit = Date.now() + 2500;
    while (entered < 8 && Date.now() < limit) await delay(5);
    assert.equal(entered, 8); assert.equal((await store.transition(f.checkpoint)).outcome, 'unavailable');
    // The callbacks can stall, but all pool leases have already been returned.
    assert.equal((await app.query('SELECT * FROM steer_execution.intent_steps')).rowCount, 0);
    assert.ok((await Promise.all(requests)).every(result => result.outcome === 'unavailable' && !result.dispatchAllowed));
    assert.equal((await store.transition(f.checkpoint)).outcome, 'unavailable'); assert.equal(entered, 8);
    release(); await delay(20);
    const current = await f.make().inspect(f.ref); assert.equal(current.outcome, 'ok');
    if (current.outcome === 'ok') assert.equal(current.value.steps[0]?.record.state, 'dispatch-committed');
    assert.equal((await store.transition(f.checkpoint)).outcome, 'ok'); assert.equal(entered, 9); assert.equal(await f.used(), 3); store.close();
  });
  await check('wrong checkpoint owner or fence is rejected before external readback and failed preflight rollback cannot proceed', async () => {
    const f = await checkpointFixture(); let reads = 0, evicted = false;
    const dependencies = { authorize: async () => {}, verifyCheckpoint: async (target: IntentCheckpointReference) => { reads++; await verifyCheckpoint(target); } };
    const store = createIntentOperationStore(app, f.config, dependencies);
    for (const patch of [{ owner: 'wrong-worker' }, { fencingToken: 2 }])
      assert.equal((await store.transition({ ...f.checkpoint, event: { ...f.checkpoint.event, ...patch } })).outcome, 'conflict');
    assert.equal(reads, 0);
    const broken: DatabasePool = { async connect() { const client = await app.connect(); return {
      query: async (sql: string, values?: unknown[]) => { if (sql === 'ROLLBACK') throw new Error('private-rollback-failure'); return client.query(sql, values); },
      release: (destroy: boolean) => { evicted = destroy; client.release(destroy); },
    } as PoolClient; } };
    const unavailable = createIntentOperationStore(broken, f.config, dependencies);
    assert.equal((await unavailable.transition(f.checkpoint)).outcome, 'unknown'); assert.equal(evicted, true); assert.equal(reads, 0);
    assert.equal((await f.make().transition(f.checkpoint)).outcome, 'ok'); store.close(); unavailable.close();
  });
  await check('close during external checkpoint readback prevents a late second transaction or checkpoint', async () => {
    const f = await checkpointFixture(); let release!: () => void, entered!: () => void, acquisitions = 0;
    const held = new Promise<void>(resolve => { release = resolve; }), reached = new Promise<void>(resolve => { entered = resolve; });
    const observed: DatabasePool = { connect: async () => { acquisitions++; return app.connect(); } };
    const store = createIntentOperationStore(observed, f.config, { authorize: async () => {}, verifyCheckpoint: async target => {
      await verifyCheckpoint(target); entered(); await held;
    } });
    const pending = store.transition(f.checkpoint); await reached; assert.equal(acquisitions, 1); store.close(); release();
    assert.equal((await pending).outcome, 'unavailable'); assert.equal(acquisitions, 1);
    const current = await f.make().inspect(f.ref); assert.equal(current.outcome, 'ok');
    if (current.outcome === 'ok') assert.equal(current.value.steps[0]?.record.state, 'dispatch-committed');
  });
  await check('missing and mismatched budgets roll back new claims, including the append-only reservation', async () => {
    const f = await setup('develop', 3), ref = await f.create(), claim = f.claimInput(ref);
    const failInsert: DatabasePool = { async connect() { const client = await app.connect(); return {
      query: async (sql: string, values?: unknown[]) => {
        if (sql.startsWith('INSERT INTO steer_execution.intent_steps')) throw new Error('Synthetic step insert failure');
        return client.query(sql, values);
      }, release: (broken: boolean) => client.release(broken),
    } as PoolClient; } };
    assert.equal((await f.make(failInsert).claim(claim)).outcome, 'unknown'); assert.equal(await f.used(), 0);
    assert.equal((await f.make().claim(claim)).outcome, 'ok');
    const second = await f.make().create({ ...f.input, draftId: randomUUID() }); assert.equal(second.outcome, 'ok');
    if (second.outcome === 'ok') assert.equal((await f.make().claim(f.claimInput({ ...ref, operationId: second.value.operationId }))).outcome, 'unavailable');
    await admin.query('UPDATE steer_usage.model_budgets SET active=false WHERE budget_id=$1', [f.budget.budgetId]);
    assert.equal((await f.make().transition(f.dispatch(claim))).dispatchAllowed, false); assert.equal(await f.used(), 3);
  });
  await check('legacy permits and durable step claims share the same serialized spending cap', async () => {
    const f = await setup('develop', 3), ref = await f.create();
    const [legacy, step] = await Promise.all([
      createModelBudgetPermit(connect('steer_app'), f.budget).reserve({ organizationId: f.budget.organizationId, subject: f.budget.subject, configurationRevision: f.budget.configurationRevision, role: 'architect' }),
      f.make(connect('steer_app')).claim(f.claimInput(ref)),
    ]);
    assert.equal(Number(legacy) + Number(step.outcome === 'ok'), 1); assert.equal(await f.used(), 3);
  });
  await check('candidate-save has the same one-way dispatch protocol but no model charge or provider effect', async () => {
    const f = await setup('candidate-save'), ref = await f.create(), claim = f.claimInput(ref);
    assert.equal((await f.make().claim(claim)).outcome, 'ok');
    assert.equal((await f.make().transition(f.dispatch(claim))).dispatchAllowed, true);
    assert.equal((await f.make().transition(f.dispatch(claim))).dispatchAllowed, false);
    assert.equal(await f.used(), 0);
    assert.equal((await f.make().claim({ ...claim, stepId: 'architect' })).outcome, 'conflict');
  });
  await check('four independent Node processes compete for one dispatch and fresh processes recover status without permission', async () => {
    const f = await setup('candidate-save'), ref = await f.create(), claim = f.claimInput(ref); await f.make().claim(claim);
    const run = promisify(execFile);
    const child = async (action: string, request: unknown) => {
      const result = await run(process.execPath, [fileURLToPath(new URL('./intent-operation.child.ts', import.meta.url))],
        { env: { STEER_SYNTHETIC_EXECUTION_TEST: JSON.stringify({ connection, config: f.config, action, request }) }, timeout: 15000 });
      return JSON.parse(result.stdout);
    };
    const sent = await Promise.all(Array.from({ length: 4 }, () => child('dispatch', f.dispatch(claim))));
    assert.equal(new Set(sent.map(r => r.pid)).size, 4); assert.ok(sent.every(r => r.pid !== process.pid && r.outcome === 'ok'));
    assert.equal(sent.filter(r => r.dispatchAllowed).length, 1);
    const reads = [await child('inspect', ref), await child('inspect', ref)];
    assert.notEqual(reads[0].pid, reads[1].pid);
    assert.ok(reads.every(r => r.outcome === 'ok' && r.state === 'dispatch-committed' && !r.dispatchAllowed));
    assert.equal(await f.used(), 0);
  });
  await check('foreign owner/configuration/input, expiry and unknown IDs cannot recreate or advance jobs', async () => {
    const f = await setup(), ref = await f.create(), claim = f.claimInput(ref);
    assert.equal((await f.make(app, async () => {}, { subject: 'foreign', budget: { ...f.budget, subject: 'foreign' } }).inspect(ref)).outcome, 'unavailable');
    assert.equal((await f.make(app, async () => {}, { recordsPolicyDigest: 'e'.repeat(64) }).inspect(ref)).outcome, 'conflict');
    assert.equal((await f.make().claim({ ...claim, operationId: randomUUID() })).outcome, 'unavailable');
    await f.make().claim(claim);
    assert.equal((await f.make().claim({ ...claim, stepInputDigest: 'f'.repeat(64) })).outcome, 'conflict');
    assert.equal((await f.make().transition({ ...f.dispatch(claim), inputDigest: 'f'.repeat(64) })).outcome, 'conflict');
    await admin.query("UPDATE steer_execution.intent_operations SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE operation_id=$1", [ref.operationId]);
    assert.equal((await f.make().inspect(ref)).outcome, 'unavailable'); assert.equal((await f.make().create(f.input)).outcome, 'unavailable');
    assert.equal((await admin.query('SELECT count(*) AS count FROM steer_execution.intent_operations WHERE organization_id=$1', [f.config.organizationId])).rows[0].count, '1');
  });
  await check('authorization loss after dispatch COMMIT withholds permission and SQL context is scrubbed', async () => {
    const f = await setup(), ref = await f.create(), claim = f.claimInput(ref); await f.make().claim(claim);
    let checks = 0;
    const revoked = f.make(app, async () => { if (++checks === 2) throw new Error('Synthetic revoked identity'); });
    const result = await revoked.transition(f.dispatch(claim)); assert.equal(result.outcome, 'unknown'); assert.equal(result.dispatchAllowed, false);
    assert.equal((await f.make().transition(f.dispatch(claim))).dispatchAllowed, false);
    assert.equal((await app.query('SELECT * FROM steer_execution.intent_steps')).rowCount, 0);
    assert.equal((await app.query('SELECT * FROM steer_usage.model_reservations')).rowCount, 0);
  });
  await check('runtime roles and database transition guard cannot reset a sent step or rewrite its binding', async () => {
    const f = await setup('candidate-save'), ref = await f.create(), claim = f.claimInput(ref); await f.make().claim(claim);
    for (const pool of [admin, connect('steer_projector'), connect('steer_auth_runtime')]) assert.equal((await f.make(pool).inspect(ref)).outcome, 'unavailable');
    await f.make().transition(f.dispatch(claim));
    const client = await app.connect();
    try {
      await client.query("SELECT set_config('steer.execution_organization',$1,false),set_config('steer.execution_subject',$2,false)", [f.config.organizationId, f.config.subject]);
      await assert.rejects(client.query("UPDATE steer_execution.intent_steps SET record=jsonb_set(record,'{state}','\"claimed\"') WHERE operation_id=$1", [ref.operationId]), { code: '23514' });
      await assert.rejects(client.query("UPDATE steer_execution.intent_steps SET record=record-'state' WHERE operation_id=$1", [ref.operationId]), { code: '23514' });
      await assert.rejects(client.query("UPDATE steer_execution.intent_steps SET record=jsonb_set(record,'{binding,inputDigest}',to_jsonb($2::text)) WHERE operation_id=$1", [ref.operationId, 'e'.repeat(64)]), { code: '23514' });
      await client.query("SELECT set_config('steer.execution_organization','',false),set_config('steer.execution_subject','',false)");
    } finally { client.release(); }
    const closed = f.make(); closed.close(); assert.equal((await closed.inspect(ref)).outcome, 'unavailable');
  });
}
