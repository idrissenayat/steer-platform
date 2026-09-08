import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { createRecordedScopeDiscovery } from '../src/runtime.ts';
import { createApi } from '../src/app.ts';
import { intentScopeDiscoveryOutputSchema } from '@steer/tool-registry/intent-scope-discovery-contracts';
import { describeScopeOriginal } from '@steer/data/scope-original-contracts';
import { createScopeReviewOperationStore } from '@steer/data/scope-review-operations';
import { createScopeReviewOriginalStore } from '@steer/data/scope-review-originals';
import type { scopeStepIntegrationFixture } from '../../worker/test/scope-step-runtime.integration.ts';
type Fixture = Awaited<ReturnType<typeof scopeStepIntegrationFixture>>;
export async function testScopeDiscovery(setup: () => Promise<Fixture>, check: (name: string, run: () => Promise<void>) => Promise<void>, admin: Pool) {
  function harness(f: Fixture, overrides: Partial<Parameters<typeof createRecordedScopeDiscovery>[2]> = {}, patch = {}, traced: string[] = [], futureClock = false) {
    const service = createRecordedScopeDiscovery({ async connect() { const c = await f.pools.drafts.connect(); return {
      query: async (sql: string, values?: unknown[]) => { traced.push(sql);
        return c.query(futureClock && sql.includes("date_trunc('milliseconds',clock_timestamp()) AS clock")
          ? sql.replace('clock_timestamp()', "clock_timestamp()+interval '8 days'") : sql, values); }, release: (broken: boolean) => c.release(broken),
    } as PoolClient; } }, { ...f.config, ...patch }, { authorize: async () => {}, authorizeEntry: async () => {}, ...overrides });
    const state = { principal: { subject: f.config.subject, organizationId: f.config.organizationId, type: 'human', hats: [],
      toolGrants: ['intent.scope.discover'], expiresAt: new Date(Date.now() + 300000).toISOString() } };
    const app = createApi({ authenticate: async () => state.principal, services: { intentScopeDiscovery: service } });
    const input = { organizationId: f.config.organizationId, productId: f.config.productId, repository: f.config.repository, draftId: f.draftId,
      revision: 1, revisionDigest: f.saved.reference.revisionDigest, scopeInputDigest: f.described.manifest.scopeInputDigest, cursor: null };
    return { service, state, input, traced, post: (override = {}) => app.fetch(new Request('https://steer.example/v1/tools/intent.scope.discover', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input, ...override }),
    })) };
  }
  await check('scope discovery HTTP reads metadata under draft RLS only, with no keys, executions, reservations or source content', async () => {
    const f = await setup(), authorizations: number[] = [], a = harness(f, { authorize: async () => { authorizations.push(a.traced.length); } }), before = await f.reservations();
    try {
      const response = await a.post(); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
      const page = intentScopeDiscoveryOutputSchema.parse(await response.json()); assert.deepEqual(page.entries, [f.target]);
      assert.equal(page.executionAuthorized, false); assert.equal(page.contentLoaded, false); assert.equal(page.nextCursor, null);
      assert.equal(page.order, 'review-id-descending-not-chronological'); assert.equal(await f.reservations(), before);
      for (const text of [f.content.originalText, 'EXAM-MARKER', 'encrypted_value']) assert.equal(JSON.stringify(page).includes(text), false);
      assert.ok(a.traced.every(sql => !/encrypted_value|steer_execution|steer_usage|INSERT |UPDATE |DELETE |FOR UPDATE/.test(sql)));
      assert.equal(authorizations.length, 2); assert.ok(Math.max(...authorizations) < a.traced.length, 'final metadata authority precedes final SQL snapshot');
      assert.equal((await f.read()).status, 'pending'); // Discovery did not execute the stored review.
    } finally { a.service.close(); }
  });
  await check('scope discovery rejects missing grants, injected fields and foreign owner/product/configuration before disclosing references', async () => {
    const f = await setup(), a = harness(f);
    try {
      a.state.principal.toolGrants = ['intent.scope.read']; assert.equal((await a.post()).status, 403); a.state.principal.toolGrants = ['intent.scope.discover'];
      for (const patch of [{ subject: 'foreign' }, { limit: 100 }, { configurationRevision: 'caller' }]) assert.equal((await a.post(patch)).status, 422);
      for (const patch of [{ draftId: randomUUID() }, { revision: 2 }, { revisionDigest: 'f'.repeat(64) }, { scopeInputDigest: 'e'.repeat(64) }]) assert.equal((await a.post(patch)).status, 503);
      for (const patch of [{ subject: 'foreign' }, { productId: 'foreign' }, { organizationId: 'foreign' }, { recordsPolicyDigest: 'f'.repeat(64) }]) {
        const other = harness(f, {}, patch); try { assert.notEqual((await other.post()).status, 200); } finally { other.service.close(); }
      }
    } finally { a.service.close(); }
  });
  await check('scope discovery excludes older revisions without claiming no earlier work; exact latest revision can have no retained references', async () => {
    const f = await setup(), a = harness(f);
    try {
      const edit = await f.drafts.append({ draftId: f.draftId, mutationId: randomUUID(), expectedRevision: 1, expectedDigest: f.saved.reference.revisionDigest,
        content: { ...f.content, originalText: 'Changed human scope' } }); assert.equal(edit.outcome, 'acknowledged'); if (edit.outcome !== 'acknowledged') throw new Error();
      assert.equal((await a.post()).status, 503);
      const page = intentScopeDiscoveryOutputSchema.parse(await (await a.post({ revision: 2, revisionDigest: edit.reference.revisionDigest, scopeInputDigest: edit.reference.scopeInputDigest })).json());
      assert.deepEqual(page.entries, []); assert.equal(page.nextCursor, null); assert.ok(await f.row());
    } finally { a.service.close(); }
  });
  await check('scope discovery keyset pages enumerate multiple captured originals for one draft without an invented timestamp or duplicate references', async () => {
    const f = await setup(), expected = [f.target];
    for (let i = 1; i <= 23; i++) {
      const configuration = f.execution;
      const described = await describeScopeOriginal({ ...f.described.original, configuration,
        evidence: { ...f.described.original.evidence, head: i.toString(16).padStart(40, '0') } });
      const store = createScopeReviewOperationStore(f.pools.execution, configuration, { authorize: f.deps.records.originals.authorizeReview });
      try {
        const admitted = await store.admit(described.manifest); assert.equal(admitted.outcome, 'ok'); if (admitted.outcome !== 'ok') throw new Error();
        const reference = { reviewId: admitted.value.reviewId, preparationDigest: described.manifest.preparationDigest };
        const captured = createScopeReviewOriginalStore(f.pools, f.config, f.deps.records.originals);
        try { assert.equal((await captured.put({ ...reference, original: described.original })).outcome, 'stored'); } finally { captured.close(); }
        expected.push(reference);
      } finally { store.close(); }
    }
    const a = harness(f); try {
      const first = intentScopeDiscoveryOutputSchema.parse(await (await a.post()).json()); assert.equal(first.entries.length, 20); assert.ok(first.nextCursor);
      const second = intentScopeDiscoveryOutputSchema.parse(await (await a.post({ cursor: first.nextCursor })).json()); assert.equal(second.entries.length, 4); assert.equal(second.nextCursor, null);
      assert.deepEqual([...first.entries, ...second.entries], expected.sort((a, b) => a.reviewId < b.reviewId ? 1 : -1));
    } finally { a.service.close(); }
  });
  await check('held, expired, discarded or published scope source lifecycles never disclose retained references', async () => {
    for (const column of ["held=true,hold_reference='00000000-0000-4000-8000-000000000001'",
      "discarded_at=now(),use_until=now()+interval '60 seconds'", "published_at=now(),use_until=now()+interval '60 seconds',publication_operation='00000000-0000-4000-8000-000000000001',publication_input=repeat('a',64)"]) {
      const f = await setup(), a = harness(f); try {
        await admin.query(`UPDATE steer_drafts.draft_lifecycles SET ${column} WHERE organization_id=$1 AND draft_id=$2`, [f.config.organizationId, f.draftId]);
        assert.equal((await a.post()).status, 503); assert.ok(await f.row());
      } finally { a.service.close(); }
    }
    // The disposable SQL fixture advances only its observed database clock; it
    // does not change persisted retention values or disable lifecycle guards.
    const f = await setup(), expired = harness(f, {}, {}, [], true);
    try { assert.equal((await expired.post()).status, 503); assert.ok(await f.row()); } finally { expired.service.close(); }
  });
  await check('late discovery grant loss, per-reference denial and concurrent source hold suppress metadata without holding leases in callbacks', async () => {
    for (const kind of ['grant', 'entry', 'hold', 'edit']) {
      const f = await setup(); let a: ReturnType<typeof harness>;
      a = harness(f, { authorizeEntry: async () => {
        if (kind === 'grant') a.state.principal.toolGrants = [];
        if (kind === 'entry') throw new Error('PRIVATE metadata denial');
        if (kind === 'hold') assert.equal((await f.lifecycle.hold({ draftId: f.draftId, holdReference: randomUUID() })).outcome, 'ok');
        if (kind === 'edit') await f.edit();
      } });
      try { const response = await a.post(); assert.equal(response.status, kind === 'grant' ? 403 : 503); assert.doesNotMatch(await response.text(), /PRIVATE|reviewId/); }
      finally { a.service.close(); }
    }
  });
  await check('scope discovery rejects malformed retained metadata instead of using it as verified provenance', async () => {
    const f = await setup(), a = harness(f); try {
      // Disposable fixture administrator models corruption; runtime has no UPDATE grant.
      await admin.query("UPDATE steer_drafts.scope_review_originals SET record=jsonb_set(record,'{preparationDigest}',to_jsonb($2::text)) WHERE review_id=$1", [f.target.reviewId, 'f'.repeat(64)]);
      assert.equal((await a.post()).status, 503);
    } finally { a.service.close(); }
  });
}
