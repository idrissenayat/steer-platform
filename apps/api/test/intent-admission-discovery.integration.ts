import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { createApi } from '../src/app.ts';
import { createRecordedAdmissionDiscovery } from '../src/runtime.ts';
import { intentAdmissionOutputSchema } from '@steer/tool-registry/intent-admission-discovery-contracts';
import { createScopeReviewOriginalStore } from '@steer/data/scope-review-originals';
import { describeScopeOriginal } from '@steer/data/scope-original-contracts';
import { createScopeReviewOperationStore } from '@steer/data/scope-review-operations';
import { createIntentOperationStore } from '@steer/data/intent-operations';
import { createDevelopmentOriginalStore } from '@steer/data/development-originals';
import { originalFixture } from '../../../packages/data/test/development-original.fixture.ts';
import type { scopeStepIntegrationFixture } from '../../worker/test/scope-step-runtime.integration.ts';
type Fixture = Awaited<ReturnType<typeof scopeStepIntegrationFixture>>;
export async function testAdmissionDiscovery(setup: () => Promise<Fixture>, check: (name: string, run: () => Promise<void>) => Promise<void>, admin: Pool) {
  const configuration = (f: Fixture) => ({ records: f.config, executions: [{ kind: 'scope', configuration: f.execution }] });
  function harness(f: Fixture, config = configuration(f), overrides: Partial<Parameters<typeof createRecordedAdmissionDiscovery>[2]> = {}, privileged: 'execution' | 'drafts' | null = null, clockAdvance: '31 days' | '2 hours' | null = null) {
    const traced: string[] = [];
    const pool = (kind: 'execution' | 'drafts') => ({ async connect() {
      const c = await (kind === privileged ? admin : f.pools[kind]).connect();
      return { query(sql: string, values?: unknown[]) { traced.push(sql);
        if (clockAdvance && sql.includes("date_trunc('milliseconds',clock_timestamp()) AS clock")) sql = sql.replace('clock_timestamp()', `clock_timestamp()+interval '${clockAdvance}'`);
        return c.query(sql, values); }, release: (broken?: boolean) => c.release(broken) } as PoolClient;
    } });
    const service = createRecordedAdmissionDiscovery({ execution: pool('execution'), drafts: pool('drafts') }, config, { authorize: async () => {}, authorizeEntry: async () => {}, ...overrides });
    const state = { principal: { subject: f.config.subject, organizationId: f.config.organizationId, type: 'human', hats: [], toolGrants: ['intent.admissions.discover'], expiresAt: new Date(Date.now() + 600000).toISOString() } };
    const app = createApi({ authenticate: async () => state.principal, services: { intentAdmissionDiscovery: service } });
    const input = { organizationId: f.config.organizationId, productId: f.config.productId, repository: f.config.repository, draftId: f.draftId, cursor: null };
    return { service, state, traced, input, post: (patch = {}) => app.fetch(new Request('https://steer.example/v1/tools/intent.admissions.discover', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input, ...patch }),
    })) };
  }
  async function admit(f: Fixture, n: number, capture = false) {
    const original = await describeScopeOriginal({ ...f.described.original, evidence: { ...f.described.original.evidence, head: n.toString(16).padStart(40, '0') } });
    const ops = createScopeReviewOperationStore(f.pools.execution, f.execution, { authorize: f.deps.records.originals.authorizeReview });
    const originals = createScopeReviewOriginalStore(f.pools, f.config, f.deps.records.originals);
    try {
      const admitted = await ops.admit(original.manifest); assert.equal(admitted.outcome, 'ok'); if (admitted.outcome !== 'ok') throw new Error('Admission failed');
      const target = { reviewId: admitted.value.reviewId, preparationDigest: original.manifest.preparationDigest };
      if (capture) assert.equal((await originals.put({ ...target, original: original.original })).outcome, 'stored');
      return { ...target, original: original.original };
    } finally { ops.close(); originals.close(); }
  }
  await check('preparation diagnostics discover recorded scope and development admissions without originals, keys, dispatch or SQL mutation', async () => {
    const f = await setup(), missing = await admit(f, 101); const { scopeTerms: _, ...base } = f.execution;
    const development = { ...base, action: 'develop' }, ops = createIntentOperationStore(f.pools.execution, development, { authorize: async () => {}, verifyCheckpoint: async () => {} });
    const admitted = await ops.create({ draftId: f.draftId, draftRevision: 1, inputDigest: 'd'.repeat(64) }); ops.close();
    assert.equal(admitted.outcome, 'ok'); if (admitted.outcome !== 'ok') throw new Error('Development admission failed');
    const config: any = configuration(f); config.executions.push({ kind: 'development', configuration: development });
    await f.edit(); const a = harness(f, config), before = await f.reservations();
    try {
      const response = await a.post(); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
      const page = intentAdmissionOutputSchema.parse(await response.json()); assert.equal(page.entries.length, 3); assert.equal(page.latest.revision, 2);
      assert.equal(page.configuredExecutionCount, 2); assert.equal(page.entries.filter(e => e.originalRecord === 'not-observed').length, 2);
      assert.ok(page.entries.some(e => e.kind === 'scope' && e.reviewId === missing.reviewId && e.originalRecord === 'not-observed'));
      assert.ok(page.entries.some(e => e.kind === 'scope' && e.reviewId === f.target.reviewId && e.originalRecord === 'present-metadata'));
      assert.ok(page.entries.some(e => e.kind === 'development' && e.operationId === admitted.value.operationId));
      assert.equal(page.executionState, 'not-inspected'); assert.equal(page.retryAuthorized, false); assert.equal(page.originalContentVerified, false);
      assert.equal(await f.reservations(), before); assert.equal(f.state.calls, 0);
      assert.ok(a.traced.every(sql => !/encrypted_value|intent_steps|scope_review_batches|model_reservations|INSERT |UPDATE |DELETE |FOR UPDATE/.test(sql)));
      assert.doesNotMatch(JSON.stringify(page), /originalText|EXAM-MARKER|configurationRevision/);
      a.service.close(); const restarted = harness(f, config); try { assert.deepEqual((await (await restarted.post()).json()).entries, page.entries); } finally { restarted.service.close(); }
    } finally { a.service.close(); }
  });
  await check('preparation diagnostics observe genuine development original metadata without requiring decryption or model execution', async () => {
    const f = await setup(), { scopeTerms: _, ...base } = f.execution, execution = { ...base, action: 'develop' };
    const original = await originalFixture(execution, { draftId: f.draftId, revision: 1, sourceRevision: 1, revisionDigest: f.saved.reference.revisionDigest, content: f.content });
    const ops = createIntentOperationStore(f.pools.execution, execution, { authorize: async () => {}, verifyCheckpoint: async () => {} });
    const admitted = await ops.create({ draftId: f.draftId, draftRevision: 1, inputDigest: original.inputDigest }); ops.close();
    assert.equal(admitted.outcome, 'ok'); if (admitted.outcome !== 'ok') throw new Error('Development admission failed');
    const config: any = configuration(f); config.executions.push({ kind: 'development', configuration: execution });
    const a = harness(f, config); try {
      const before = intentAdmissionOutputSchema.parse(await (await a.post()).json()); assert.equal(before.entries.find(e => e.kind === 'development')?.originalRecord, 'not-observed');
      const originals = createDevelopmentOriginalStore(f.pools, f.config, { authorize: async () => {}, authorizeOriginal: async () => {}, authorizeOperation: async () => {}, authorizeDraft: async () => {}, keyForDraft: f.deps.records.originals.keyForDraft });
      try { assert.equal((await originals.put({ operationId: admitted.value.operationId, inputDigest: original.inputDigest, original: original.original })).outcome, 'stored'); } finally { originals.close(); }
      const after = intentAdmissionOutputSchema.parse(await (await a.post()).json()); assert.equal(after.entries.find(e => e.kind === 'development')?.originalRecord, 'present-metadata');
      assert.equal(after.originalContentVerified, false); assert.equal(f.state.calls, 0); assert.equal(await f.reservations(), 0);
    } finally { a.service.close(); }
  });
  await check('preparation diagnostics keyset pages include missing originals once and reject changed binding sets or source revisions', async () => {
    const f = await setup(), ids = [f.target.reviewId]; for (let n = 1; n <= 13; n++) ids.push((await admit(f, n, n % 2 === 0)).reviewId);
    const a = harness(f); try {
      const first = intentAdmissionOutputSchema.parse(await (await a.post()).json()); assert.equal(first.entries.length, 10); assert.ok(first.nextCursor);
      const second = intentAdmissionOutputSchema.parse(await (await a.post({ cursor: first.nextCursor })).json()); assert.equal(second.entries.length, 4); assert.equal(second.nextCursor, null);
      assert.deepEqual([...first.entries, ...second.entries].map(e => e.kind === 'scope' ? e.reviewId : ''), ids.sort().reverse());
      assert.equal((await a.post({ cursor: { ...first.nextCursor, bindingSetDigest: 'f'.repeat(64) } })).status, 503);
      await f.edit(); assert.equal((await a.post({ cursor: first.nextCursor })).status, 503);
    } finally { a.service.close(); }
  });
  await check('preparation diagnostics reject cross-scope grants privileged roles malformed records and browser configuration', async () => {
    const f = await setup(), a = harness(f); try {
      for (const patch of [{ configurationRevision: 'caller' }, { subject: 'foreign' }, { limit: 100 }]) assert.equal((await a.post(patch)).status, 422);
      assert.equal((await a.post({ productId: 'foreign' })).status, 403); assert.equal((await a.post({ draftId: randomUUID() })).status, 503);
      a.state.principal.toolGrants = ['intent.runs.discover']; assert.equal((await a.post()).status, 403); a.state.principal.toolGrants = ['intent.admissions.discover'];
      for (const role of ['execution', 'drafts'] as const) { const other = harness(f, configuration(f), {}, role); try { assert.equal((await other.post()).status, 503); } finally { other.service.close(); } }
      const duplicate = configuration(f); duplicate.executions.push(duplicate.executions[0]!); assert.throws(() => harness(f, duplicate));
      const wrong = configuration(f); wrong.executions[0]!.configuration = { ...f.execution, subject: 'foreign' }; assert.throws(() => harness(f, wrong));
      await admin.query("UPDATE steer_drafts.scope_review_originals SET record=jsonb_set(record,'{draftRevisionDigest}',to_jsonb($2::text)) WHERE review_id=$1", [f.target.reviewId, 'f'.repeat(64)]);
      assert.equal((await a.post()).status, 503);
    } finally { a.service.close(); }
  });
  await check('preparation diagnostics withhold late original capture source changes and revoked authority without SQL leases across callbacks', async () => {
    for (const kind of ['capture', 'edit', 'hold', 'grant', 'deny', 'close']) {
      const f = await setup(), missing = await admit(f, 404); let a: ReturnType<typeof harness>, once = false;
      a = harness(f, configuration(f), { authorizeEntry: async () => {
        if (once) return; once = true;
        if (kind === 'capture') { const originals = createScopeReviewOriginalStore(f.pools, f.config, f.deps.records.originals); try { assert.equal((await originals.put(missing)).outcome, 'stored'); } finally { originals.close(); } }
        if (kind === 'edit') await f.edit();
        if (kind === 'hold') assert.equal((await f.lifecycle.hold({ draftId: f.draftId, holdReference: randomUUID() })).outcome, 'ok');
        if (kind === 'grant') a.state.principal.toolGrants = [];
        if (kind === 'deny') throw new Error('PRIVATE denial');
        if (kind === 'close') a.service.close();
      } });
      try { const response = await a.post(); assert.equal(response.status, kind === 'grant' ? 403 : 503); assert.doesNotMatch(await response.text(), /PRIVATE|reviewId/); assert.equal(f.state.calls, 0); }
      finally { a.service.close(); }
    }
  });
  await check('preparation diagnostics distinguish unavailable retention from empty configured coverage and expired execution from retry authority', async () => {
    const f = await setup(); const changed = configuration(f); changed.executions[0]!.configuration = { ...f.execution, configurationRevision: 'unrecorded-binding', budget: { ...f.execution.budget, configurationRevision: 'unrecorded-binding' } };
    const empty = harness(f, changed); try { const response = await empty.post(); assert.equal(response.status, 200); const page = intentAdmissionOutputSchema.parse(await response.json()); assert.deepEqual(page.entries, []); assert.equal(page.coverage, 'configured-scope-and-development-bindings-only'); } finally { empty.service.close(); }
    const historical = harness(f, configuration(f), {}, null, '2 hours'); try {
      const response = await historical.post(); assert.equal(response.status, 200); const page = intentAdmissionOutputSchema.parse(await response.json());
      assert.ok(page.entries.every(e => e.executionExpired)); assert.equal(page.retryAuthorized, false);
    } finally { historical.service.close(); }
    const expired = harness(f, configuration(f), {}, null, '31 days'); try { assert.equal((await expired.post()).status, 503); } finally { expired.service.close(); }
    for (const change of ["held=true,hold_reference='00000000-0000-4000-8000-000000000001'", "discarded_at=now(),use_until=now()+interval '60 seconds'",
      "published_at=now(),use_until=now()+interval '60 seconds',publication_operation='00000000-0000-4000-8000-000000000001',publication_input=repeat('a',64)"]) {
      const f = await setup(), a = harness(f); try { await admin.query(`UPDATE steer_drafts.draft_lifecycles SET ${change} WHERE organization_id=$1 AND draft_id=$2`, [f.config.organizationId, f.draftId]); assert.equal((await a.post()).status, 503); } finally { a.service.close(); }
    }
  });
}
