import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { buildIntentEvidenceEnvelope } from '@steer/tool-registry/intent-evidence-contracts';
import { intentDevelopmentPrepareOutputSchema } from '@steer/tool-registry/intent-development-prepare-contracts';
import { createDraftLifecycleStore } from '@steer/data/draft-lifecycle';
import { createDraftRevisionStore } from '@steer/data/draft-revisions';
import { createIntentDraftService } from '@steer/data/intent-draft-service';
import { createDevelopmentOriginalStore } from '@steer/data/development-originals';
import { describeDevelopmentOriginal, type DevelopmentOriginal } from '@steer/data/development-original-contracts';
import { originalFixture } from '../../../packages/data/test/development-original.fixture.ts';
import { createRecordedDevelopmentPreparer, createRecordedDevelopmentReviewer, createRecordedDraftDiscovery, createRecordedCandidateSaveReviewer } from '../src/runtime.ts';
import { verifyCandidateSaveReview } from '@steer/tool-registry/candidate-save-review-contracts';
import { intentDraftDiscoveryOutputSchema } from '@steer/tool-registry/intent-draft-discovery-contracts';
import { verifyDevelopmentReview } from '@steer/tool-registry/intent-development-review-contracts';
import { createApi } from '../src/app.ts';
import { createGitHubReader } from '@steer/adapters/github';
import { createIntentCorpusEvidence } from '@steer/adapters/intent-corpus-evidence';
import { fixture as nativeGitFixture, binding, now } from '../../../packages/adapters/test/github-brief-fixture.ts';
import { seedAgedDraftLifecycle, expireAgedDraftLifecycle } from '../../../packages/data/test/aged-draft-lifecycle.fixture.ts';

type Dependencies = Parameters<typeof createRecordedDevelopmentPreparer>[3];
type Pools = Parameters<typeof createRecordedDevelopmentPreparer>[0];
function reviewApi(pools: Pools, original: DevelopmentOriginal, records: Dependencies['records'], patch: Partial<Parameters<typeof createRecordedDevelopmentReviewer>[1]> = {}) {
  const { action: _action, budget: _budget, expiresAt: _expiry, ...c } = original.configuration, s = original.source;
  const state = { principal: { organizationId: c.organizationId, subject: c.subject, type: 'human', hats: [],
    toolGrants: ['intent.development.review'], expiresAt: new Date(Date.now() + 300000).toISOString() } };
  const drafts = createIntentDraftService(pools.drafts, c, { lifecycle: { authorize: async () => { throw new Error('Read-only'); }, verifyHold: async () => { throw new Error('Read-only'); } },
    revisions: { authorize: async input => { if (input.action !== 'read') throw new Error('Read-only'); await records.authorizeDraft(input); }, keyForDraft: records.keyForDraft } });
  const reviewer = createRecordedDevelopmentReviewer(c, { drafts, evidenceFor: async () => original.evidence,
    authorizeReview: async () => {}, ...patch });
  const app = createApi({ authenticate: async () => state.principal, services: { intentDevelopmentReviewReader: reviewer } });
  const input = { organizationId: c.organizationId, productId: c.productId, repository: c.repository, draftId: s.draftId,
    revision: s.revision, revisionDigest: s.revisionDigest, scopeInputDigest: s.scopeInputDigest };
  const post = (override = {}) => app.fetch(new Request('https://steer.example/v1/tools/intent.development.review', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input, ...override }),
  }));
  return { input, post, state, reviewer, drafts, close() { reviewer.close(); drafts.close(); } };
}
function api(pools: Pools, original: DevelopmentOriginal, records: Dependencies['records'], patch: Partial<Dependencies> = {}) {
  const c = original.configuration, s = original.source;
  const state = { principal: { organizationId: c.organizationId, subject: c.subject, type: 'human', hats: [],
    toolGrants: ['intent.development.prepare'], expiresAt: new Date(Date.now() + 300000).toISOString() } };
  const service = createRecordedDevelopmentPreparer(pools, c, original.profiles, {
    records, evidenceFor: async () => original.evidence, authorizePreparation: async () => {}, ...patch,
  });
  const app = createApi({ authenticate: async () => state.principal, services: { intentDevelopmentPreparer: service } });
  const input = { organizationId: c.organizationId, productId: c.productId, repository: c.repository, configurationRevision: c.configurationRevision,
    draftId: s.draftId, revision: s.revision, revisionDigest: s.revisionDigest, scopeInputDigest: s.scopeInputDigest,
    sourceSnapshotDigest: original.direction.sourceSnapshotDigest, choice: original.direction.choice };
  const post = (override = {}) => app.fetch(new Request('https://steer.example/v1/tools/intent.development.prepare', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input, ...override }),
  }));
  return { service, post, state, input };
}

/** Shared real admission path for the recorded SDK/Temporal fixtures. Source and
 * grants are explicitly synthetic; preparation itself uses production HTTP/SQL. */
