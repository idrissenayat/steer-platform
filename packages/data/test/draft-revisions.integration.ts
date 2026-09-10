import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { createDraftLifecycleStore } from '../src/draft-lifecycle.ts';
import { createDraftRevisionStore } from '../src/draft-revisions.ts';
import type { DatabasePool } from '../src/runtime-pool.ts';
import { withDraftReadSession } from '../src/draft-read-session.ts';
import { createIntentDraftService } from '../src/intent-draft-service.ts';
import { expireAgedDraftLifecycle } from './aged-draft-lifecycle.fixture.ts';
type Dependencies = Parameters<typeof createDraftRevisionStore>[2];
const ok = (r: Awaited<ReturnType<ReturnType<typeof createDraftRevisionStore>['append']>>) => {
  assert.equal(r.outcome, 'acknowledged'); if (r.outcome !== 'acknowledged') throw new Error('Synthetic snapshot unavailable'); return r;
};
export async function testDraftRevisions({ admin, connect, check }: {
  admin: Pool; connect(role: string): Pool; check(name: string, run: () => Promise<void>): Promise<void>;
}) {
  const fresh = async (aged = false) => {
    const config = { organizationId: `org-${randomUUID()}`, subject: 'synthetic-human', productId: 'product', repository: 'github:52',
      branch: 'codex/fixture', configurationRevision: 'draft-r1', recordsPolicyDigest: 'a'.repeat(64) };
    const pool = connect('steer_draft_runtime'), lifecycle = createDraftLifecycleStore(pool, config, { authorize: async () => {}, verifyHold: async () => {} });
    let draftId: string;
    if (aged) {
      // Owned administrator seeds an old metadata fixture, not a runtime option.
      draftId = randomUUID();
      await admin.query(`WITH observed AS MATERIALIZED (SELECT date_trunc('milliseconds',clock_timestamp())-interval '3 minutes' AS clock)
        INSERT INTO steer_drafts.draft_lifecycles
        (organization_id,subject,product_id,draft_id,request_id,configuration_digest,created_at,retention_deadline,use_until)
        SELECT $1,$2,$3,$4,$5,$6,clock,clock+interval '168 hours',clock+interval '168 hours' FROM observed`,
        [config.organizationId, config.subject, config.productId, draftId, randomUUID(), createHash('sha256').update(JSON.stringify(config)).digest('hex')]);
    } else {
      const created = await lifecycle.create({ requestId: randomUUID() }); assert.equal(created.outcome, 'ok');
      if (created.outcome !== 'ok') throw new Error('Synthetic lifecycle unavailable'); draftId = created.value.draftId;
    }
    const key = { keyId: `synthetic-${randomUUID()}`, bytes: randomBytes(32) };
    const content = { originalText: '  Synthetic original 🌸\r\n', clarificationTurns: [' Exact reply. '],
      documents: { brief: '# Synthetic Brief\n', spec: '# Synthetic Spec\n', exam: '# Synthetic Exam\nNOT RUN\n' } };
    const first = { draftId, mutationId: randomUUID(), expectedRevision: 0, expectedDigest: null, content };
    const state = { denied: false, keyReads: 0 };
    const dependencies: Dependencies = { authorize: async () => { if (state.denied) throw new Error('private-denial-marker'); },
      keyForDraft: async (ref, keyId) => { state.keyReads++; assert.equal(ref.draftId, draftId); assert.ok(keyId === null || keyId === key.keyId); return key; } };
    const make = (overrides: Partial<Dependencies> = {}, otherPool: DatabasePool = pool, patch = {}) => createDraftRevisionStore(otherPool, { ...config, ...patch }, { ...dependencies, ...overrides });
    const count = async () => Number((await admin.query('SELECT count(*) AS n FROM steer_drafts.draft_revisions WHERE draft_id=$1', [draftId])).rows[0].n);
    return { config, pool, lifecycle, draftId, key, content, first, state, dependencies, make, count };
  };
  await check('owned draft phase matches three ordinary full reads with two native key lookups and unchanged encrypted rows', async () => {
    const f = await fresh(), store = f.make(); ok(await store.append(f.first)); const target = { draftId: f.draftId, revision: 1 };
    const before = (await admin.query('SELECT * FROM steer_drafts.draft_revisions WHERE draft_id=$1', [f.draftId])).rows;
    f.state.keyReads = 0; const expected = await store.read(target); await store.read(target); await store.read(target); assert.equal(f.state.keyReads, 6);
    f.state.keyReads = 0; let escaped: (() => Promise<unknown>) | undefined;
    await withDraftReadSession({ scope: f.config, read: store.read }, target, async () => {}, async read => {
      escaped = read; for (let i = 0; i < 3; i++) assert.deepEqual(await read(), expected);
      assert.equal((await store.append(f.first)).outcome, 'unavailable'); await assert.rejects(store.read(target));
    });
    assert.equal(f.state.keyReads, 2); await assert.rejects(escaped!());
    assert.deepEqual((await admin.query('SELECT * FROM steer_drafts.draft_revisions WHERE draft_id=$1', [f.draftId])).rows, before);
    assert.deepEqual(await store.read(target), expected); store.close();
  });
  await check('owned draft phase withholds completion after late holds expiry edits grants keys ports or closure', async () => {
    for (const mode of ['hold', 'expiry', 'edit', 'grant', 'key', 'port', 'close']) {
      const f = await fresh(mode === 'expiry'), store = f.make(), saved = ok(await store.append(f.first)); let mutated = false;
      const target = { draftId: f.draftId, revision: 1 };
      await assert.rejects(withDraftReadSession({ scope: f.config, read: store.read }, target, async () => {}, async read => {
        await read();
        if (mode === 'hold') assert.equal((await f.lifecycle.hold({ draftId: f.draftId, holdReference: randomUUID() })).outcome, 'ok');
        if (mode === 'expiry') await expireAgedDraftLifecycle(admin, f.draftId);
        if (mode === 'edit') ok(await f.make().append({ ...f.first, mutationId: randomUUID(), expectedRevision: 1, expectedDigest: saved.reference.revisionDigest,
          content: { ...f.content, originalText: 'A newer exact source' } }));
        if (mode === 'grant') f.state.denied = true;
        if (mode === 'key') f.key.bytes.fill(0);
        if (mode === 'port') store.read = async () => { throw new Error('Changed port'); };
        if (mode === 'close') store.close(); mutated = true;
      }));
      assert.equal(mutated, true, 'Mutation must succeed before the store denies completion');
      assert.equal(await f.count(), mode === 'edit' ? 2 : 1); store.close();
    }
  });
  await check('owned draft final key boundary rechecks lifecycle latest revision grants key bytes and ports after dependent work', async () => {
    for (const mode of ['hold', 'expiry', 'edit', 'grant', 'key', 'port', 'close']) {
      const f = await fresh(mode === 'expiry'), saved = ok(await f.make().append(f.first)); let keys = 0, mutated = false;
      const store = f.make({ keyForDraft: async () => {
        if (++keys === 2) {
          if (mode === 'hold') assert.equal((await f.lifecycle.hold({ draftId: f.draftId, holdReference: randomUUID() })).outcome, 'ok');
          if (mode === 'expiry') await expireAgedDraftLifecycle(admin, f.draftId);
          if (mode === 'edit') ok(await f.make().append({ ...f.first, mutationId: randomUUID(), expectedRevision: 1, expectedDigest: saved.reference.revisionDigest,
            content: { ...f.content, originalText: 'New source at final key boundary' } }));
          if (mode === 'grant') f.state.denied = true;
          if (mode === 'key') { mutated = true; return { ...f.key, bytes: randomBytes(32) }; }
          if (mode === 'port') store.read = async () => { throw new Error('Replaced port'); };
          if (mode === 'close') store.close(); mutated = true;
        }
        return f.key;
      } });
      try { await assert.rejects(withDraftReadSession({ scope: f.config, read: store.read }, { draftId: f.draftId, revision: 1 }, async () => {}, async read => { await read(); await read(); }));
        assert.equal(mutated, true, 'Final-key mutation must succeed'); }
      finally { store.close(); }
    }
  });
  await check('owned draft phases deny invalid backwards or expired initial SQL clock observations without extending time', async () => {
    for (const mode of ['invalid', 'backwards', 'expired']) {
    const f = await fresh(); ok(await f.make().append(f.first)); let observations = 0;
    const observed: DatabasePool = { async connect() { const client = await f.pool.connect(); return {
      query: async (sql: string, values?: unknown[]) => {
        const result = await client.query(sql, values);
        if (sql.includes('FROM steer_drafts.draft_lifecycles') && ++observations === 1)
          return { ...result, rows: result.rows.map(row => ({ ...row, clock_ms: mode === 'invalid' ? 'not-a-clock' : row.use_until.getTime() - 1000 })) };
        return result;
      }, release: (broken: boolean) => client.release(broken),
    } as PoolClient; } };
    const store = f.make({}, observed);
    try { await assert.rejects(withDraftReadSession({ scope: f.config, read: store.read }, { draftId: f.draftId, revision: 1 }, async () => {}, async read => {
      await read();
      if (mode === 'expired') await new Promise(resolve => setTimeout(resolve, 1100));
    })); assert.equal(observations, mode === 'backwards' ? 2 : 1); } finally { store.close(); }
    }
  });
  await check('four private draft phases do not consume public read slots and the fifth phase is denied', async () => {
    const f = await fresh(); ok(await f.make().append(f.first));
    const service = createIntentDraftService(f.pool, f.config, { lifecycle: { authorize: async () => {} }, revisions: f.dependencies });
    const target = { organizationId: f.config.organizationId, productId: f.config.productId, repository: f.config.repository, draftId: f.draftId, revision: 1 as const };
    let release!: () => void, entered = 0; const held = new Promise<void>(r => { release = r; });
    const tasks = Array.from({ length: 4 }, () => withDraftReadSession(service, target, async () => {}, async read => {
      const first = await read(); entered++; await held;
      assert.deepEqual(await service.read(target, async () => {}), first); assert.deepEqual(await read(), first);
    }));
    const all = Promise.all(tasks); void all.catch(() => {});
    try {
      const deadline = performance.now() + 10000;
      while (entered < 4 && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
      assert.equal(entered, 4);
      await assert.rejects(withDraftReadSession(service, target, async () => {}, async read => { await read(); }));
      release(); await all; assert.equal(await f.count(), 1);
    } finally { release(); service.close(); await Promise.allSettled(tasks); }
  });
  await check('closing during owned draft final key lookup withholds completion and drains the actual key callback', async () => {
    const f = await fresh(); ok(await f.make().append(f.first)); let keys = 0, release!: () => void, entered!: () => void, settled = false;
    const held = new Promise<void>(r => { release = r; }), reached = new Promise<void>(r => { entered = r; });
    const store = f.make({ keyForDraft: async () => { if (++keys === 2) { entered(); await held; } return f.key; } });
    const result = assert.rejects(withDraftReadSession({ scope: f.config, read: store.read }, { draftId: f.draftId, revision: 1 }, async () => {}, async read => { await read(); }))
      .then(() => { settled = true; });
    try { await reached; store.close(); await new Promise(resolve => setImmediate(resolve)); assert.equal(settled, false);
      release(); await result; assert.equal(await f.count(), 1); await assert.rejects(store.read({ draftId: f.draftId, revision: 1 }));
    } finally { release(); store.close(); await result; }
  });
  await check('versioned draft content survives pool reconstruction with exact Unicode bytes and no plaintext/key SQL parameters', async () => {
    const f = await fresh(), queries: string[] = []; let transaction = false;
    const spy: DatabasePool = { async connect() { const c = await f.pool.connect(); return { query: async (sql: string, values?: unknown[]) => {
      const result = await c.query(sql, values); queries.push(JSON.stringify([sql, values]));
      if (sql.startsWith('BEGIN')) transaction = true; if (sql === 'COMMIT' || sql === 'ROLLBACK') transaction = false; return result;
    }, release: (broken: boolean) => c.release(broken) } as PoolClient; } };
    const writer = f.make({ authorize: async ctx => { assert.equal(transaction, false); return f.dependencies.authorize(ctx); },
      keyForDraft: async (ref, keyId) => { assert.equal(transaction, false); return f.dependencies.keyForDraft(ref, keyId); } }, spy);
    const saved = ok(await writer.append(f.first)); writer.close();
    const restored = await f.make({}, connect('steer_draft_runtime')).read({ draftId: f.draftId, revision: 1 });
    assert.deepEqual(restored.content, f.content); assert.deepEqual(restored.reference, saved.reference); assert.equal(restored.latestRevision, 1);
    const rows = (await admin.query('SELECT * FROM steer_drafts.draft_revisions WHERE draft_id=$1', [f.draftId])).rows;
    for (const text of [...queries, JSON.stringify(rows)]) for (const marker of ['Synthetic original', 'Synthetic Brief', 'Exact reply', f.key.bytes.toString('base64url')])
      assert.equal(text.includes(marker), false);
    assert.equal(await f.count(), 1);
  });
  await check('append preserves prior source/documents and derives source revisions and final-scope hashes without restoring approval', async () => {
    const f = await fresh(), store = f.make(), one = ok(await store.append(f.first));
    const examOnly = { ...f.content, documents: { ...f.content.documents, exam: '# Human exam edit\n' } };
    const two = ok(await store.append({ ...f.first, mutationId: randomUUID(), expectedRevision: 1, expectedDigest: one.reference.revisionDigest, content: examOnly }));
    assert.equal(two.reference.sourceRevision, 1); assert.equal(two.reference.scopeInputDigest, one.reference.scopeInputDigest);
    const specEdit = { ...examOnly, documents: { ...examOnly.documents, spec: '# Human Spec edit\n' } };
    const three = ok(await store.append({ ...f.first, mutationId: randomUUID(), expectedRevision: 2, expectedDigest: two.reference.revisionDigest, content: specEdit }));
    assert.equal(three.reference.sourceRevision, 1); assert.notEqual(three.reference.scopeInputDigest, two.reference.scopeInputDigest);
    const sourceEdit = { ...specEdit, clarificationTurns: [...specEdit.clarificationTurns, 'Another exact reply'] };
    const four = ok(await store.append({ ...f.first, mutationId: randomUUID(), expectedRevision: 3, expectedDigest: three.reference.revisionDigest, content: sourceEdit }));
    assert.equal(four.reference.sourceRevision, 2);
    assert.deepEqual((await store.read({ draftId: f.draftId, revision: 1 })).content, f.content);
    assert.deepEqual((await store.read({ draftId: f.draftId, revision: 2 })).content, examOnly);
    const latest = await store.read({ draftId: f.draftId, revision: 'latest' }); assert.deepEqual(latest.content, sourceEdit); assert.equal(latest.latestRevision, 4);
    assert.equal('gateSigned' in latest, false); assert.equal('saved' in latest, false);
  });
  await check('duplicate commands converge once, changed retries conflict and an old acknowledgement never replaces newer content', async () => {
    const f = await fresh();
    const results = await Promise.all(Array.from({ length: 4 }, () => f.make({}, connect('steer_draft_runtime')).append(f.first)));
    assert.ok(results.every(r => r.outcome === 'acknowledged')); const one = ok(results[0]!); assert.equal(await f.count(), 1);
    assert.equal((await f.make().append({ ...f.first, content: { ...f.content, originalText: 'Changed retry' } })).outcome, 'conflict');
    const newContent = { ...f.content, originalText: 'New source' };
    ok(await f.make().append({ ...f.first, mutationId: randomUUID(), expectedRevision: 1, expectedDigest: one.reference.revisionDigest, content: newContent }));
    const retry = ok(await f.make().append(f.first)); assert.equal(retry.reference.revision, 1); assert.equal(retry.latestRevision, 2);
    assert.deepEqual((await f.make().read({ draftId: f.draftId, revision: 'latest' })).content, newContent); assert.equal(await f.count(), 2);
  });
  await check('concurrent edits compare-and-swap one parent and preserve the losing caller content without a silent merge', async () => {
    const f = await fresh(), one = ok(await f.make().append(f.first));
    const commands = ['left', 'right'].map(text => ({ ...f.first, mutationId: randomUUID(), expectedRevision: 1,
      expectedDigest: one.reference.revisionDigest, content: { ...f.content, originalText: text } }));
    const results = await Promise.all(commands.map(command => f.make({}, connect('steer_draft_runtime')).append(command)));
    assert.equal(results.filter(r => r.outcome === 'acknowledged').length, 1); assert.equal(results.filter(r => r.outcome === 'conflict').length, 1);
    const winner = results.findIndex(r => r.outcome === 'acknowledged');
    assert.deepEqual((await f.make().read({ draftId: f.draftId, revision: 'latest' })).content, commands[winner]!.content);
    assert.deepEqual((await f.make().read({ draftId: f.draftId, revision: 1 })).content, f.content); assert.equal(await f.count(), 2);
  });
  await check('wrong owner/product/configuration, unregistered drafts and privileged or foreign roles cannot reach revision keys', async () => {
    const f = await fresh(); ok(await f.make().append(f.first)); const reads = f.state.keyReads;
    for (const patch of [{ subject: 'foreign' }, { organizationId: 'foreign' }, { productId: 'foreign' }, { configurationRevision: 'changed' }])
      await assert.rejects(f.make({}, f.pool, patch).read({ draftId: f.draftId, revision: 1 }));
    for (const role of ['steer_app', 'steer_auth_runtime', 'steer_projector']) {
      const pool = connect(role); await assert.rejects(f.make({}, pool).read({ draftId: f.draftId, revision: 1 }));
      await assert.rejects(pool.query('SELECT * FROM steer_drafts.draft_revisions'), /permission denied/);
    }
    await assert.rejects(f.make({}, admin).read({ draftId: f.draftId, revision: 1 }));
    assert.equal((await f.make().append({ ...f.first, draftId: randomUUID() })).outcome, 'unavailable'); assert.equal(f.state.keyReads, reads);
    assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM steer_drafts.draft_revisions')).rows[0].n, 0);
  });
  await check('a current durable hold blocks every old revision and further appends without deleting history', async () => {
    const f = await fresh(), one = ok(await f.make().append(f.first));
    assert.equal((await f.lifecycle.hold({ draftId: f.draftId, holdReference: randomUUID() })).outcome, 'ok');
    const reads = f.state.keyReads;
    await assert.rejects(f.make().read({ draftId: f.draftId, revision: 1 }));
    assert.equal((await f.make().append({ ...f.first, mutationId: randomUUID(), expectedRevision: 1, expectedDigest: one.reference.revisionDigest })).outcome, 'unavailable');
    assert.equal(f.state.keyReads, reads); assert.equal(await f.count(), 1);
  });
  await check('verified publication expiry blocks old revision bytes and pending edits while retaining encrypted history', async () => {
    const f = await fresh(true), one = ok(await f.make().append(f.first));
    const request = { draftId: f.draftId, operationId: randomUUID(), inputDigest: 'b'.repeat(64) };
    const lifecycle = createDraftLifecycleStore(f.pool, f.config, { authorize: async () => {}, verifyPublication: async () => ({
      ...request, publishedAt: new Date(Date.now() - 61000).toISOString(),
    }) });
    assert.equal((await lifecycle.recordPublication(request)).outcome, 'ok'); const reads = f.state.keyReads;
    await assert.rejects(f.make().read({ draftId: f.draftId, revision: 1 }));
    assert.equal((await f.make().append({ ...f.first, mutationId: randomUUID(), expectedRevision: 1, expectedDigest: one.reference.revisionDigest })).outcome, 'unavailable');
    assert.equal(f.state.keyReads, reads); assert.equal(await f.count(), 1); lifecycle.close();
  });
  await check('late hold or authorization loss during key retrieval withholds plaintext and prevents pending append', async () => {
    const f = await fresh(), one = ok(await f.make().append(f.first)); let first = true;
    const holdDuringKey = f.make({ keyForDraft: async () => { if (first) { first = false; await f.lifecycle.hold({ draftId: f.draftId, holdReference: randomUUID() }); } return f.key; } });
    await assert.rejects(holdDuringKey.read({ draftId: f.draftId, revision: 1 })); assert.equal(await f.count(), 1);
    const g = await fresh(); ok(await g.make().append(g.first));
    await assert.rejects(g.make({ keyForDraft: async () => { g.state.denied = true; return g.key; } }).read({ draftId: g.draftId, revision: 1 }));
    const h = await fresh(); let called = false;
    const writer = h.make({ keyForDraft: async () => { called = true; await h.lifecycle.hold({ draftId: h.draftId, holdReference: randomUUID() }); return h.key; } });
    assert.notEqual((await writer.append(h.first)).outcome, 'acknowledged'); assert.equal(called, true); assert.equal(await h.count(), 0);
    assert.equal(one.reference.revision, 1);
  });
  await check('lost revision COMMIT acknowledgement recovers the same immutable command and never inserts a duplicate', async () => {
    const f = await fresh(); let lose = true;
    const uncertain: DatabasePool = { async connect() { const c = await f.pool.connect(); let inserted = false; return { query: async (sql: string, values?: unknown[]) => {
      const result = await c.query(sql, values); if (sql.startsWith('INSERT INTO steer_drafts.draft_revisions')) inserted = true;
      if (sql === 'COMMIT' && inserted && lose) { lose = false; throw new Error('private-lost-ack'); } return result;
    }, release: (broken: boolean) => c.release(broken) } as PoolClient; } };
    assert.equal((await f.make({}, uncertain).append(f.first)).outcome, 'unknown'); assert.equal(await f.count(), 1);
    const retry = ok(await f.make().append(f.first)); assert.equal(retry.reference.revision, 1); assert.equal(await f.count(), 1);
    assert.deepEqual((await f.make().read({ draftId: f.draftId, revision: 1 })).content, f.content);
  });
  await check('revision table forces RLS, forbids history rewriting and rejects noncontiguous or plaintext metadata inserts', async () => {
    const f = await fresh(), one = ok(await f.make().append(f.first)); const c = await f.pool.connect();
    try {
      const table = (await admin.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='steer_drafts.draft_revisions'::regclass")).rows[0];
      assert.deepEqual(table, { relrowsecurity: true, relforcerowsecurity: true });
      await c.query("SELECT set_config('steer.draft_organization',$1,false),set_config('steer.draft_subject',$2,false),set_config('steer.draft_product',$3,false)", [f.config.organizationId, f.config.subject, f.config.productId]);
      for (const sql of ['DELETE FROM steer_drafts.draft_revisions', 'TRUNCATE steer_drafts.draft_revisions',
        "UPDATE steer_drafts.draft_revisions SET encrypted_value='{}'::jsonb", "UPDATE steer_drafts.draft_revisions SET revision=2"])
        await assert.rejects(c.query(sql), /permission denied/);
      const sql = `INSERT INTO steer_drafts.draft_revisions (organization_id,subject,product_id,draft_id,revision,mutation_id,command_digest,revision_digest,record,encrypted_value)
        SELECT organization_id,subject,product_id,draft_id,3,$2,command_digest,revision_digest,record,encrypted_value FROM steer_drafts.draft_revisions WHERE draft_id=$1`;
      await assert.rejects(c.query(sql, [f.draftId, randomUUID()]), /Invalid draft revision|Draft parent changed/);
      const { revisionDigest: _digest, ...prior } = one.reference;
      const metadata = { ...prior, revision: 2, mutationId: randomUUID(), parentRevision: 1,
        parentDigest: one.reference.revisionDigest, untrustedSource: 'synthetic-plaintext-marker' };
      await assert.rejects(c.query(`INSERT INTO steer_drafts.draft_revisions
        (organization_id,subject,product_id,draft_id,revision,mutation_id,command_digest,revision_digest,record,encrypted_value)
        SELECT organization_id,subject,product_id,draft_id,2,$2,command_digest,revision_digest,$3::jsonb,encrypted_value
        FROM steer_drafts.draft_revisions WHERE draft_id=$1`, [f.draftId, metadata.mutationId, JSON.stringify(metadata)]), /Invalid draft revision/);
      assert.equal(await f.count(), 1);
    } finally { c.release(true); }
  });
  await check('ciphertext transplanted to a different valid revision cannot be restored or used as the next edit parent', async () => {
    const f = await fresh(), one = ok(await f.make().append(f.first)), { revisionDigest: _digest, ...prior } = one.reference;
    const metadata = { ...prior, revision: 2, mutationId: randomUUID(), parentRevision: 1, parentDigest: one.reference.revisionDigest, commandDigest: 'c'.repeat(64) };
    const hash = createHash('sha256').update(JSON.stringify(['steer-draft-revision/v1', metadata])).digest('hex');
    const source = (await admin.query('SELECT encrypted_value FROM steer_drafts.draft_revisions WHERE draft_id=$1 AND revision=1', [f.draftId])).rows[0];
    // Owned fixture administrator models corrupted stored ciphertext under valid metadata.
    await admin.query(`INSERT INTO steer_drafts.draft_revisions
      (organization_id,subject,product_id,draft_id,revision,mutation_id,command_digest,revision_digest,record,encrypted_value)
      VALUES ($1,$2,$3,$4,2,$5,$6,$7,$8::jsonb,$9::jsonb)`, [f.config.organizationId, f.config.subject, f.config.productId,
      f.draftId, metadata.mutationId, metadata.commandDigest, hash, JSON.stringify(metadata), JSON.stringify(source.encrypted_value)]);
    await assert.rejects(f.make().read({ draftId: f.draftId, revision: 2 }));
    assert.deepEqual((await f.make().read({ draftId: f.draftId, revision: 1 })).content, f.content);
    assert.notEqual((await f.make().append({ ...f.first, mutationId: randomUUID(), expectedRevision: 2, expectedDigest: hash })).outcome, 'acknowledged');
    assert.equal(await f.count(), 2);
  });
  await check('wrong or changed historical keys, timeout and close cannot produce restored content or free stalled admission', async () => {
    const f = await fresh(); ok(await f.make().append(f.first));
    await assert.rejects(f.make({ keyForDraft: async () => ({ ...f.key, bytes: randomBytes(32) }) }).read({ draftId: f.draftId, revision: 1 }));
    const original = Buffer.from(f.key.bytes); let resolved = 0;
    try { await assert.rejects(f.make({ keyForDraft: async () => { if (++resolved === 2) f.key.bytes.fill(0); return f.key; } }).read({ draftId: f.draftId, revision: 1 })); }
    finally { original.copy(f.key.bytes); original.fill(0); }
    let release!: () => void, calls = 0;
    const waiting = f.make({ keyForDraft: async () => { calls++; await new Promise<void>(r => { release = r; }); return f.key; } });
    await assert.rejects(waiting.read({ draftId: f.draftId, revision: 1 })); await assert.rejects(waiting.read({ draftId: f.draftId, revision: 1 }));
    assert.equal(calls, 1); release(); await new Promise(r => setImmediate(r)); waiting.close();
    await assert.rejects(waiting.read({ draftId: f.draftId, revision: 1 }));
    const closed = f.make({ keyForDraft: async () => { closed.close(); return f.key; } });
    await assert.rejects(closed.read({ draftId: f.draftId, revision: 1 }));
  });
}
