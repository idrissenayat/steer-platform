import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Pool, PoolClient } from 'pg';
import { scopeReviewFixture } from '../../tool-registry/test/intent-scope-review.fixture.ts';
import { createScopeReviewOperationStore, prepareScopeReviewManifest } from '../src/scope-review-operations.ts';
import { createModelBudgetPermit } from '../src/model-budget.ts';
import type { DatabasePool } from '../src/runtime-pool.ts';

export async function testScopeReviewOperations({ admin, app, connect, check }: {
  admin: Pool; app: Pool; connect(user: string): Pool; check(name: string, run: () => Promise<void>): Promise<void>;
}) {
  const setup = async (cap = 30) => {
    const f = await scopeReviewFixture(40), organizationId = `scope-${randomUUID()}`;
    const scope = { ...f.scope, organizationId }, evidence = { ...f.evidence, organizationId };
    // Rebuild the scope hash after assigning this isolated synthetic tenant.
    const { fingerprintIntentScope } = await import('../../tool-registry/src/intent-revision-contracts.ts');
    evidence.scopeInputDigest = (await fingerprintIntentScope(scope)).scopeInputDigest;
    const manifest = await prepareScopeReviewManifest(scope, evidence, f.profile, 1);
    const budget = { organizationId, budgetId: randomUUID(), subject: 'synthetic-human', configurationRevision: 'scope-r1',
      approvalDigest: 'a'.repeat(64), capMicrousd: cap, architectMicrousd: 3, testAgentMicrousd: 2 };
    const config = { organizationId, subject: budget.subject, productId: manifest.productId, repository: manifest.repository, branch: 'codex/synthetic',
      configurationRevision: budget.configurationRevision, recordsPolicyDigest: 'b'.repeat(64), expiresAt: new Date(Date.now()+3600000).toISOString(), budget,
      scopeTerms: { approvalDigest: 'c'.repeat(64), profileDigest: manifest.profileDigest, amountMicrousd: 4 } };
    await admin.query(`INSERT INTO steer_usage.model_budgets VALUES ($1,$2,$3,$4,$5,$6,3,2,now()-interval '1 minute',now()+interval '1 hour',true)`,
      [organizationId,budget.budgetId,budget.subject,budget.configurationRevision,budget.approvalDigest,cap]);
    await admin.query(`INSERT INTO steer_usage.scope_review_terms VALUES ($1,$2,$3,$4,$5,$6,4,true)`,
      [organizationId,budget.budgetId,budget.subject,budget.configurationRevision,config.scopeTerms.approvalDigest,manifest.profileDigest]);
    const make = (pool: DatabasePool = app, authorize: () => Promise<void> = async () => {}, overrides = {}) =>
      createScopeReviewOperationStore(pool, { ...config, ...overrides }, { authorize });
    const admit = async () => {
      const result = await make().admit(manifest); assert.equal(result.outcome, 'ok');
      if (result.outcome !== 'ok') throw new Error('Synthetic scope admission failed');
      return { reviewId: result.value.reviewId, preparationDigest: manifest.preparationDigest };
    };
    const batchRef = (ref: Awaited<ReturnType<typeof admit>>, index = 0) => ({ ...ref, ...manifest.batches[index]! });
    const claim = (ref: ReturnType<typeof batchRef>, owner = 'worker-1', leaseMs = 300000) => ({ ...ref, owner, leaseMs });
    const dispatch = (ref: ReturnType<typeof batchRef>, owner = 'worker-1', fencingToken = 1) => ({ ...ref, event: { type: 'commit-dispatch', owner, fencingToken } });
    const usage = async () => Number((await admin.query('SELECT COALESCE(sum(amount_microusd),0) AS used FROM steer_usage.model_reservations WHERE budget_id=$1', [budget.budgetId])).rows[0].used);
    return { manifest, config, budget, make, admit, batchRef, claim, dispatch, usage };
  };
  const lostCommit = (pool: Pool): DatabasePool => ({ async connect() {
    const client = await pool.connect();
    return { query: async (sql: string, values?: unknown[]) => {
      const result = await client.query(sql, values); if (sql === 'COMMIT') throw new Error('Synthetic lost acknowledgement'); return result;
    }, release: (broken: boolean) => client.release(broken) } as PoolClient;
  } });
  await check('scope tables force tenant/owner/product isolation with read-only default-inactive role terms', async () => {
    const tables = (await admin.query(`SELECT relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('steer_execution','steer_usage') AND c.relname IN ('scope_review_runs','scope_review_batches','scope_review_terms')`)).rows;
    assert.equal(tables.length, 3); assert.ok(tables.every(r => r.relrowsecurity && r.relforcerowsecurity));
    for (const table of ['steer_execution.scope_review_runs','steer_execution.scope_review_batches','steer_usage.scope_review_terms']) {
      assert.equal((await app.query(`SELECT * FROM ${table}`)).rowCount, 0);
      for (const verb of ['DELETE FROM','TRUNCATE']) await assert.rejects(app.query(`${verb} ${table}`), { code: '42501' });
      for (const role of ['steer_projector','steer_auth_runtime','steer_draft_runtime']) await assert.rejects(connect(role).query(`SELECT * FROM ${table}`), { code: '42501' });
    }
    await assert.rejects(app.query('UPDATE steer_usage.scope_review_terms SET active=true'), { code: '42501' });
    await assert.rejects(app.query("UPDATE steer_execution.scope_review_runs SET manifest='{}'"), { code: '42501' });
    await assert.rejects(app.query('UPDATE steer_execution.scope_review_batches SET reservation_id=gen_random_uuid()'), { code: '42501' });
  });
  await check('parallel scope admission converges after restart and changed configuration cannot recreate exact work', async () => {
    const f = await setup();
    const results = await Promise.all(Array.from({ length: 5 }, () => f.make(connect('steer_app')).admit(f.manifest)));
    assert.ok(results.every(r => r.outcome === 'ok' && !r.dispatchAllowed));
    assert.equal(new Set(results.map(r => r.outcome === 'ok' && r.value.reviewId)).size, 1);
    assert.equal(results.filter(r => r.outcome === 'ok' && r.value.created).length, 1); assert.equal(await f.usage(), 0);
    const ref = await f.admit(); assert.equal((await f.make().inspect(ref)).outcome, 'ok');
    assert.equal((await f.make(app, async () => {}, { expiresAt: new Date(Date.now()+7200000).toISOString() }).admit(f.manifest)).outcome, 'conflict');
    assert.equal((await f.make().admit({ ...f.manifest, planDigest: 'f'.repeat(64) })).outcome, 'conflict');
    assert.equal((await f.make().inspect({ ...ref, preparationDigest: 'f'.repeat(64) })).outcome, 'conflict');
  });
  await check('parallel scope claims reserve once and only one acknowledged transition permits dispatch', async () => {
    const f = await setup(), ref = await f.admit(), batch = f.batchRef(ref);
    const results = await Promise.all(Array.from({ length: 6 }, (_, n) => f.make(connect('steer_app')).claim(f.claim(batch, `worker-${n}`))));
    assert.ok(results.every(r => r.outcome === 'ok' && !r.dispatchAllowed));
    assert.equal(new Set(results.map(r => r.outcome === 'ok' && r.value.reservationId)).size, 1); assert.equal(await f.usage(), 4);
    const winner = results[0]!; if (winner.outcome !== 'ok') throw new Error('Missing claim');
    const sent = await Promise.all(Array.from({ length: 5 }, () => f.make(connect('steer_app')).transition(f.dispatch(batch, winner.value.owner!))));
    assert.ok(sent.every(r => r.outcome === 'ok')); assert.equal(sent.filter(r => r.dispatchAllowed).length, 1);
    assert.equal((await f.make().inspect(ref)).dispatchAllowed, false);
    assert.equal((await f.make().claim(f.claim(batch, 'new-worker'))).dispatchAllowed, false); assert.equal(await f.usage(), 4);
  });
  await check('pre-dispatch takeover reuses its reservation and fences stale workers without post-dispatch takeover', async () => {
    const f = await setup(), ref = await f.admit(), batch = f.batchRef(ref);
    assert.equal((await f.make().claim(f.claim(batch, 'first', 100))).outcome, 'ok'); await delay(150);
    const recovered = await f.make().claim(f.claim(batch, 'second')); assert.equal(recovered.outcome, 'ok');
    if (recovered.outcome !== 'ok') return;
    assert.equal(recovered.value.fencingToken, 2); assert.equal(await f.usage(), 4);
    assert.equal((await f.make().transition(f.dispatch(batch, 'first', 1))).outcome, 'conflict');
    assert.equal((await f.make().transition(f.dispatch(batch, 'second', 2))).dispatchAllowed, true);
    assert.equal((await f.make().transition({ ...batch, event: { type: 'outcome-unknown', owner: 'second', fencingToken: 2 } })).outcome, 'ok');
    assert.equal((await f.make().claim(f.claim(batch, 'third'))).dispatchAllowed, false);
    assert.equal((await f.make().transition(f.dispatch(batch, 'second', 2))).dispatchAllowed, false); assert.equal(await f.usage(), 4);
  });
  await check('lost scope admission, claim and dispatch acknowledgements never create a second charge or dispatch permit', async () => {
    const f = await setup(); assert.equal((await f.make(lostCommit(app)).admit(f.manifest)).outcome, 'unknown');
    const ref = await f.admit(), batch = f.batchRef(ref);
    assert.equal((await f.make(lostCommit(app)).claim(f.claim(batch))).outcome, 'unknown'); assert.equal(await f.usage(), 4);
    assert.equal((await f.make().claim(f.claim(batch))).dispatchAllowed, false);
    const sent = await f.make(lostCommit(app)).transition(f.dispatch(batch)); assert.equal(sent.outcome, 'unknown'); assert.equal(sent.dispatchAllowed, false);
    assert.equal((await f.make().transition(f.dispatch(batch))).dispatchAllowed, false);
    const inspected = await f.make().inspect(ref); assert.equal(inspected.outcome, 'ok');
    if (inspected.outcome === 'ok') assert.equal(inspected.value.batches[0]!.state, 'dispatch-committed');
    assert.equal(await f.usage(), 4);
  });
  await check('scope and drafting roles compete for one total cap in both directions', async () => {
    for (const scopeFirst of [false, true]) {
      const f = await setup(6), ref = await f.admit(), permit = createModelBudgetPermit(app, f.budget);
      const draft = () => permit.reserve({ organizationId: f.budget.organizationId, subject: f.budget.subject, configurationRevision: f.budget.configurationRevision, role: 'architect' });
      if (scopeFirst) { assert.equal((await f.make().claim(f.claim(f.batchRef(ref)))).outcome, 'ok'); assert.equal(await draft(), false); assert.equal(await f.usage(), 4); }
      else { assert.equal(await draft(), true); assert.equal((await f.make().claim(f.claim(f.batchRef(ref)))).outcome, 'unavailable'); assert.equal(await f.usage(), 3); }
    }
    const f = await setup(6), ref = await f.admit();
    assert.equal((await f.make().claim(f.claim(f.batchRef(ref)))).outcome, 'ok');
    assert.equal((await f.make().claim(f.claim(f.batchRef(ref, 1)))).outcome, 'unavailable'); assert.equal(await f.usage(), 4);
  });
  await check('missing, inactive and mismatched scope cost terms cannot reserve; revocation blocks dispatch', async () => {
    for (const change of ["active=false", "amount_microusd=5", "approval_digest=repeat('d',64)", "profile_digest=repeat('d',64)", "configuration_revision='changed'"]) {
      const f = await setup(), ref = await f.admit();
      await admin.query(`UPDATE steer_usage.scope_review_terms SET ${change} WHERE budget_id=$1`, [f.budget.budgetId]);
      assert.equal((await f.make().claim(f.claim(f.batchRef(ref)))).outcome, 'unavailable'); assert.equal(await f.usage(), 0);
    }
    const f = await setup(), ref = await f.admit(), batch = f.batchRef(ref); await f.make().claim(f.claim(batch));
    await admin.query('UPDATE steer_usage.scope_review_terms SET active=false WHERE budget_id=$1', [f.budget.budgetId]);
    assert.equal((await f.make().transition(f.dispatch(batch))).dispatchAllowed, false); assert.equal(await f.usage(), 4);
    const missing = await setup(), missingRef = await missing.admit();
    await admin.query('DELETE FROM steer_usage.scope_review_terms WHERE budget_id=$1', [missing.budget.budgetId]);
    assert.equal((await missing.make().claim(missing.claim(missing.batchRef(missingRef)))).outcome, 'unavailable'); assert.equal(await missing.usage(), 0);
    await admin.query(`INSERT INTO steer_usage.scope_review_terms (organization_id,budget_id,subject,configuration_revision,approval_digest,profile_digest,amount_microusd)
      VALUES ($1,$2,$3,$4,$5,$6,4)`, [missing.budget.organizationId,missing.budget.budgetId,missing.budget.subject,missing.budget.configurationRevision,
      missing.config.scopeTerms.approvalDigest,missing.manifest.profileDigest]);
    assert.equal((await missing.make().claim(missing.claim(missing.batchRef(missingRef)))).outcome, 'unavailable'); assert.equal(await missing.usage(), 0);
  });
  await check('concurrent scope and drafting reservations never exceed their shared cap', async () => {
    const f = await setup(6), ref = await f.admit();
    const results = await Promise.all([
      f.make(connect('steer_app')).claim(f.claim(f.batchRef(ref))),
      createModelBudgetPermit(connect('steer_app'), f.budget).reserve({ organizationId: f.budget.organizationId, subject: f.budget.subject,
        configurationRevision: f.budget.configurationRevision, role: 'architect' }),
    ]);
    assert.equal(Number(results[0].outcome === 'ok') + Number(results[1]), 1);
    assert.ok([3,4].includes(await f.usage()));
  });
  await check('scope reauthorization uses no leased connection and post-COMMIT revocation cannot authorize a call', async () => {
    const f = await setup(), pool = connect('steer_app'); let checks = 0;
    const make = () => f.make(pool, async () => { await pool.query('SELECT 1'); checks++; });
    assert.equal((await make().admit(f.manifest)).outcome, 'ok'); assert.equal(checks, 2);
    const ref = await f.admit(), batch = f.batchRef(ref); await make().claim(f.claim(batch));
    let calls = 0;
    const rejected = await f.make(pool, async () => { if (++calls === 2) throw new Error('Synthetic revoked current authority'); }).transition(f.dispatch(batch));
    assert.equal(rejected.outcome, 'unknown'); assert.equal(rejected.dispatchAllowed, false);
    assert.equal((await f.make().transition(f.dispatch(batch))).dispatchAllowed, false); assert.equal(await f.usage(), 4);
  });
  await check('foreign products, roles, stale inputs and expired reviews cannot acquire scope ownership', async () => {
    const f = await setup(), ref = await f.admit(), batch = f.batchRef(ref);
    for (const overrides of [{ productId: 'other-product' }, { organizationId: 'other-org', budget: { ...f.budget, organizationId: 'other-org' } },
      { subject: 'other-human', budget: { ...f.budget, subject: 'other-human' } }])
      assert.equal((await f.make(app, async () => {}, overrides).inspect(ref)).outcome, 'unavailable');
    assert.equal((await f.make(admin).claim(f.claim(batch))).outcome, 'unavailable');
    for (const patch of [{ batchId: 'f'.repeat(64) }, { inputDigest: 'f'.repeat(64) }])
      assert.equal((await f.make().claim(f.claim({ ...batch, ...patch }))).outcome, 'conflict');
    await admin.query("UPDATE steer_execution.scope_review_runs SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE review_id=$1", [ref.reviewId]);
    assert.equal((await f.make().admit(f.manifest)).outcome, 'unavailable'); assert.equal(await f.usage(), 0);
  });
  await check('SQL rejects private manifest extras, forged success, binding rewrites, stale fences and post-dispatch reset', async () => {
    const f = await setup(), ref = await f.admit(), batch = f.batchRef(ref);
    const claimed = await f.make().claim(f.claim(batch)); assert.equal(claimed.outcome, 'ok'); if (claimed.outcome !== 'ok') return;
    const writeRecord = (record: unknown) => admin.query('UPDATE steer_execution.scope_review_batches SET record=$1::jsonb WHERE review_id=$2', [JSON.stringify(record),ref.reviewId]);
    for (const changed of [{ ...claimed.value, state: 'succeeded', leaseUntil: null, resultDigest: 'f'.repeat(64) },
      { ...claimed.value, binding: { ...claimed.value.binding, inputDigest: 'f'.repeat(64) } },
      { ...claimed.value, fencingToken: 2, owner: 'stolen' }, { ...claimed.value, privateSource: 'must not persist' }])
      await assert.rejects(writeRecord(changed), { code: '23514' });
    await assert.rejects(admin.query(`INSERT INTO steer_execution.scope_review_runs (organization_id,review_id,subject,product_id,draft_id,draft_revision,
      preparation_digest,configuration_digest,manifest,expires_at) SELECT organization_id,$1,subject,product_id,$2,draft_revision,preparation_digest,
      configuration_digest,manifest || '{"privateSource":"must not persist"}'::jsonb,expires_at FROM steer_execution.scope_review_runs WHERE review_id=$3`,
      [randomUUID(),f.manifest.draftId,ref.reviewId]), { code: '23514' });
    assert.equal((await f.make().transition(f.dispatch(batch))).dispatchAllowed, true);
    await assert.rejects(writeRecord({ ...claimed.value, fencingToken: 2 }), { code: '23514' });
    assert.equal((await f.make().transition({ ...batch, event: { type: 'known-failure', owner: 'worker-1', fencingToken: 1 } })).outcome, 'ok');
    assert.equal((await f.make().claim(f.claim(batch, 'resurrected'))).dispatchAllowed, false);
  });
  await check('SQL batch insertion cannot borrow a drafting-role reservation or another batch identity', async () => {
    const f = await setup(), ref = await f.admit(), batch = f.batchRef(ref), claimed = await f.make().claim(f.claim(batch));
    assert.equal(claimed.outcome, 'ok'); if (claimed.outcome !== 'ok') return;
    const wrongReservation = randomUUID(), second = f.batchRef(ref, 1);
    await admin.query(`INSERT INTO steer_usage.model_reservations (organization_id,budget_id,reservation_id,subject,role,amount_microusd)
      VALUES ($1,$2,$3,$4,'architect',3)`, [f.config.organizationId,f.budget.budgetId,wrongReservation,f.config.subject]);
    const record = { ...claimed.value, reservationId: wrongReservation,
      binding: { ...claimed.value.binding, stepId: second.batchId, inputDigest: second.inputDigest } };
    await assert.rejects(admin.query(`INSERT INTO steer_execution.scope_review_batches VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`,
      [f.config.organizationId,ref.reviewId,f.config.subject,f.config.productId,second.batchId,JSON.stringify(record),f.budget.budgetId,wrongReservation]), { code: '23514' });
  });
  await check('hung scope authority holds bounded admission until late completion and never leases SQL', async () => {
    const f = await setup(); let release!: () => void, connects = 0, authorities = 0;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const store = f.make({ async connect() { connects++; return app.connect(); } }, async () => { authorities++; await pending; });
    const outcomes = await Promise.all(Array.from({ length: 8 }, () => store.admit(f.manifest)));
    assert.ok(outcomes.every(r => r.outcome === 'unavailable' && !r.dispatchAllowed));
    assert.equal((await store.admit(f.manifest)).outcome, 'unavailable'); assert.equal(authorities, 8); assert.equal(connects, 0);
    release(); await delay(20);
    assert.equal((await store.admit(f.manifest)).outcome, 'ok'); assert.equal(connects, 1);
    store.close(); assert.equal((await store.admit(f.manifest)).outcome, 'unavailable');
  });
}