export async function prepareRecordedFixture(pools: Pools, original: DevelopmentOriginal, records: Dependencies['records']) {
  const app = api(pools, original, records), review = reviewApi(pools, original, records);
  try {
    const reviewResponse = await review.post(); assert.equal(reviewResponse.status, 200);
    const { output } = await verifyDevelopmentReview(review.input, await reviewResponse.json());
    const response = await app.post({ sourceSnapshotDigest: output.sourceSnapshotDigest, configurationRevision: output.configurationRevision }); assert.equal(response.status, 200);
    const body = intentDevelopmentPrepareOutputSchema.parse(await response.json());
    assert.equal(body.outcome, 'prepared'); if (!body.reference) throw new Error('Preparation reference missing.');
    assert.equal(body.reference.inputDigest, (await describeDevelopmentOriginal(original)).inputDigest); return body.reference;
  } finally { app.service.close(); review.close(); }
}

export async function testDevelopmentPreparation({ admin, connect, check }: {
  admin: Pool; connect(role: string): Pool; check(name: string, run: () => Promise<void>): Promise<void>;
}) {
  const setup = async (branch = 'codex/synthetic', agedLifecycle = false) => {
    const config = { organizationId: `prepare-${randomUUID()}`, subject: 'synthetic-human', productId: 'product', repository: 'github:52',
      branch, configurationRevision: 'prepare-r1', recordsPolicyDigest: 'a'.repeat(64) };
    const budget = { organizationId: config.organizationId, subject: config.subject, configurationRevision: config.configurationRevision,
      budgetId: randomUUID(), approvalDigest: 'b'.repeat(64), capMicrousd: 30, architectMicrousd: 3, testAgentMicrousd: 2 };
    await admin.query("INSERT INTO steer_usage.model_budgets VALUES($1,$2,$3,$4,$5,30,3,2,now()-interval '1 minute',now()+interval '1 hour',true)",
      [budget.organizationId, budget.budgetId, budget.subject, budget.configurationRevision, budget.approvalDigest]);
    const execution = { ...config, action: 'develop', expiresAt: new Date(Date.now() + 3600000).toISOString(), budget };
    const pools = { drafts: connect('steer_draft_runtime'), execution: connect('steer_app') }, key = { keyId: randomUUID(), bytes: randomBytes(32) };
    const records: Dependencies['records'] = { authorize: async () => {}, authorizeOriginal: async () => {}, authorizeOperation: async () => {}, authorizeDraft: async () => {}, keyForDraft: async () => key };
    const lifecycle = createDraftLifecycleStore(pools.drafts, config, { authorize: async () => {}, verifyHold: async () => {} });
    const created = agedLifecycle ? { outcome: 'ok' as const, value: { draftId: await seedAgedDraftLifecycle(admin, config) } }
      : await lifecycle.create({ requestId: randomUUID() }); assert.equal(created.outcome, 'ok'); if (created.outcome !== 'ok') throw new Error();
    const drafts = createDraftRevisionStore(pools.drafts, config, { authorize: records.authorizeDraft, keyForDraft: records.keyForDraft });
    const draftId = created.value.draftId, content = { originalText: ' Exact original intent 🌸\r\n', clarificationTurns: ['Answer one\r\n', 'Answer two'],
      documents: { brief: '# Human Brief\r\n', spec: '# Human Spec\nOut of scope: payroll', exam: '# Human Exam proposal\nNOT RUN' } };
    const saved = await drafts.append({ draftId, mutationId: randomUUID(), expectedRevision: 0, expectedDigest: null, content });
    assert.equal(saved.outcome, 'acknowledged'); if (saved.outcome !== 'acknowledged') throw new Error();
    const described = await originalFixture(execution, { draftId, revision: 1, sourceRevision: 1, revisionDigest: saved.reference.revisionDigest, content });
    const evidence = { ...described.original.evidence, inventoryComplete: true }, envelope = await buildIntentEvidenceEnvelope(evidence);
    const original = (await describeDevelopmentOriginal({ ...described.original, evidence,
      direction: { ...described.original.direction, sourceSnapshotDigest: envelope.sourceSnapshotDigest } })).original;
    const make = (patch: Partial<Dependencies> = {}, otherPools: Pools = pools, otherOriginal = original) => api(otherPools, otherOriginal, records, patch);
    const snapshot = async () => (await admin.query(`SELECT
      (SELECT count(*) FROM steer_execution.intent_operations WHERE organization_id=$1) AS operations,
      (SELECT count(*) FROM steer_drafts.development_originals WHERE organization_id=$1) AS originals,
      (SELECT count(*) FROM steer_usage.model_reservations WHERE organization_id=$1) AS reservations,
      (SELECT count(*) FROM steer_drafts.draft_revisions WHERE organization_id=$1) AS revisions`, [config.organizationId])).rows[0];
    return { config, pools, records, original, make, snapshot, draftId, drafts, lifecycle, content, saved };
  };
  const discover = (f: Awaited<ReturnType<typeof setup>>, patch: Partial<Parameters<typeof createRecordedDraftDiscovery>[2]> = {}, pool = f.pools.drafts, config = f.config) => {
    const service = createRecordedDraftDiscovery(pool, config, { authorize: async () => {}, authorizeEntry: async () => {}, ...patch });
    const state = { principal: { organizationId: config.organizationId, subject: config.subject, type: 'human', hats: [], toolGrants: ['intent.draft.discover'], expiresAt: new Date(Date.now() + 300000).toISOString() } };
    const app = createApi({ authenticate: async () => state.principal, services: { intentDraftDiscovery: service } });
    const post = (patch = {}) => app.fetch(new Request('https://steer.example/v1/tools/intent.draft.discover', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: config.organizationId, productId: config.productId, repository: config.repository, cursor: null, ...patch }) }));
    return { service, state, post };
  };
  await check('drafting preparation uses two draft key reads per phase with final draft closure after evidence and before writes', async () => {
    const f = await setup(), keys = [0, 0, 0], events: string[] = []; let phase = 0, open = false, finalKey = false;
    const pool = (role: 'drafts' | 'execution') => ({ async connect() { const c = await f.pools[role].connect(); return {
      query: async (sql: string, values?: unknown[]) => {
        if (/^\s*INSERT INTO steer_(execution\.intent_operations|drafts\.development_originals)\b/.test(sql)) {
          assert.equal(open, false); assert.equal(finalKey, false); assert.equal(keys[phase - 1], 2); events.push(`write:${phase}`);
        } return c.query(sql, values);
      }, release: (broken: boolean) => c.release(broken),
    } as PoolClient; } });
    const app = f.make({ records: { ...f.records, keyForDraft: async (...args) => {
      if (open || finalKey) { keys[phase - 1] = keys[phase - 1]! + 1; events.push(`${open ? 'initial' : 'final'}:${phase}`); finalKey = false; }
      return f.records.keyForDraft(...args);
    } }, withEvidenceRead: async (_input, _current, work) => {
      phase++; open = true; try { await work(async () => f.original.evidence); } finally { open = false; }
      finalKey = true; events.push(`evidence-closed:${phase}`);
    } }, { drafts: pool('drafts'), execution: pool('execution') });
    try {
      const result = await (await app.post()).json(); assert.equal(result.outcome, 'prepared'); assert.deepEqual(keys, [2, 2, 2]); assert.equal(finalKey, false);
      assert.deepEqual(events, ['initial:1', 'evidence-closed:1', 'final:1', 'write:1', 'initial:2', 'evidence-closed:2', 'final:2', 'write:2', 'initial:3', 'evidence-closed:3', 'final:3']);
      assert.deepEqual(await f.snapshot(), { operations: '1', originals: '1', reservations: '0', revisions: '1' });
      const originals = createDevelopmentOriginalStore(f.pools, f.config, f.records);
      try { assert.deepEqual((await originals.read(result.reference)).original, f.original); } finally { originals.close(); }
    } finally { app.service.close(); f.drafts.close(); f.lifecycle.close(); }
  });
  await check('drafting preparation rejects successful late draft mutations after evidence closure before or after either effect', async () => {
    for (const target of [1, 2, 3]) for (const mode of ['edit', 'hold', 'expire', 'key', 'grant', 'close']) {
      const f = await setup('codex/synthetic', mode === 'expire'); let phase = 0, changed = false, denied = false, keyChanged = false;
      let app: ReturnType<typeof f.make>;
      app = f.make({ records: { ...f.records, authorizeDraft: async c => { if (denied) throw new Error('PRIVATE revoked draft'); await f.records.authorizeDraft(c); },
        keyForDraft: async (...args) => { const key = await f.records.keyForDraft(...args); return keyChanged ? { ...key, bytes: Buffer.alloc(32) } : key; } },
        withEvidenceRead: async (_input, _current, work) => {
          phase++; await work(async () => f.original.evidence); if (phase !== target) return;
          if (mode === 'edit') assert.equal((await f.drafts.append({ draftId: f.draftId, mutationId: randomUUID(), expectedRevision: 1,
            expectedDigest: f.saved.reference.revisionDigest, content: { ...f.content, originalText: 'Late human correction' } })).outcome, 'acknowledged');
          if (mode === 'hold') assert.equal((await f.lifecycle.hold({ draftId: f.draftId, holdReference: randomUUID() })).outcome, 'ok');
          if (mode === 'expire') await expireAgedDraftLifecycle(admin, f.draftId);
          if (mode === 'key') keyChanged = true; if (mode === 'grant') denied = true; if (mode === 'close') app.service.close(); changed = true;
        } });
      try {
        const response = await app.post(), result = await response.json(); assert.equal(changed, true, `${target}/${mode} transition must succeed`);
        assert.equal(response.status, 200); assert.equal(result.outcome, target === 1 ? 'unavailable' : 'unknown'); assert.equal(result.readyToRequestStart, false);
        assert.deepEqual(await f.snapshot(), { operations: target === 1 ? '0' : '1', originals: target === 3 ? '1' : '0', reservations: '0', revisions: mode === 'edit' ? '2' : '1' });
        assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
      } finally { app.service.close(); f.drafts.close(); f.lifecycle.close(); }
    }
  });
  await check('final save-review HTTP restores exact encrypted SQL documents and rechecks current scope without admission, generation or writes', async () => {
    const f = await setup(), evidence = { ...f.original.evidence, inventory: [], documents: [], inventoryComplete: true, accessGapCount: 0 };
    const before = await f.snapshot();
    for (let pass = 0; pass < 2; pass++) {
      const pools = { ...f.pools, drafts: connect('steer_draft_runtime') };
      let keyAllowed = true;
      const source = reviewApi(pools, f.original, { ...f.records, keyForDraft: async (...args) => {
        if (!keyAllowed) throw new Error('PRIVATE revoked key'); return f.records.keyForDraft(...args);
      } }, { evidenceFor: async () => evidence });
      const service = createRecordedCandidateSaveReviewer(f.config, { drafts: source.drafts, sources: source.reviewer, authorizeReview: async () => {} });
      const app = createApi({ authenticate: async () => ({ ...source.state.principal, toolGrants: ['intent.candidate.save.review'] }), services: { candidateSaveReviewer: service } });
      try {
        const reviewed = await (await source.post()).json();
        const input = { ...source.input, configurationRevision: f.config.configurationRevision, sourceSnapshotDigest: reviewed.sourceSnapshotDigest,
          scopeReview: { kind: 'empty-corpus', planDigest: reviewed.scopeBatchPlan.planDigest }, choice: { action: 'new-distinct', reason: 'Human selected new scope after reviewing an explicitly empty inventory.' } };
        const post = () => app.request('/v1/tools/intent.candidate.save.review', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
        const response = await post(); assert.equal(response.status, 200);
        const result = await verifyCandidateSaveReview(input, await response.json(), f.content.documents);
        assert.equal(result.saveConfirmed, false); assert.equal(result.operationCreated, false); assert.equal(result.savedToGit, false);
        assert.doesNotMatch(JSON.stringify(result), /Human Brief|Human Spec|Human Exam/); assert.deepEqual(await f.snapshot(), before);
        keyAllowed = false; const denied = await post(); assert.equal(denied.status, 503); assert.doesNotMatch(await denied.text(), /PRIVATE|reviewDigest/);
        assert.deepEqual(await f.snapshot(), before);
      } finally { service.close(); source.close(); }
    }
  });
  await check('actual discovery HTTP reads latest owner-bound draft and retained run metadata without plaintext, reservations or writes', async () => {
    const f = await setup(), ref = await prepareRecordedFixture(f.pools, f.original, f.records), app = discover(f);
    try {
      const before = await f.snapshot(), response = await app.post(); assert.equal(response.status, 200);
      const page = intentDraftDiscoveryOutputSchema.parse(await response.json()); assert.equal(page.entries.length, 1);
      assert.equal(page.entries[0]!.draftId, f.draftId); assert.equal(page.entries[0]!.latest!.revisionDigest, f.saved.reference.revisionDigest);
      assert.deepEqual(page.entries[0]!.run, { operationId: ref.operationId, inputDigest: ref.inputDigest });
      assert.doesNotMatch(JSON.stringify(page), /Exact original intent|Human Brief|encrypted|contentDigest/); assert.deepEqual(await f.snapshot(), before);
      const edited = await f.drafts.append({ draftId: f.draftId, mutationId: randomUUID(), expectedRevision: 1, expectedDigest: f.saved.reference.revisionDigest, content: { ...f.content, originalText: 'New revision' } });
      assert.equal(edited.outcome, 'acknowledged');
      const latest = intentDraftDiscoveryOutputSchema.parse(await (await app.post()).json()); assert.equal(latest.entries[0]!.latest!.revision, 2); assert.equal(latest.entries[0]!.run, null);
    } finally { app.service.close(); }
  });
  await check('actual discovery keyset pages include empty references exactly once and exclude held, discarded and foreign-config records', async () => {
    const f = await setup(), ids = [f.draftId];
    for (let i = 0; i < 23; i++) { const c = await f.lifecycle.create({ requestId: randomUUID() }); assert.equal(c.outcome, 'ok'); if (c.outcome === 'ok') ids.push(c.value.draftId); }
    const app = discover(f);
    try {
      const first = intentDraftDiscoveryOutputSchema.parse(await (await app.post()).json()); assert.equal(first.entries.length, 20); assert.ok(first.nextCursor);
      const next = intentDraftDiscoveryOutputSchema.parse(await (await app.post({ cursor: first.nextCursor })).json()); assert.equal(next.entries.length, 4); assert.equal(next.nextCursor, null);
      assert.deepEqual([...first.entries, ...next.entries].map(e => e.draftId).sort(), ids.sort()); assert.equal(first.entries.filter(e => e.latest === null).length, 20);
      await f.lifecycle.hold({ draftId: ids[0], holdReference: randomUUID() }); await f.lifecycle.discard({ draftId: ids[1] });
      const fresh = intentDraftDiscoveryOutputSchema.parse(await (await app.post()).json());
      const tail = intentDraftDiscoveryOutputSchema.parse(await (await app.post({ cursor: fresh.nextCursor })).json());
      const visible = [...fresh.entries, ...tail.entries].map(e => e.draftId); assert.equal(visible.length, 22); assert.ok(!visible.includes(ids[0]!) && !visible.includes(ids[1]!));
      for (const patch of [{ subject: 'other-human' }, { configurationRevision: 'different' }, { productId: 'other-product' }]) {
        const other = discover(f, {}, f.pools.drafts, { ...f.config, ...patch });
        try { assert.deepEqual(intentDraftDiscoveryOutputSchema.parse(await (await other.post()).json()).entries, []); } finally { other.service.close(); }
      }
    } finally { app.service.close(); }
  });
  await check('actual discovery conceals changed metadata, late permission loss and failed provenance instead of reporting no drafts', async () => {
    for (const mode of ['hold', 'edit', 'permission', 'authority'] as const) {
      const f = await setup(); let changed = false, app: ReturnType<typeof discover>;
      app = discover(f, { authorizeEntry: async () => {
        if (changed) return; changed = true;
        if (mode === 'hold') await f.lifecycle.hold({ draftId: f.draftId, holdReference: randomUUID() });
        if (mode === 'edit') await f.drafts.append({ draftId: f.draftId, mutationId: randomUUID(), expectedRevision: 1, expectedDigest: f.saved.reference.revisionDigest, content: { ...f.content, originalText: 'Concurrent edit' } });
        if (mode === 'permission') app.state.principal.toolGrants = [];
        if (mode === 'authority') throw new Error('PRIVATE');
      } });
      try { const r = await app.post(); assert.notEqual(r.status, 200); assert.doesNotMatch(await r.text(), /PRIVATE|Exact original intent/); }
      finally { app.service.close(); }
    }
  });
  await check('actual discovery rejects privileged login and malformed cursor without exposing private data', async () => {
    const f = await setup(), adminApp = discover(f, {}, admin), app = discover(f);
    try { assert.notEqual((await adminApp.post()).status, 200);
      for (const patch of [{ cursor: { draftId: f.draftId } }, { productId: 'other' }, { limit: 999 }, { subject: 'other' }]) assert.notEqual((await app.post(patch)).status, 200);
    } finally { adminApp.service.close(); app.service.close(); }
  });
  await check('actual preparation HTTP assembles exact SQL draft, reviewed direction and fixed profiles; recreation and concurrency reuse one original without model reservations', async () => {
    const f = await setup(), clients = Array.from({ length: 3 }, () => f.make());
    try {
      const responses = await Promise.all(clients.map(c => c.post())); assert.ok(responses.every(r => r.status === 200));
      const bodies = await Promise.all(responses.map(r => r.json())); assert.ok(bodies.every(b => b.outcome === 'prepared'));
      assert.ok(bodies.every(b => JSON.stringify(b.reference) === JSON.stringify(bodies[0].reference)));
      const reopened = f.make(); try { assert.deepEqual(await (await reopened.post()).json(), bodies[0]); } finally { reopened.service.close(); }
      assert.deepEqual(await f.snapshot(), { operations: '1', originals: '1', reservations: '0', revisions: '1' });
      const store = createDevelopmentOriginalStore(f.pools, f.config, f.records);
      try { assert.deepEqual((await store.read(bodies[0].reference)).original, f.original); } finally { store.close(); }
      assert.equal(bodies[0].executionAuthorized, false); assert.equal(bodies[0].authoritativeClearance, false);
      for (const marker of ['Exact original intent', 'Human Brief', 'Exact synthetic instructions']) assert.equal(JSON.stringify(bodies[0]).includes(marker), false);
    } finally { clients.forEach(c => c.service.close()); }
  });
  await check('actual source-review HTTP releases exact current authorized evidence from the encrypted SQL draft with no writes or reservations', async () => {
    const f = await setup(), app = reviewApi(f.pools, f.original, f.records);
    try {
      const before = await f.snapshot(), response = await app.post(); assert.equal(response.status, 200);
      const { output, envelope } = await verifyDevelopmentReview(app.input, await response.json());
      assert.deepEqual(output.evidence, f.original.evidence); assert.equal(envelope.coverage.complete, true);
      assert.equal(output.authoritativeClearance, false); assert.deepEqual(await f.snapshot(), before);
      for (const patch of [{ revisionDigest: 'f'.repeat(64) }, { productId: 'other' }, { revision: 2 }, { budget: 5 }]) assert.notEqual((await app.post(patch)).status, 200);
      assert.deepEqual(await f.snapshot(), before);
    } finally { app.close(); }
  });
  await check('actual reviewed metadata denies late access/provenance loss and changed draft or Git evidence, without preparing source records', async () => {
    for (const mode of ['permission', 'authority', 'evidence', 'draft'] as const) {
      const f = await setup(); let reads = 0, app: ReturnType<typeof reviewApi>;
      app = reviewApi(f.pools, f.original, f.records, { authorizeReview: async () => {
        if (mode === 'permission') app.state.principal.toolGrants = [];
        if (mode === 'authority') throw new Error('Synthetic evidence authority denied');
        if (mode === 'draft' && reads++ === 0) await f.drafts.append({ draftId: f.draftId, mutationId: randomUUID(), expectedRevision: 1,
          expectedDigest: f.saved.outcome === 'acknowledged' ? f.saved.reference.revisionDigest : null, content: { ...f.content, originalText: 'New human edit' } });
      }, evidenceFor: async () => ({ ...f.original.evidence, ...(mode === 'evidence' && reads++ > 0 ? { head: 'f'.repeat(40) } : {}) }) });
      try {
        assert.notEqual((await app.post()).status, 200);
        const snapshot = await f.snapshot(); assert.equal(snapshot.operations, '0'); assert.equal(snapshot.originals, '0'); assert.equal(snapshot.reservations, '0');
      } finally { app.close(); }
    }
  });
  await check('incomplete, missing-document and access-gap evidence stop preparation without admitting an operation or inferring newness', async () => {
    for (const patch of [{ inventoryComplete: false }, { documents: [] }, { accessGapCount: 1 }]) {
      const f = await setup(), evidence = { ...f.original.evidence, ...patch }, envelope = await buildIntentEvidenceEnvelope(evidence);
      const app = f.make({ evidenceFor: async () => evidence });
      try { const response = await app.post({ sourceSnapshotDigest: envelope.sourceSnapshotDigest }); assert.equal(response.status, 200);
        const body = await response.json(); assert.equal(body.outcome, 'scope-incomplete'); assert.equal(body.reference, null); assert.equal(body.readyToRequestStart, false);
        assert.equal(body.coverage.complete, false); assert.equal(body.authoritativeClearance, false); assert.deepEqual(await f.snapshot(), { operations: '0', originals: '0', reservations: '0', revisions: '1' });
      } finally { app.service.close(); }
    }
  });
  await check('preparation rejects old review/source/configuration, unauthorised scope and caller-supplied budget or profiles before storing work', async () => {
    const f = await setup(), app = f.make();
    try {
      for (const patch of [{ sourceSnapshotDigest: 'f'.repeat(64) }, { revisionDigest: 'e'.repeat(64) }, { choice: { action: 'extend-existing', target: { path: 'items/9999-other/BRIEF.md', revision: 'a'.repeat(40), contentDigest: 'e'.repeat(64) }, reason: 'Wrong target' } }]) {
        const r = await app.post(patch); assert.equal(r.status, 200); assert.notEqual((await r.json()).outcome, 'prepared');
      }
      for (const patch of [{ productId: 'foreign' }, { configurationRevision: 'other' }]) assert.equal((await app.post(patch)).status, 403);
      assert.equal((await app.post({ budget: 5 })).status, 422); assert.equal((await app.post({ profiles: {} })).status, 422);
      app.state.principal.toolGrants = []; assert.equal((await app.post()).status, 403);
      assert.deepEqual(await f.snapshot(), { operations: '0', originals: '0', reservations: '0', revisions: '1' });
    } finally { app.service.close(); }
  });
  await check('a draft edit, hold, source-head change or admission denial during current authority checks prevents original admission', async () => {
    for (const change of ['edit', 'hold', 'head', 'deny']) {
      const f = await setup(); let checked = false, evidence = f.original.evidence;
      const app = f.make({ evidenceFor: async () => evidence, authorizePreparation: async () => {
        if (checked) return; checked = true;
        if (change === 'deny') throw new Error('private-admission-denial');
        if (change === 'head') evidence = { ...evidence, head: 'b'.repeat(40) };
        if (change === 'hold') await f.lifecycle.hold({ draftId: f.draftId, holdReference: randomUUID() });
        if (change === 'edit') await f.drafts.append({ draftId: f.draftId, mutationId: randomUUID(), expectedRevision: 1, expectedDigest: f.saved.reference.revisionDigest,
          content: { ...f.content, originalText: 'Newer text' } });
      } });
      try { const r = await app.post(); assert.equal(r.status, 200); assert.notEqual((await r.json()).outcome, 'prepared');
        const counts = await f.snapshot(); assert.equal(counts.operations, '0'); assert.equal(counts.originals, '0'); assert.equal(counts.reservations, '0');
      } finally { app.service.close(); }
    }
  });
  await check('lost operation or encrypted-original COMMIT acknowledgements recover one exact preparation without renewing the execution configuration', async () => {
    for (const phase of ['operations', 'originals'] as const) {
      const f = await setup(), poolKey = phase === 'operations' ? 'execution' : 'drafts'; let inserted = false;
      const uncertain = { connect: async () => { const c = await f.pools[poolKey].connect(); return {
        query: async (sql: string, values?: unknown[]) => { const result = await c.query(sql, values);
          if (sql.includes(phase === 'operations' ? 'INSERT INTO steer_execution.intent_operations' : 'INSERT INTO steer_drafts.development_originals')) inserted = true;
          if (inserted && sql === 'COMMIT') throw new Error('private-commit-ack-lost'); return result; }, release: (broken: boolean) => c.release(broken),
      } as PoolClient; } };
      const lost = f.make({}, { ...f.pools, [poolKey]: uncertain });
      try { const r = await lost.post(); assert.equal(r.status, 200); const b = await r.json(); assert.equal(b.outcome, 'unknown'); assert.equal(b.originalPreserved, false); assert.equal(b.readyToRequestStart, false); }
      finally { lost.service.close(); }
      const ref = await prepareRecordedFixture(f.pools, f.original, f.records);
      assert.ok(ref.operationId); assert.deepEqual(await f.snapshot(), { operations: '1', originals: '1', reservations: '0', revisions: '1' });
      const changed = f.make({}, f.pools, { ...f.original, configuration: { ...f.original.configuration, expiresAt: new Date(Date.parse(f.original.configuration.expiresAt) + 1000).toISOString() } });
      try { assert.equal((await (await changed.post()).json()).outcome, 'conflict'); } finally { changed.service.close(); }
    }
  });
  await check('post-admission permission loss conceals the preparation response; current-authority replay recovers the existing immutable work', async () => {
    const f = await setup(); let app: ReturnType<typeof api>, mutate = false;
    app = f.make({ records: { ...f.records, authorizeOriginal: async c => {
      if (c.action === 'read' && !mutate) { mutate = true; app.state.principal.toolGrants = []; }
    } } });
    try { assert.equal((await app.post()).status, 403); assert.equal((await f.snapshot()).originals, '1'); }
    finally { app.service.close(); }
    await prepareRecordedFixture(f.pools, f.original, f.records);
    assert.deepEqual(await f.snapshot(), { operations: '1', originals: '1', reservations: '0', revisions: '1' });
  });

  const native = async () => {
    const f = await setup(binding.branch), cleanup: Array<() => void> = [], git = nativeGitFixture({ after: run => cleanup.push(run) });
    git.add([{ path: 'intent/0001/BRIEF.md', content: '# Existing billing\nHuman invoices.\n' },
      { path: 'intent/0001/SPEC.md', content: '# Existing scope\nOut of scope: payroll.\n' },
      { path: 'intent/0001/EXAM.md', content: 'PRIVATE-EXAM-NOT-SCOPE' }]);
    const reader = createGitHubReader({ ...binding, organizationId: f.config.organizationId },
      { appJwt: async () => 'synthetic-app-jwt', fetch: git.transport, now: () => now });
    const authority: Parameters<typeof createIntentCorpusEvidence>[2] = {
      authorize: async () => ({ permissionsRevision: 'p1' }),
      select: async context => ({ ...context, selection: 'canonical', authorityDigest: 'a'.repeat(64) }), authorizeSource: async () => {},
    };
    const { organizationId, productId, repository, branch } = f.config;
    const corpus = createIntentCorpusEvidence(reader, { organizationId, productId, repository, branch, retrievalConfigurationRevision: 'native-r1' }, authority);
    const source = { organizationId, productId, repository, branch, scopeInputDigest: f.original.source.scopeInputDigest };
    const evidence = (await corpus.collect(source, async () => {})).evidence, envelope = await buildIntentEvidenceEnvelope(evidence);
    const original = (await describeDevelopmentOriginal({ ...f.original, evidence,
      direction: { ...f.original.direction, sourceSnapshotDigest: envelope.sourceSnapshotDigest } })).original;
    const evidenceFor: Dependencies['evidenceFor'] = async (_input, current) => (await corpus.collect(source, current)).evidence;
    const window: NonNullable<Dependencies['withEvidenceRead']> = (input, current, work) => corpus.withReadSession({ ...source,
      scopeInputDigest: input.scopeInputDigest }, current, read => work(async () => (await read()).evidence));
    const services: Array<{ close(): void }> = [];
    const make = (patch: Partial<Dependencies> = {}, pools: Pools = f.pools, useWindow = true) => {
      const app = f.make({ evidenceFor, ...(useWindow ? { withEvidenceRead: window } : {}), ...patch }, pools, original); services.push(app.service); return app;
    };
    return { f, reader, git, authority, original, evidence, window, make,
      close() { services.forEach(s => s.close()); corpus.close(); f.drafts.close(); f.lifecycle.close(); cleanup.forEach(run => run()); } };
  };
  await check('native drafting preparation windows reduce source reads versus full fallback with the same exact immutable original', async () => {
    const n = await native(); let bodies = 0; const method = n.reader.readArtifact;
    n.reader.readArtifact = async (...args) => { bodies++; return method(...args); };
    try {
      const before = n.git.calls.length, prepared = await (await n.make().post()).json(); assert.equal(prepared.outcome, 'prepared');
      const windowRequests = n.git.calls.length - before; assert.equal(bodies, 8); const snapshot = await n.f.snapshot();
      bodies = 0; const fallbackBefore = n.git.calls.length;
      assert.deepEqual(await (await n.make({}, n.f.pools, false).post()).json(), prepared);
      const fallbackRequests = n.git.calls.length - fallbackBefore; assert.equal(bodies, 14); assert.ok(windowRequests < fallbackRequests);
      assert.deepEqual(await n.f.snapshot(), snapshot); assert.deepEqual(snapshot, { operations: '1', originals: '1', reservations: '0', revisions: '1' });
      const originals = createDevelopmentOriginalStore(n.f.pools, n.f.config, n.f.records);
      try { assert.deepEqual((await originals.read(prepared.reference)).original, n.original); } finally { originals.close(); }
      assert.doesNotMatch(JSON.stringify(n.original.evidence), /PRIVATE-EXAM-NOT-SCOPE/); assert.equal(n.git.mutations(), 0);
      console.log('Synthetic native drafting preparation comparison: ' + JSON.stringify({ sources: 2, windowBodyReads: 8,
        fallbackBodyReads: 14, windowRequests, fallbackRequests, originalUnchanged: true, reservations: 0, providerSaves: 0 }));
    } finally { n.close(); }
  });
  await check('native drafting preparation sessions close before admission and persistence and reopen with fresh bodies', async () => {
    const n = await native(); let open = false, windows = 0, policies = 0;
    const writes: string[] = [], bodies: string[] = [], method = n.reader.readArtifact;
    n.reader.readArtifact = async (...args) => { bodies.push(`${open ? windows : 0}:${writes.length}`); return method(...args); };
    const pool = (role: 'drafts' | 'execution') => ({ async connect() { const client = await n.f.pools[role].connect(); return {
      query: async (sql: string, values?: unknown[]) => {
        if (/^\s*INSERT INTO steer_(execution\.intent_operations|drafts\.development_originals)\b/.test(sql)) {
          assert.equal(open, false); writes.push(sql.includes('intent_operations') ? 'admission' : 'original');
        } return client.query(sql, values);
      }, release: (broken: boolean) => client.release(broken),
    } as PoolClient; } });
    try {
      const app = n.make({ authorizePreparation: async () => { assert.equal(open, true); policies++; },
        withEvidenceRead: async (input, current, work) => {
          assert.equal(open, false); open = true; windows++;
          try { await n.window(input, current, work); } finally { open = false; }
        } }, { drafts: pool('drafts'), execution: pool('execution') });
      const result = await (await app.post()).json(); assert.equal(result.outcome, 'prepared');
      assert.equal(open, false); assert.equal(windows, 3); assert.equal(policies, 3); assert.deepEqual(writes, ['admission', 'original']);
      assert.deepEqual(bodies, ['0:0', '0:0', '1:0', '1:0', '2:1', '2:1', '3:2', '3:2']);
      assert.deepEqual(await n.f.snapshot(), { operations: '1', originals: '1', reservations: '0', revisions: '1' }); assert.equal(n.git.mutations(), 0);
    } finally { n.close(); }
  });
  await check('native drafting preparation rejects final grant loss and malformed evidence windows before admission', async () => {
    for (const mode of ['grant', 'skipped', 'replayed', 'nonvoid'] as const) {
      const n = await native(); let revoked = false;
      n.authority.authorizeSource = async ref => { if (revoked && ref.path.endsWith('/SPEC.md')) throw new Error('PRIVATE source revoked'); };
      try {
        const app = n.make({ withEvidenceRead: async (input, current, work) => {
          if (mode === 'skipped') return;
          await n.window(input, current, async read => { await work(read); if (mode === 'grant') revoked = true;
            if (mode === 'replayed') await work(read).catch(() => {}); });
          if (mode === 'nonvoid') return true as unknown as void;
        } });
        const result = await (await app.post()).json(); assert.equal(result.outcome, 'unavailable'); assert.equal(result.originalPreserved, false);
        assert.deepEqual(await n.f.snapshot(), { operations: '0', originals: '0', reservations: '0', revisions: '1' }); assert.equal(n.git.mutations(), 0);
      } finally { n.close(); }
    }
  });
  await check('native drafting preparation source drift after an effect preserves existing records and returns uncertainty', async () => {
    for (const target of ['intent_operations', 'development_originals']) {
      const n = await native(), role = target === 'intent_operations' ? 'execution' : 'drafts'; let inserted = false, changed = false;
      const pools = { ...n.f.pools, [role]: { async connect() { const client = await n.f.pools[role].connect(); return {
        query: async (sql: string, values?: unknown[]) => { const result = await client.query(sql, values);
          if (sql.includes(`INSERT INTO steer_${role === 'execution' ? 'execution' : 'drafts'}.${target}`)) inserted = true;
          if (sql === 'COMMIT' && inserted && !changed) { changed = true; n.git.add([{ path: 'intent/0001/SPEC.md', content: '# Changed after an effect\n' }]); }
          return result;
        }, release: (broken: boolean) => client.release(broken),
      } as PoolClient; } } };
      try {
        const result = await (await n.make({}, pools).post()).json(); assert.equal(changed, true); assert.equal(result.outcome, 'unknown');
        assert.equal(result.originalPreserved, false); assert.equal(result.readyToRequestStart, false);
        assert.deepEqual(await n.f.snapshot(), { operations: '1', originals: target === 'intent_operations' ? '0' : '1', reservations: '0', revisions: '1' });
        if (target === 'development_originals') {
          const originals = createDevelopmentOriginalStore(n.f.pools, n.f.config, n.f.records);
          try { assert.deepEqual((await originals.read(result.reference)).original, n.original); } finally { originals.close(); }
        }
        assert.equal(n.git.mutations(), 0);
      } finally { n.close(); }
    }
  });
}
