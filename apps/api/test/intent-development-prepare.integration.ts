import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { buildIntentEvidenceEnvelope } from '@steer/tool-registry/intent-evidence-contracts';
import { intentDevelopmentPrepareOutputSchema } from '@steer/tool-registry/intent-development-prepare-contracts';
import { createDraftLifecycleStore } from '@steer/data/draft-lifecycle';
import { createDraftRevisionStore } from '@steer/data/draft-revisions';
import { createDevelopmentOriginalStore } from '@steer/data/development-originals';
import { describeDevelopmentOriginal, type DevelopmentOriginal } from '@steer/data/development-original-contracts';
import { originalFixture } from '../../../packages/data/test/development-original.fixture.ts';
import { createRecordedDevelopmentPreparer } from '../src/runtime.ts';
import { createApi } from '../src/app.ts';

type Dependencies = Parameters<typeof createRecordedDevelopmentPreparer>[3];
type Pools = Parameters<typeof createRecordedDevelopmentPreparer>[0];
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
  const app = api(pools, original, records);
  try {
    const response = await app.post(); assert.equal(response.status, 200);
    const body = intentDevelopmentPrepareOutputSchema.parse(await response.json());
    assert.equal(body.outcome, 'prepared'); if (!body.reference) throw new Error('Preparation reference missing.');
    assert.equal(body.reference.inputDigest, (await describeDevelopmentOriginal(original)).inputDigest); return body.reference;
  } finally { app.service.close(); }
}

export async function testDevelopmentPreparation({ admin, connect, check }: {
  admin: Pool; connect(role: string): Pool; check(name: string, run: () => Promise<void>): Promise<void>;
}) {
  const setup = async () => {
    const config = { organizationId: `prepare-${randomUUID()}`, subject: 'synthetic-human', productId: 'product', repository: 'github:52',
      branch: 'codex/synthetic', configurationRevision: 'prepare-r1', recordsPolicyDigest: 'a'.repeat(64) };
    const budget = { organizationId: config.organizationId, subject: config.subject, configurationRevision: config.configurationRevision,
      budgetId: randomUUID(), approvalDigest: 'b'.repeat(64), capMicrousd: 30, architectMicrousd: 3, testAgentMicrousd: 2 };
    await admin.query("INSERT INTO steer_usage.model_budgets VALUES($1,$2,$3,$4,$5,30,3,2,now()-interval '1 minute',now()+interval '1 hour',true)",
      [budget.organizationId, budget.budgetId, budget.subject, budget.configurationRevision, budget.approvalDigest]);
    const execution = { ...config, action: 'develop', expiresAt: new Date(Date.now() + 3600000).toISOString(), budget };
    const pools = { drafts: connect('steer_draft_runtime'), execution: connect('steer_app') }, key = { keyId: randomUUID(), bytes: randomBytes(32) };
    const records: Dependencies['records'] = { authorize: async () => {}, authorizeOriginal: async () => {}, authorizeOperation: async () => {}, authorizeDraft: async () => {}, keyForDraft: async () => key };
    const lifecycle = createDraftLifecycleStore(pools.drafts, config, { authorize: async () => {}, verifyHold: async () => {} });
    const created = await lifecycle.create({ requestId: randomUUID() }); assert.equal(created.outcome, 'ok'); if (created.outcome !== 'ok') throw new Error();
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
}
