import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { createIntentDraftService } from '@steer/data/intent-draft-service';
import { createDraftLifecycleStore } from '@steer/data/draft-lifecycle';
import type { DatabasePool } from '@steer/data/runtime-pool';
import { createApi } from '../src/app.ts';

/** Actual HTTP handlers/tool registry/encrypted SQL. Identities, grants and keys
 * are synthetic; no real draft retention or model/Git authority is activated. */
export async function testIntentDraftApi({ admin, connect, check }: {
  admin: Pool; connect(role: string): Pool; check(name: string, run: () => Promise<void>): Promise<void>;
}) {
  const services: ReturnType<typeof createIntentDraftService>[] = [];
  const setup = () => {
    const config = { organizationId: `draft-http-${randomUUID()}`, subject: 'synthetic-human', productId: 'product', repository: 'github:52',
      branch: 'codex/synthetic', configurationRevision: 'r1', recordsPolicyDigest: 'a'.repeat(64) };
    const scope = { organizationId: config.organizationId, productId: config.productId, repository: config.repository }, pool = connect('steer_draft_runtime');
    const state = { denied: false, keyDenied: false, revokeAfterWrite: false, principal: { subject: config.subject, organizationId: config.organizationId, type: 'human', hats: [],
      toolGrants: ['intent.draft.create', 'intent.draft.append', 'intent.draft.read'], expiresAt: new Date(Date.now() + 300000).toISOString() } };
    const key = { keyId: 'synthetic-draft-http', bytes: randomBytes(32) };
    const authorize = async () => { if (state.denied) throw new Error('private-records-denial'); };
    const make = (database: DatabasePool = pool) => {
      const service = createIntentDraftService(database, config, { lifecycle: { authorize }, revisions: { authorize, keyForDraft: async () => {
        if (state.keyDenied) throw new Error('private-key-denial'); return key;
      } } }); services.push(service);
      return createApi({ authenticate: async () => {
        if (state.revokeAfterWrite && Number((await admin.query('SELECT count(*) AS n FROM steer_drafts.draft_revisions WHERE organization_id=$1', [config.organizationId])).rows[0].n) > 0)
          return { ...state.principal, toolGrants: [] };
        return state.principal;
      }, services: { intentDrafts: service } });
    };
    const app = make(), requestId = randomUUID();
    const post = (name: string, input: unknown, target = app) => target.fetch(new Request(`https://steer.example/v1/tools/intent.draft.${name}`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }));
    const create = async () => {
      const response = await post('create', { ...scope, requestId }); assert.equal(response.status, 200); const value = await response.json();
      assert.equal(value.outcome, 'created'); assert.equal(value.contentPreserved, false); return value as { draftId: string; createdAt: string; useUntil: string };
    };
    const content = { originalText: ' Private HTTP intent 🌸\r\n', clarificationTurns: [' Exact answer '],
      documents: { brief: '# Brief\r\n' + 'Exact text '.repeat(1700), spec: '# Spec\nKeep whitespace ', exam: '# Exam\nNOT RUN ' } };
    const append = (draftId: string) => ({ ...scope, draftId, mutationId: randomUUID(), expectedRevision: 0, expectedDigest: null, content });
    const count = async (draftId: string) => Number((await admin.query('SELECT count(*) AS n FROM steer_drafts.draft_revisions WHERE draft_id=$1', [draftId])).rows[0].n);
    return { config, scope, pool, state, make, post, create, content, append, count };
  };
  try {
    await check('actual draft HTTP create/append/read preserves a large exact document bundle in encrypted SQL across API recreation', async () => {
      const f = setup(), created = await f.create(); assert.deepEqual(await f.create(), created);
      const input = f.append(created.draftId); assert.ok(Buffer.byteLength(JSON.stringify(input)) > 16384);
      const response = await f.post('append', input); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
      const ack = await response.json(); assert.equal(ack.outcome, 'acknowledged'); assert.equal(ack.savedToGit, false);
      const restored = await f.post('read', { ...f.scope, draftId: created.draftId, revision: 'latest' }, f.make()); assert.equal(restored.status, 200);
      const value = await restored.json(); assert.deepEqual(value.content, f.content); assert.equal(value.revisionDigest, ack.revisionDigest);
      const rows = (await admin.query('SELECT record,encrypted_value FROM steer_drafts.draft_revisions WHERE draft_id=$1', [created.draftId])).rows;
      for (const marker of ['Private HTTP intent', 'Exact answer', 'Exact text', '# Spec', 'NOT RUN']) assert.equal(JSON.stringify(rows).includes(marker), false);
      assert.equal(await f.count(created.draftId), 1);
    });
    await check('HTTP draft revision conflicts preserve newer human edits and replay an older mutation without replacing them', async () => {
      const f = setup(), { draftId } = await f.create(), input = f.append(draftId);
      const first = await (await f.post('append', input)).json(); assert.equal(first.outcome, 'acknowledged');
      const updated = { ...input, mutationId: randomUUID(), expectedRevision: 1, expectedDigest: first.revisionDigest,
        content: { ...f.content, originalText: 'The newer human intent' } };
      assert.equal((await (await f.post('append', updated)).json()).outcome, 'acknowledged');
      assert.equal((await (await f.post('append', { ...input, mutationId: randomUUID() })).json()).outcome, 'conflict');
      const duplicate = await (await f.post('append', input)).json(); assert.equal(duplicate.outcome, 'acknowledged'); assert.equal(duplicate.revision, 1); assert.equal(duplicate.latestRevision, 2);
      const current = await (await f.post('read', { ...f.scope, draftId, revision: 'latest' })).json(); assert.equal(current.content.originalText, 'The newer human intent');
      assert.equal(current.sourceRevision, 2); assert.equal(await f.count(draftId), 2);
    });
    await check('lost draft SQL acknowledgement returns unknown and an exact mutation replay recovers one stored revision through HTTP', async () => {
      const f = setup(), { draftId } = await f.create(); let lost = false;
      const uncertain: DatabasePool = { async connect() { const c = await f.pool.connect(); let inserted = false; return {
        async query(sql: string, values?: unknown[]) { const result = await c.query(sql, values); if (sql.startsWith('INSERT INTO steer_drafts.draft_revisions')) inserted = true;
          if (sql === 'COMMIT' && inserted && !lost) { lost = true; throw new Error('private-lost-draft-ack'); } return result; }, release: (broken: boolean) => c.release(broken),
      } as PoolClient; } };
      const input = f.append(draftId), first = await f.post('append', input, f.make(uncertain));
      assert.equal((await first.json()).outcome, 'unknown'); assert.ok(lost); assert.equal(await f.count(draftId), 1);
      const recovered = await (await f.post('append', input, f.make())).json(); assert.equal(recovered.outcome, 'acknowledged'); assert.equal(recovered.revision, 1);
      assert.equal(await f.count(draftId), 1);
    });
    await check('read-only HTTP history returns exact older draft bytes and latest metadata without rebasing or authorizing a write', async () => {
      const f = setup(), { draftId } = await f.create(), input = f.append(draftId);
      const first = await (await f.post('append', input)).json(); assert.equal(first.outcome, 'acknowledged');
      const newer = { ...f.content, originalText: 'Newer intent stays current', documents: { brief: '# Corrected Brief', spec: '# Corrected Spec', exam: '# Corrected Exam' } };
      const second = await (await f.post('append', { ...input, mutationId: randomUUID(), expectedRevision: 1, expectedDigest: first.revisionDigest, content: newer })).json();
      assert.equal(second.outcome, 'acknowledged'); f.state.principal.toolGrants = ['intent.draft.read'];
      const target = { ...f.scope, draftId, revision: 1 }, response = await f.post('read', target, f.make());
      assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
      const history = await response.json(); assert.deepEqual(history.content, f.content);
      assert.equal(history.revision, 1); assert.equal(history.latestRevision, 2); assert.equal(history.revisionDigest, first.revisionDigest);
      assert.equal(history.scopeInputDigest, first.scopeInputDigest); assert.equal(history.savedToGit, false);
      const latest = await (await f.post('read', { ...target, revision: 'latest' })).json(); assert.deepEqual(latest.content, newer);
      assert.equal(latest.revision, 2); assert.equal((await f.post('append', input)).status, 403); assert.equal(await f.count(draftId), 2);
      f.state.keyDenied = true; const denied = await f.post('read', target);
      assert.equal(denied.status, 503); assert.equal((await denied.text()).includes('Private HTTP intent'), false);
      f.state.keyDenied = false; f.state.principal.subject = 'different-owner'; assert.equal((await f.post('read', target)).status, 403);
      assert.equal(await f.count(draftId), 2);
    });
    await check('owner changes, key denial and durable holds prevent private draft HTTP restoration without deleting retained rows', async () => {
      const f = setup(), { draftId } = await f.create(); assert.equal((await (await f.post('append', f.append(draftId))).json()).outcome, 'acknowledged');
      const input = { ...f.scope, draftId, revision: 'latest' };
      f.state.principal.subject = 'other-human'; assert.equal((await f.post('read', input)).status, 403); f.state.principal.subject = f.config.subject;
      f.state.keyDenied = true; assert.equal((await f.post('read', input)).status, 503); f.state.keyDenied = false;
      const lifecycle = createDraftLifecycleStore(f.pool, f.config, { authorize: async () => {}, verifyHold: async () => {} });
      assert.equal((await lifecycle.hold({ draftId, holdReference: randomUUID() })).outcome, 'ok'); lifecycle.close();
      const held = await f.post('read', input); assert.equal(held.status, 503); assert.equal((await held.text()).includes('Private HTTP intent'), false);
      assert.equal(await f.count(draftId), 1);
    });
    await check('HTTP draft tool grants never bypass denied records-policy authority or cross-product scope', async () => {
      const f = setup(), { draftId } = await f.create(), input = f.append(draftId); f.state.denied = true;
      assert.equal((await (await f.post('append', input)).json()).outcome, 'unavailable'); assert.equal(await f.count(draftId), 0);
      f.state.denied = false; assert.equal((await f.post('append', { ...input, productId: 'other' })).status, 403); assert.equal(await f.count(draftId), 0);
    });
    await check('post-commit HTTP permission loss conceals the acknowledgement without undoing storage or permitting duplicate draft revisions', async () => {
      const f = setup(), { draftId } = await f.create(), input = f.append(draftId); f.state.revokeAfterWrite = true;
      const denied = await f.post('append', input); assert.equal(denied.status, 403);
      assert.equal((await denied.text()).includes('Private HTTP intent'), false); assert.equal(await f.count(draftId), 1);
      f.state.revokeAfterWrite = false;
      assert.equal((await (await f.post('append', input)).json()).outcome, 'acknowledged'); assert.equal(await f.count(draftId), 1);
      const restored = await (await f.post('read', { ...f.scope, draftId, revision: 'latest' })).json(); assert.deepEqual(restored.content, f.content);
    });
    await check('concurrent HTTP draft edits share SQL compare-and-swap and acknowledge only one competing revision', async () => {
      const f = setup(), { draftId } = await f.create(), input = f.append(draftId);
      const values = await Promise.all([input, { ...input, mutationId: randomUUID(), content: { ...f.content, originalText: 'Competing edit' } }]
        .map(async command => (await f.post('append', command)).json()));
      assert.deepEqual(values.map(v => v.outcome).sort(), ['acknowledged', 'conflict']); assert.equal(await f.count(draftId), 1);
    });
  } finally { services.forEach(service => service.close()); }
}
