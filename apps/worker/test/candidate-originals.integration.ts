import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { DatabasePool } from '@steer/data/runtime-pool';
import { createCandidateOriginalStore } from '@steer/data/candidate-originals';
import { planCandidateBundle } from '@steer/tool-registry/candidate-bundle-contracts';
import type { CandidateBundleSaveRequest } from '@steer/adapters/github-candidate-bundle-store';
import type { createDurableCandidateBundleStore } from '../src/candidate-bundle-runtime.ts';
import { createRecordedCandidateSaveStatusReader } from '../../api/src/runtime.ts';
import { createApi } from '../../api/src/app.ts';
import { binding, now as providerNow } from '../../../packages/adapters/test/github-brief-fixture.ts';

type Fixture = { prepare(): Promise<CandidateBundleSaveRequest>; make(): ReturnType<typeof createDurableCandidateBundleStore>;
  execution: { organizationId: string; subject: string; productId: string; repository: string; branch: string; configurationRevision: string; recordsPolicyDigest: string };
  publication: unknown;
  git: { mutations(): number; calls: unknown[]; transport: typeof fetch; loseAck(): void } };
type Dependencies = Parameters<typeof createCandidateOriginalStore>[2];

/** Only synthetic keys, synthetic lifecycle/authority ports and the owned test DB. */
export async function testCandidateOriginals(setup: () => Promise<Fixture>, admin: Pool, connect: (role: string) => Pool,
  check: (name: string, run: () => Promise<void>) => Promise<void>) {
  const fresh = async () => {
    const f = await setup(), request = await f.prepare(), plan = await planCandidateBundle(request.bundle, request.confirmation);
    const target = { organizationId: request.bundle.organizationId, operationId: request.bundle.operationId, inputDigest: plan.inputDigest };
    const { organizationId, subject, productId, repository, branch, configurationRevision, recordsPolicyDigest } = f.execution;
    const config = { organizationId, subject, productId, repository, branch, configurationRevision, recordsPolicyDigest };
    const key = { keyId: `synthetic-${randomUUID()}`, bytes: randomBytes(32) };
    const createdAt = new Date(Date.now() - 60000).toISOString();
    const state = { lifecycle: { createdAt, useUntil: new Date(Date.parse(createdAt) + 7 * 86400000).toISOString(), held: false }, denied: false, keyDenied: false, keyReads: 0 };
    const dependencies: Dependencies = { authorize: async () => { if (state.denied) throw new Error('private-denial-marker'); },
      verifyOriginal: async original => f.make().verifyOriginal(original), lifecycle: async () => ({ ...state.lifecycle }),
      keyForDraft: async (ref, keyId) => { state.keyReads++; assert.equal(ref.draftId, request.confirmation.draftId);
        if (state.keyDenied || (keyId && keyId !== key.keyId)) throw new Error('private-key-marker'); return key; } };
    const pool = connect('steer_draft_runtime');
    const make = (overrides: Partial<Dependencies> = {}, otherPool: DatabasePool = pool, patch = {}) => createCandidateOriginalStore(otherPool, { ...config, ...patch }, { ...dependencies, ...overrides });
    const row = async () => (await admin.query('SELECT * FROM steer_drafts.candidate_originals WHERE organization_id=$1 AND operation_id=$2', [config.organizationId, target.operationId])).rows[0];
    return { f, request, target, config, key, state, pool, make, row, dependencies };
  };
  await check('preservation returns its exact verified readback with one recovery and unchanged legacy acknowledgement', async () => {
    for (const joined of [false, true]) {
      const t = await fresh(); let synchronizations = 0, inserts = 0;
      const spy: DatabasePool = { async connect() { const c = await t.pool.connect(); return {
        query: async (sql: string, values?: unknown[]) => {
          if (sql.startsWith('UPDATE steer_drafts.candidate_originals SET use_until')) synchronizations++;
          if (sql.startsWith('INSERT INTO steer_drafts.candidate_originals')) inserts++;
          return c.query(sql, values);
        }, release: (broken: boolean) => c.release(broken),
      } as PoolClient; } };
      const store = t.make({}, spy);
      try {
        const run = async () => {
          if (joined) {
            const result = await store.putAndRead(t.request); assert.equal(result.outcome, 'stored');
            if (result.outcome !== 'stored') throw new Error('Expected verified readback');
            assert.equal(Object.isFrozen(result), true); assert.equal(Object.isFrozen(result.original.bundle.documents), true);
            return result.original;
          }
          assert.deepEqual(await store.put(t.request), { outcome: 'stored' });
          return store.read(t.target);
        };
        assert.deepEqual(await run(), t.request); const row = await t.row();
        assert.equal(t.state.keyReads, joined ? 3 : 5); assert.equal(synchronizations, joined ? 2 : 4); assert.equal(inserts, 1);
        const keys = t.state.keyReads; synchronizations = 0;
        assert.deepEqual(await run(), t.request);
        assert.equal(t.state.keyReads - keys, joined ? 2 : 4); assert.equal(synchronizations, joined ? 2 : 4);
        assert.equal(inserts, 1); assert.deepEqual(await t.row(), row);
        assert.equal(t.f.git.calls.length, 0); assert.equal(t.f.git.mutations(), 0);
      } finally { store.close(); }
    }
  });
  await check('joined preservation never returns an original after late authority, key, lifecycle or owner loss', async () => {
    for (const mode of ['authority', 'key-denial', 'key-rotation', 'hold', 'expiry', 'closed'] as const) {
      const t = await fresh(), lifecycle = { ...t.state.lifecycle }; let checks = 0;
      const bytes = Buffer.from(t.key.bytes); let store: ReturnType<typeof createCandidateOriginalStore>;
      store = t.make({ verifyOriginal: async request => {
        await t.dependencies.verifyOriginal(request);
        if (++checks !== 3) return; // first recovery, after the insert committed
        if (mode === 'authority') t.state.denied = true;
        if (mode === 'key-denial') t.state.keyDenied = true;
        if (mode === 'key-rotation') t.key.bytes.fill(0);
        if (mode === 'hold') t.state.lifecycle.held = true;
        if (mode === 'expiry') t.state.lifecycle.useUntil = new Date(Date.now() - 1).toISOString();
        if (mode === 'closed') store.close();
      } });
      try {
        const result = await store.putAndRead(t.request);
        assert.notEqual(result.outcome, 'stored'); assert.equal('original' in result, false);
        const row = await t.row(); assert.ok(row); assert.equal(t.f.git.calls.length, 0);
        if (mode === 'hold' || mode === 'expiry') {
          assert.equal(row.held, mode === 'hold');
          if (mode === 'expiry') assert.equal(row.use_until.toISOString(), t.state.lifecycle.useUntil);
          t.state.lifecycle = lifecycle; const other = t.make();
          try { assert.notEqual((await other.putAndRead(t.request)).outcome, 'stored'); }
          finally { other.close(); }
        }
      } finally { store.close(); bytes.copy(t.key.bytes); bytes.fill(0); }
    }
  });
  await check('joined preservation keeps a lost insert acknowledgement unknown and reconstructs one immutable original', async () => {
    const t = await fresh(); let lose = true, inserts = 0;
    const uncertain: DatabasePool = { async connect() { const c = await t.pool.connect(); let inserted = false; return {
      query: async (sql: string, values?: unknown[]) => {
        const value = await c.query(sql, values);
        if (sql.startsWith('INSERT INTO steer_drafts.candidate_originals')) { inserted = true; inserts++; }
        if (inserted && sql === 'COMMIT' && lose) { lose = false; throw new Error('PRIVATE lost insert acknowledgement'); }
        return value;
      }, release: (broken: boolean) => c.release(broken),
    } as PoolClient; } };
    const first = t.make({}, uncertain);
    try { assert.deepEqual(await first.putAndRead(t.request), { outcome: 'unknown' }); } finally { first.close(); }
    const row = await t.row(); assert.ok(row);
    const recovered = t.make({}, uncertain);
    try {
      assert.deepEqual(await recovered.putAndRead(t.request), { outcome: 'stored', original: t.request });
      assert.deepEqual(await t.row(), row); assert.equal(inserts, 1); assert.equal(t.f.git.calls.length, 0);
    } finally { recovered.close(); }
  });
  await check('concurrent joined preservation returns the same admitted original without additional inserts or retention renewal', async () => {
    const t = await fresh();
    const stores = Array.from({ length: 4 }, () => t.make({}, connect('steer_draft_runtime')));
    try {
      const results = await Promise.all(stores.map(store => store.putAndRead(t.request)));
      for (const result of results) assert.deepEqual(result, { outcome: 'stored', original: t.request });
      assert.equal((await admin.query('SELECT count(*)::int AS n FROM steer_drafts.candidate_originals WHERE operation_id=$1', [t.target.operationId])).rows[0].n, 1);
      assert.equal((await t.row()).retention_deadline.toISOString(), new Date(Date.parse(t.state.lifecycle.createdAt) + 7 * 86400000).toISOString());
      assert.equal(t.f.git.calls.length, 0);
    } finally { stores.forEach(store => store.close()); }
  });
  await check('joined preservation retains admission for a timed-out key and never exposes a late readback after close', async () => {
    const t = await fresh(), initial = t.make();
    try { assert.equal((await initial.put(t.request)).outcome, 'stored'); } finally { initial.close(); }
    let entered!: () => void, release!: () => void, keyCalls = 0;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    const store = t.make({ keyForDraft: async () => { keyCalls++; entered(); await held; return t.key; } });
    try {
      const loading = store.putAndRead(t.request); await started;
      const result = await loading; assert.notEqual(result.outcome, 'stored'); assert.equal('original' in result, false);
      assert.deepEqual(await store.putAndRead(t.request), { outcome: 'unavailable' }); assert.equal(keyCalls, 1);
      store.close(); release(); await new Promise(resolve => setImmediate(resolve));
      assert.deepEqual(await store.putAndRead(t.request), { outcome: 'unavailable' }); assert.equal(keyCalls, 1);
      assert.equal(t.f.git.calls.length, 0);
    } finally { store.close(); release(); }
  });
  await check('encrypted candidate originals survive adapter/pool reconstruction with exact three-document and consent bytes', async () => {
    const t = await fresh(), queries: string[] = []; let transactions = 0;
    const spy: DatabasePool = { async connect() { const c = await t.pool.connect(); return { query: async (sql: string, values?: unknown[]) => {
      queries.push(JSON.stringify([sql, values])); const result = await c.query(sql, values);
      if (sql.startsWith('BEGIN')) transactions++; if (sql === 'COMMIT' || sql === 'ROLLBACK') transactions--; return result;
    }, release: (broken: boolean) => c.release(broken) } as PoolClient; } };
    const store = t.make({
      authorize: async ctx => { assert.equal(transactions, 0); return t.dependencies.authorize(ctx); },
      verifyOriginal: async request => { assert.equal(transactions, 0); return t.dependencies.verifyOriginal(request); },
      lifecycle: async ref => { assert.equal(transactions, 0); return t.dependencies.lifecycle(ref); },
      keyForDraft: async (ref, keyId) => { assert.equal(transactions, 0); return t.dependencies.keyForDraft(ref, keyId); },
    }, spy); assert.equal((await store.put(t.request)).outcome, 'stored'); store.close();
    assert.deepEqual(await t.make({}, connect('steer_draft_runtime')).read(t.target), t.request);
    const row = await t.row(); assert.equal(row.draft_created_at.toISOString(), t.state.lifecycle.createdAt);
    for (const text of [JSON.stringify(row), ...queries]) for (const forbidden of ['Synthetic Brief', 'Candidate Exam', t.key.bytes.toString('base64url')])
      assert.equal(text.includes(forbidden), false);
    assert.equal(t.f.git.calls.length, 0); assert.equal(t.f.git.mutations(), 0);
  });
  await check('HTTP status recovers a lost native Git acknowledgement from encrypted SQL originals without redispatch or checkpoint mutation', async () => {
    const t = await fresh(), originalStore = t.make();
    assert.equal((await originalStore.put(t.request)).outcome, 'stored'); originalStore.close();
    t.f.git.loseAck(); assert.equal((await t.f.make().compareAndWrite(t.request)).outcome, 'unknown');
    assert.equal(t.f.git.mutations(), 1);
    const before = (await admin.query('SELECT record,result_ref FROM steer_execution.intent_steps WHERE operation_id=$1', [t.target.operationId])).rows;
    assert.equal(before[0].record.state, 'dispatch-committed');
    const input = { organizationId: t.config.organizationId, productId: t.config.productId, repository: t.config.repository, branch: t.config.branch,
      draftId: t.request.confirmation.draftId, draftRevision: t.request.confirmation.draftRevision, operationId: t.target.operationId, inputDigest: t.target.inputDigest };
    const principal = { subject: t.config.subject, organizationId: t.config.organizationId, type: 'human', hats: [],
      toolGrants: ['intent.candidate.save.status'], expiresAt: new Date(Date.now() + 300000).toISOString() };
    const request = (value = input) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
    for (let attempt = 0; attempt < 2; attempt++) {
      const service = createRecordedCandidateSaveStatusReader(connect('steer_draft_runtime'), binding, t.config, t.f.publication, {
        records: t.dependencies, provider: { fetch: t.f.git.transport, appJwt: async () => 'synthetic-app-jwt', now: () => providerNow, authorizeRead: async () => {} },
      });
      const api = createApi({ authenticate: async () => principal, services: { candidateSaveStatusReader: service } });
      try {
        const response = await api.request('/v1/tools/intent.candidate.save.status', request()); assert.equal(response.status, 200);
        const result = await response.json(); assert.equal(result.outcome, 'committed'); assert.equal(result.saveVerified, true);
        assert.equal(result.retryAuthorized, false); assert.equal(result.reference.bundleId, t.request.bundle.bundleId);
        assert.equal(result.inputDigest, t.target.inputDigest); assert.doesNotMatch(JSON.stringify(result), /Synthetic Brief|Candidate Exam/);
        const calls = t.f.git.calls.length;
        assert.equal((await api.request('/v1/tools/intent.candidate.save.status', request({ ...input, draftRevision: 2 }))).status, 503);
        assert.equal(t.f.git.calls.length, calls);
        if (attempt === 1) {
          t.state.lifecycle.held = true;
          assert.equal((await api.request('/v1/tools/intent.candidate.save.status', request())).status, 503);
          assert.equal(t.f.git.calls.length, calls);
        }
      } finally { service.close(); }
    }
    assert.equal(t.f.git.mutations(), 1);
    assert.deepEqual((await admin.query('SELECT record,result_ref FROM steer_execution.intent_steps WHERE operation_id=$1', [t.target.operationId])).rows, before);
    assert.equal((await admin.query('SELECT count(*)::int AS n FROM steer_drafts.candidate_originals WHERE operation_id=$1', [t.target.operationId])).rows[0].n, 1);
  });
  await check('concurrent immutable inserts reuse one original and historical key instead of overwriting or extending retention', async () => {
    const t = await fresh();
    const results = await Promise.all(Array.from({ length: 4 }, () => t.make({}, connect('steer_draft_runtime')).put(t.request)));
    assert.ok(results.every(r => r.outcome === 'stored')); const original = await t.row();
    assert.equal((await t.make({ keyForDraft: async (_ref, keyId) => { assert.equal(keyId, t.key.keyId); return t.key; } }).put(t.request)).outcome, 'stored');
    assert.deepEqual(await t.row(), original);
    assert.equal((await admin.query('SELECT count(*)::int AS n FROM steer_drafts.candidate_originals WHERE operation_id=$1', [t.target.operationId])).rows[0].n, 1);
  });
  await check('wrong owner, organization, product, configuration, target and database role cannot reach plaintext or keys', async () => {
    const t = await fresh(); assert.equal((await t.make().put(t.request)).outcome, 'stored'); const reads = t.state.keyReads;
    for (const patch of [{ subject: 'foreign' }, { organizationId: 'foreign' }, { productId: 'foreign' }, { configurationRevision: 'foreign' }, { recordsPolicyDigest: 'f'.repeat(64) }])
      await assert.rejects(t.make({}, t.pool, patch).read(t.target), /Draft storage is unavailable/);
    for (const role of ['steer_app', 'steer_projector', 'steer_auth_runtime']) {
      const pool = connect(role); await assert.rejects(t.make({}, pool).read(t.target));
      await assert.rejects(pool.query('SELECT * FROM steer_drafts.candidate_originals'), /permission denied/);
    }
    await assert.rejects(t.make({}, admin).read(t.target));
    await assert.rejects(t.make().read({ ...t.target, inputDigest: 'f'.repeat(64) }));
    await assert.rejects(t.make().read({ ...t.target, operationId: randomUUID() }));
    assert.equal(t.state.keyReads, reads);
    const c = await t.pool.connect(); try {
      assert.equal((await c.query('SELECT count(*)::int AS n FROM steer_drafts.candidate_originals')).rows[0].n, 0);
      assert.equal((await c.query("SELECT nullif(current_setting('steer.draft_subject',true),'') AS owner")).rows[0].owner, null);
    } finally { c.release(); }
  });
  await check('unadmitted, changed-revision, stale-consent and owner-substituted payloads cannot be stored', async () => {
    const t = await fresh();
    for (const raw of [{ ...t.request, bundle: { ...t.request.bundle, operationId: randomUUID() } },
      { ...t.request, confirmation: { ...t.request.confirmation, draftRevision: 2 } },
      { ...t.request, bundle: { ...t.request.bundle, documents: { ...t.request.bundle.documents, brief: '# Changed' } } },
      { ...t.request, bundle: { ...t.request.bundle, originatorSubject: 'foreign' } }])
      assert.notEqual((await t.make().put(raw)).outcome, 'stored');
    assert.equal(await t.row(), undefined); assert.equal(t.state.keyReads, 0); assert.equal(t.f.git.calls.length, 0);
  });
  await check('observed holds and earlier publication/discard clocks latch durably and cannot be revived by stale lifecycle values', async () => {
    for (const held of [true, false]) {
      const t = await fresh(); assert.equal((await t.make().put(t.request)).outcome, 'stored'); const original = { ...t.state.lifecycle };
      t.state.lifecycle = held ? { ...original, held: true } : { ...original, useUntil: new Date(Date.now() - 1).toISOString() };
      await assert.rejects(t.make().read(t.target)); const denied = await t.row();
      assert.equal(denied.held, held); assert.equal(denied.use_until.toISOString(), t.state.lifecycle.useUntil);
      t.state.lifecycle = original;
      await assert.rejects(t.make().read(t.target)); assert.notEqual((await t.make().put(t.request)).outcome, 'stored');
      assert.equal((await t.row()).draft_created_at.toISOString(), original.createdAt);
    }
  });
  await check('expired, future-created, renewed or held drafts cannot gain an original-payload acknowledgement', async () => {
    for (const change of ['expired', 'future', 'renewed', 'held']) {
      const t = await fresh();
      if (change === 'expired') t.state.lifecycle.useUntil = new Date(Date.now() - 1).toISOString();
      if (change === 'future') t.state.lifecycle.createdAt = new Date(Date.now() + 60000).toISOString();
      if (change === 'renewed') t.state.lifecycle.useUntil = new Date(Date.parse(t.state.lifecycle.createdAt) + 8 * 86400000).toISOString();
      if (change === 'held') t.state.lifecycle.held = true;
      assert.notEqual((await t.make().put(t.request)).outcome, 'stored'); assert.equal(await t.row(), undefined);
    }
    const t = await fresh(); assert.equal((await t.make().put(t.request)).outcome, 'stored');
    t.state.lifecycle.createdAt = new Date(Date.parse(t.state.lifecycle.createdAt) + 1).toISOString();
    await assert.rejects(t.make().read(t.target)); assert.equal((await t.make().put(t.request)).outcome, 'conflict');
  });
  await check('another revision cannot reset an observed draft hold or replace its server-created clock', async () => {
    const t = await fresh(); assert.equal((await t.make().put(t.request)).outcome, 'stored');
    const { operationId: _id, ...bundle } = t.request.bundle;
    const next = await t.f.make().prepare({ bundle, confirmation: { ...t.request.confirmation, draftRevision: 2 } });
    assert.equal(next.outcome, 'prepared'); if (next.outcome !== 'prepared') return;
    t.state.lifecycle.held = true; await assert.rejects(t.make().read(t.target)); t.state.lifecycle.held = false;
    assert.notEqual((await t.make().put(next.request)).outcome, 'stored');
    assert.equal((await admin.query('SELECT count(*)::int AS n FROM steer_drafts.candidate_originals WHERE draft_id=$1', [t.request.confirmation.draftId])).rows[0].n, 1);
  });
  await check('current authorization and key revocation after decryption withhold the original and never reach Git', async () => {
    const t = await fresh(); assert.equal((await t.make().put(t.request)).outcome, 'stored');
    await assert.rejects(t.make({ verifyOriginal: async request => { await t.f.make().verifyOriginal(request); t.state.denied = true; } }).read(t.target));
    t.state.denied = false;
    await assert.rejects(t.make({ verifyOriginal: async request => { await t.f.make().verifyOriginal(request); t.state.keyDenied = true; } }).read(t.target));
    t.state.keyDenied = false;
    const before = Buffer.from(t.key.bytes);
    try { await assert.rejects(t.make({ verifyOriginal: async request => {
      await t.f.make().verifyOriginal(request); t.key.bytes.fill(0);
    } }).read(t.target)); }
    finally { before.copy(t.key.bytes); before.fill(0); }
    await assert.rejects(t.make({ keyForDraft: async () => ({ ...t.key, bytes: randomBytes(32) }) }).read(t.target));
    assert.equal(t.f.git.calls.length, 0);
  });
  await check('ciphertext transplanted to another admitted operation is unusable even with the original synthetic key', async () => {
    const a = await fresh(), b = await fresh(); assert.equal((await a.make().put(a.request)).outcome, 'stored');
    // Owned administrator simulates a corrupted/restored DB, never a runtime privilege.
    const ca = await a.row();
    await admin.query(`INSERT INTO steer_drafts.candidate_originals
      (organization_id,subject,product_id,operation_id,draft_id,draft_revision,input_digest,payload_digest,configuration_digest,encrypted_value,draft_created_at,retention_deadline,use_until,held)
      SELECT organization_id,subject,product_id,$2,$3,draft_revision,$4,payload_digest,configuration_digest,encrypted_value,draft_created_at,retention_deadline,use_until,false
      FROM steer_drafts.candidate_originals WHERE operation_id=$1`, [a.target.operationId, b.target.operationId, b.request.confirmation.draftId, b.target.inputDigest]);
    b.state.lifecycle.createdAt = ca.draft_created_at.toISOString(); b.state.lifecycle.useUntil = ca.use_until.toISOString();
    await assert.rejects(b.make({ keyForDraft: async () => a.key }).read(b.target));
  });
  await check('lost insert COMMIT acknowledgement stays unknown while reconstruction recovers the same immutable row', async () => {
    const t = await fresh(); let lose = true;
    const uncertain: DatabasePool = { async connect() { const c = await t.pool.connect(); let inserted = false;
      return { query: async (sql: string, values?: unknown[]) => { const result = await c.query(sql, values);
        if (sql.startsWith('INSERT INTO steer_drafts')) inserted = true;
        if (sql === 'COMMIT' && inserted && lose) { lose = false; throw new Error('private-lost-ack-marker'); } return result;
      }, release: (broken: boolean) => c.release(broken) } as PoolClient;
    } };
    assert.equal((await t.make({}, uncertain).put(t.request)).outcome, 'unknown'); const original = await t.row(); assert.ok(original);
    assert.deepEqual(await t.make().read(t.target), t.request); assert.equal((await t.make().put(t.request)).outcome, 'stored');
    assert.deepEqual(await t.row(), original);
  });
  await check('draft SQL role has no deletion, content rewrite, expiry extension, hold release or projection privilege', async () => {
    const t = await fresh(); assert.equal((await t.make().put(t.request)).outcome, 'stored'); const c = await t.pool.connect();
    try {
      const table = (await admin.query("SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid='steer_drafts.candidate_originals'::regclass")).rows[0];
      assert.equal(table.relrowsecurity, true); assert.equal(table.relforcerowsecurity, true);
      const policy = (await admin.query("SELECT qual, with_check FROM pg_policies WHERE schemaname='steer_drafts' AND tablename='candidate_originals'")).rows[0];
      assert.ok(policy.qual && policy.with_check);
      await c.query("SELECT set_config('steer.draft_organization',$1,false), set_config('steer.draft_subject',$2,false), set_config('steer.draft_product',$3,false)",
        [t.config.organizationId, t.config.subject, t.config.productId]);
      for (const sql of ['DELETE FROM steer_drafts.candidate_originals', 'TRUNCATE steer_drafts.candidate_originals',
        "UPDATE steer_drafts.candidate_originals SET encrypted_value='{}'::jsonb", 'SELECT * FROM steer_execution.intent_operations',
        'SELECT * FROM steer.projection_records']) await assert.rejects(c.query(sql), /permission denied/);
      await assert.rejects(c.query("UPDATE steer_drafts.candidate_originals SET use_until=use_until+interval '1 second' WHERE operation_id=$1", [t.target.operationId]), /Immutable draft changed/);
      await c.query('UPDATE steer_drafts.candidate_originals SET held=true WHERE operation_id=$1', [t.target.operationId]);
      await assert.rejects(c.query('UPDATE steer_drafts.candidate_originals SET held=false WHERE operation_id=$1', [t.target.operationId]), /Immutable draft changed/);
    } finally { c.release(true); }
  });
  await check('slow key resolution retains admission until drainage and closing during recovery withholds content', async () => {
    const t = await fresh(); assert.equal((await t.make().put(t.request)).outcome, 'stored');
    let release!: () => void, entered!: () => void; const started = new Promise<void>(r => { entered = r; });
    const store = t.make({ keyForDraft: async () => { entered(); await new Promise<void>(r => { release = r; }); return t.key; } });
    const loading = store.read(t.target); await started; await assert.rejects(loading);
    await assert.rejects(store.read(t.target)); release(); await new Promise(r => setImmediate(r));
    const other = t.make({ keyForDraft: async () => { other.close(); return t.key; } });
    await assert.rejects(other.read(t.target)); assert.notEqual((await other.put(t.request)).outcome, 'stored');
  });
}
