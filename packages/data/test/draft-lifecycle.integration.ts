import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { createDraftLifecycleStore } from '../src/draft-lifecycle.ts';
import type { DatabasePool } from '../src/runtime-pool.ts';

type Dependencies = Parameters<typeof createDraftLifecycleStore>[2];
const ok = (r: Awaited<ReturnType<ReturnType<typeof createDraftLifecycleStore>['inspect']>>) => {
  assert.equal(r.outcome, 'ok'); if (r.outcome !== 'ok') throw new Error('Synthetic lifecycle unavailable'); return r.value;
};
export async function testDraftLifecycles({ admin, connect, check }: {
  admin: Pool; connect(role: string): Pool; check(name: string, run: () => Promise<void>): Promise<void>;
}) {
  const fresh = () => {
    const config = { organizationId: `org-${randomUUID()}`, subject: 'synthetic-human', productId: 'product', repository: 'github:52',
      branch: 'codex/fixture', configurationRevision: 'draft-r1', recordsPolicyDigest: 'a'.repeat(64) };
    const pool = connect('steer_draft_runtime'), request = { requestId: randomUUID() };
    const make = (dependencies: Partial<Dependencies> = {}, otherPool: DatabasePool = pool, patch = {}) => createDraftLifecycleStore(otherPool, { ...config, ...patch },
      { authorize: async () => {}, ...dependencies });
    return { config, pool, request, make, create: async () => ok(await make().create(request)) };
  };
  await check('draft creation mints one server ID and database clock across concurrent requests and reconstruction', async () => {
    const f = fresh(), before = Date.now();
    const results = await Promise.all(Array.from({ length: 4 }, () => f.make({}, connect('steer_draft_runtime')).create(f.request)));
    const values = results.map(ok), value = values[0]!; assert.equal(new Set(values.map(v => v.draftId)).size, 1);
    assert.notEqual(value.draftId, f.request.requestId); assert.ok(Date.parse(value.createdAt) >= before && Date.parse(value.createdAt) <= Date.now());
    assert.equal(Date.parse(value.retentionDeadline) - Date.parse(value.createdAt), 168 * 3600000);
    assert.equal(value.useUntil, value.retentionDeadline); assert.equal(value.held, false); assert.equal(value.expired, false);
    assert.deepEqual(ok(await f.make().create(f.request)), value);
    assert.equal((await f.make({}, f.pool, { configurationRevision: 'changed' }).create(f.request)).outcome, 'conflict');
    assert.throws(() => f.make().create({ ...f.request, createdAt: value.createdAt }));
    assert.throws(() => f.make().create({ ...f.request, draftId: randomUUID() }));
  });
  await check('lifecycle metadata is forced owner/product RLS and denies foreign identities and privileged database pools', async () => {
    const f = fresh(), value = await f.create(), target = { draftId: value.draftId };
    for (const patch of [{ organizationId: 'foreign' }, { subject: 'foreign' }, { productId: 'foreign' }, { recordsPolicyDigest: 'b'.repeat(64) }])
      assert.notEqual((await f.make({}, f.pool, patch).inspect(target)).outcome, 'ok');
    for (const role of ['steer_app', 'steer_auth_runtime', 'steer_projector']) {
      const pool = connect(role); assert.notEqual((await f.make({}, pool).inspect(target)).outcome, 'ok');
      await assert.rejects(pool.query('SELECT * FROM steer_drafts.draft_lifecycles'), /permission denied/);
    }
    assert.notEqual((await f.make({}, admin).inspect(target)).outcome, 'ok');
    assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM steer_drafts.draft_lifecycles')).rows[0].n, 0);
    const table = (await admin.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='steer_drafts.draft_lifecycles'::regclass")).rows[0];
    assert.deepEqual(table, { relrowsecurity: true, relforcerowsecurity: true });
    assert.deepEqual(await f.make().lifecycle({ ...f.config, draftId: value.draftId }), { createdAt: value.createdAt, useUntil: value.useUntil, held: false });
    await assert.rejects(f.make().lifecycle({ ...f.config, subject: 'foreign', draftId: value.draftId }));
  });
  await check('explicit discard records one server observation and sixty-second use window without deletion or renewal', async () => {
    const f = fresh(), original = await f.create(), target = { draftId: original.draftId }, actions: string[] = [];
    const store = f.make({ authorize: async ctx => { actions.push(ctx.action); } }), before = Date.now();
    const discarded = ok(await store.discard(target));
    assert.ok(Date.parse(discarded.discardedAt!) >= before && Date.parse(discarded.discardedAt!) <= Date.now());
    assert.equal(Date.parse(discarded.useUntil) - Date.parse(discarded.discardedAt!), 60000);
    assert.equal(discarded.createdAt, original.createdAt); assert.equal(discarded.retentionDeadline, original.retentionDeadline);
    assert.deepEqual(ok(await f.make().discard(target)), discarded); assert.deepEqual(ok(await f.make().create(f.request)), discarded);
    assert.ok(actions.every(action => action === 'discard'));
    assert.equal((await admin.query('SELECT count(*)::int AS n FROM steer_drafts.draft_lifecycles WHERE draft_id=$1', [original.draftId])).rows[0].n, 1);
  });
  await check('an aged synthetic draft retains its original expired identity on create retry without deleting lifecycle evidence', async () => {
    const f = fresh(), draftId = randomUUID(), hash = createHash('sha256').update(JSON.stringify(f.config)).digest('hex');
    // Owned fixture administrator models an old record; the runtime create API
    // itself does not accept timestamps or caller-selected draft identifiers.
    await admin.query(`WITH observed AS MATERIALIZED (SELECT date_trunc('milliseconds',clock_timestamp())-interval '169 hours' AS clock)
      INSERT INTO steer_drafts.draft_lifecycles
      (organization_id,subject,product_id,draft_id,request_id,configuration_digest,created_at,retention_deadline,use_until)
      SELECT $1,$2,$3,$4,$5,$6,clock,clock+interval '168 hours',clock+interval '168 hours' FROM observed`,
      [f.config.organizationId, f.config.subject, f.config.productId, draftId, f.request.requestId, hash]);
    const value = ok(await f.make().inspect({ draftId })); assert.equal(value.expired, true);
    assert.deepEqual(await f.create(), value); assert.equal((await f.create()).draftId, draftId);
    assert.equal((await admin.query('SELECT count(*)::int AS n FROM steer_drafts.draft_lifecycles WHERE draft_id=$1', [draftId])).rows[0].n, 1);
  });
  await check('qualified hold needs its distinct verifier and remains sticky across discard and recreation', async () => {
    const f = fresh(), original = await f.create(), request = { draftId: original.draftId, holdReference: randomUUID() }; let verified = 0;
    assert.equal((await f.make().hold(request)).outcome, 'unavailable');
    assert.equal((await f.make({ verifyHold: async () => { throw new Error('private-denial'); } }).hold(request)).outcome, 'unavailable');
    const store = f.make({ verifyHold: async ctx => { assert.deepEqual(ctx.request, request); assert.deepEqual(ctx.configuration, f.config); verified++; } });
    const held = ok(await store.hold(request)); assert.equal(held.held, true); assert.equal(held.holdReference, request.holdReference);
    assert.deepEqual(ok(await store.hold(request)), held); assert.equal(verified, 2);
    assert.equal((await f.make({ verifyHold: async () => {} }).hold({ ...request, holdReference: randomUUID() })).outcome, 'conflict');
    assert.equal(ok(await f.make().discard({ draftId: held.draftId })).held, true);
    assert.equal(ok(await f.make().create(f.request)).held, true);
  });
  await check('publication references require independently verified exact time/effect and preserve the earliest deadline', async () => {
    const f = fresh(), original = await f.create(), request = { draftId: original.draftId, operationId: randomUUID(), inputDigest: 'a'.repeat(64) };
    const proof = { ...request, publishedAt: new Date().toISOString() };
    assert.equal((await f.make().recordPublication(request)).outcome, 'unavailable');
    for (const patch of [{ draftId: randomUUID() }, { inputDigest: 'f'.repeat(64) }, { publishedAt: new Date(Date.now() + 60000).toISOString() },
      { publishedAt: new Date(Date.parse(original.createdAt) - 1).toISOString() }])
      assert.notEqual((await f.make({ verifyPublication: async () => ({ ...proof, ...patch }) }).recordPublication(request)).outcome, 'ok');
    const store = f.make({ verifyPublication: async () => proof }), published = ok(await store.recordPublication(request));
    assert.equal(Date.parse(published.useUntil) - Date.parse(proof.publishedAt), 60000);
    assert.equal(published.publicationOperation, request.operationId); assert.deepEqual(ok(await store.recordPublication(request)), published);
    assert.equal(ok(await f.make().discard({ draftId: original.draftId })).useUntil, published.useUntil);
    assert.equal((await f.make({ verifyPublication: async () => ({ ...proof, operationId: randomUUID() }) }).recordPublication(request)).outcome, 'conflict');
  });
  await check('lost create and discard acknowledgements preserve original metadata and never mint a second draft or reset expiry', async () => {
    const f = fresh();
    const uncertain: DatabasePool = { async connect() { const c = await f.pool.connect(); return { query: async (sql: string, values?: unknown[]) => {
      const result = await c.query(sql, values); if (sql === 'COMMIT') throw new Error('private-lost-ack'); return result;
    }, release: (broken: boolean) => c.release(broken) } as PoolClient; } };
    assert.equal((await f.make({}, uncertain).create(f.request)).outcome, 'unknown'); const original = await f.create();
    assert.equal((await f.make({}, uncertain).discard({ draftId: original.draftId })).outcome, 'unknown');
    const discarded = ok(await f.make().inspect({ draftId: original.draftId })); assert.ok(discarded.discardedAt);
    assert.deepEqual(await f.create(), discarded);
    assert.equal((await admin.query('SELECT count(*)::int AS n FROM steer_drafts.draft_lifecycles WHERE organization_id=$1', [f.config.organizationId])).rows[0].n, 1);
  });
  await check('late authority revocation withholds restriction acknowledgement without undoing the durable hold', async () => {
    const f = fresh(), original = await f.create(); let auth = 0;
    const store = f.make({ authorize: async () => { if (++auth === 3) throw new Error('private-revocation'); }, verifyHold: async () => {} });
    assert.equal((await store.hold({ draftId: original.draftId, holdReference: randomUUID() })).outcome, 'unknown');
    assert.equal(ok(await f.make().inspect({ draftId: original.draftId })).held, true);
  });
  await check('lifecycle SQL permissions and monotone guard prohibit deletion, clock replacement, deadline extension and hold release', async () => {
    const f = fresh(), value = await f.create(); await f.make({ verifyHold: async () => {} }).hold({ draftId: value.draftId, holdReference: randomUUID() });
    const c = await f.pool.connect();
    try {
      await c.query("SELECT set_config('steer.draft_organization',$1,false),set_config('steer.draft_subject',$2,false),set_config('steer.draft_product',$3,false)",
        [f.config.organizationId, f.config.subject, f.config.productId]);
      for (const sql of ['DELETE FROM steer_drafts.draft_lifecycles', 'TRUNCATE steer_drafts.draft_lifecycles',
        "UPDATE steer_drafts.draft_lifecycles SET created_at=clock_timestamp()", "UPDATE steer_drafts.draft_lifecycles SET configuration_digest=repeat('f',64)"])
        await assert.rejects(c.query(sql), /permission denied/);
      await assert.rejects(c.query('UPDATE steer_drafts.draft_lifecycles SET held=false,hold_reference=null'), /Immutable draft lifecycle changed/);
      await assert.rejects(c.query("UPDATE steer_drafts.draft_lifecycles SET use_until=use_until+interval '1 second'"), /Immutable draft lifecycle changed/);
    } finally { c.release(true); }
  });
  await check('timed-out lifecycle authority retains admission until drain and close suppresses late creation', async () => {
    const f = fresh(); let release!: () => void, calls = 0;
    const store = f.make({ authorize: async () => { calls++; await new Promise<void>(r => { release = r; }); } });
    assert.equal((await store.create(f.request)).outcome, 'unavailable');
    assert.equal((await store.create(f.request)).outcome, 'unavailable'); assert.equal(calls, 1); release();
    await new Promise(r => setImmediate(r)); store.close(); assert.equal((await store.create(f.request)).outcome, 'unavailable');
    const other = f.make({ authorize: async () => { other.close(); } }); assert.equal((await other.create(f.request)).outcome, 'unavailable');
    assert.equal((await admin.query('SELECT count(*)::int AS n FROM steer_drafts.draft_lifecycles WHERE organization_id=$1', [f.config.organizationId])).rows[0].n, 0);
  });
}
