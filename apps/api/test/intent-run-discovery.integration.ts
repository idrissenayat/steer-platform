import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { createRecordedRunDiscovery } from '../src/runtime.ts';
import { createApi } from '../src/app.ts';
import { intentRunDiscoveryOutputSchema } from '@steer/tool-registry/intent-run-discovery-contracts';
import { describeScopeOriginal } from '@steer/data/scope-original-contracts';
import { createScopeReviewOperationStore } from '@steer/data/scope-review-operations';
import { createScopeReviewOriginalStore } from '@steer/data/scope-review-originals';
import type { scopeStepIntegrationFixture } from '../../worker/test/scope-step-runtime.integration.ts';
type Fixture = Awaited<ReturnType<typeof scopeStepIntegrationFixture>>;
export async function testRunDiscovery(setup: () => Promise<Fixture>, check: (name: string, run: () => Promise<void>) => Promise<void>, admin: Pool) {
  function harness(f: Fixture, overrides: Partial<Parameters<typeof createRecordedRunDiscovery>[2]> = {}, patch = {}, future = false, privileged = false) {
    const traced: string[] = [];
    const service = createRecordedRunDiscovery({ async connect() { const c = await (privileged ? admin : f.pools.drafts).connect(); return {
      query: async (sql: string, values?: unknown[]) => { traced.push(sql); return c.query(future && sql.includes("date_trunc('milliseconds',clock_timestamp()) AS clock")
        ? sql.replace('clock_timestamp()', "clock_timestamp()+interval '8 days'") : sql, values); }, release: (broken: boolean) => c.release(broken),
    } as PoolClient; } }, { ...f.config, ...patch }, { authorize: async () => {}, authorizeEntry: async () => {}, ...overrides });
    const state = { principal: { subject: f.config.subject, organizationId: f.config.organizationId, type: 'human', hats: [],
      toolGrants: ['intent.runs.discover'], expiresAt: new Date(Date.now() + 300000).toISOString() } };
    const app = createApi({ authenticate: async () => state.principal, services: { intentRunDiscovery: service } });
    const input = { organizationId: f.config.organizationId, productId: f.config.productId, repository: f.config.repository, draftId: f.draftId, cursor: null };
    return { service, state, input, traced, post: (override = {}) => app.fetch(new Request('https://steer.example/v1/tools/intent.runs.discover', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input, ...override }),
    })) };
  }
  await check('retained run discovery HTTP finds earlier revision inputs without content, model calls, SQL writes or execution leases', async () => {
    const f = await setup(); await f.edit(); const a = harness(f), before = await f.reservations();
    try {
      const response = await a.post(); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
      const page = intentRunDiscoveryOutputSchema.parse(await response.json()); assert.equal(page.latest.revision, 2);
      assert.deepEqual(page.entries, [{ kind: 'scope', source: { revision: 1, revisionDigest: f.saved.reference.revisionDigest,
        scopeInputDigest: f.saved.reference.scopeInputDigest }, ...f.target }]);
      assert.equal(page.nextCursor, null); assert.equal(page.contentLoaded, false); assert.equal(await f.reservations(), before); assert.equal(f.state.calls, 0);
      assert.doesNotMatch(JSON.stringify(page), /originalText|EXAM-MARKER|encrypted_value|executionConfigurationDigest/);
      assert.ok(a.traced.every(sql => !/encrypted_value|steer_execution|steer_usage|INSERT |UPDATE |DELETE |FOR UPDATE/.test(sql)));
      // A new service has no dependency on a browser's earlier preparation ACK.
      a.service.close(); const again = harness(f); try { assert.deepEqual((await (await again.post()).json()).entries, page.entries); } finally { again.service.close(); }
    } finally { a.service.close(); }
  });
  await check('retained run discovery keysets recover all captured references exactly once and reject a source edit between pages', async () => {
    const f = await setup(), expected = [f.target.reviewId];
    for (let i = 1; i <= 23; i++) {
      const original = await describeScopeOriginal({ ...f.described.original, evidence: { ...f.described.original.evidence, head: i.toString(16).padStart(40, '0') } });
      const operations = createScopeReviewOperationStore(f.pools.execution, f.execution, { authorize: f.deps.records.originals.authorizeReview });
      const originals = createScopeReviewOriginalStore(f.pools, f.config, f.deps.records.originals);
      try {
        const admitted = await operations.admit(original.manifest); assert.equal(admitted.outcome, 'ok'); if (admitted.outcome !== 'ok') throw new Error();
        const target = { reviewId: admitted.value.reviewId, preparationDigest: original.manifest.preparationDigest };
        assert.equal((await originals.put({ ...target, original: original.original })).outcome, 'stored'); expected.push(target.reviewId);
      } finally { originals.close(); operations.close(); }
    }
    const a = harness(f); try {
      const first = intentRunDiscoveryOutputSchema.parse(await (await a.post()).json()); assert.equal(first.entries.length, 20); assert.ok(first.nextCursor);
      const second = intentRunDiscoveryOutputSchema.parse(await (await a.post({ cursor: first.nextCursor })).json()); assert.equal(second.entries.length, 4); assert.equal(second.nextCursor, null);
      assert.deepEqual([...first.entries, ...second.entries].map(e => e.kind === 'scope' ? e.reviewId : ''), expected.sort().reverse());
      await f.edit(); assert.equal((await a.post({ cursor: first.nextCursor })).status, 503);
      const refreshed = intentRunDiscoveryOutputSchema.parse(await (await a.post()).json()); assert.equal(refreshed.latest.revision, 2); assert.equal(refreshed.entries.length, 20);
    } finally { a.service.close(); }
  });
  await check('retained run discovery denies foreign scope, wrong grants, caller configuration, privileged SQL and corrupt original metadata', async () => {
    const f = await setup(), a = harness(f); try {
      a.state.principal.toolGrants = ['intent.draft.discover']; assert.equal((await a.post()).status, 403); a.state.principal.toolGrants = ['intent.runs.discover'];
      for (const patch of [{ subject: 'foreign' }, { limit: 100 }, { configurationRevision: 'caller' }]) assert.equal((await a.post(patch)).status, 422);
      assert.equal((await a.post({ draftId: randomUUID() })).status, 503);
      for (const patch of [{ subject: 'foreign' }, { productId: 'foreign' }, { organizationId: 'foreign' }, { recordsPolicyDigest: 'f'.repeat(64) }]) {
        const other = harness(f, {}, patch); try { assert.notEqual((await other.post()).status, 200); } finally { other.service.close(); }
      }
      const privileged = harness(f, {}, {}, false, true); try { assert.equal((await privileged.post()).status, 503); } finally { privileged.service.close(); }
      await admin.query("UPDATE steer_drafts.scope_review_originals SET record=jsonb_set(record,'{draftRevisionDigest}',to_jsonb($2::text)) WHERE review_id=$1", [f.target.reviewId, 'f'.repeat(64)]);
      assert.equal((await a.post()).status, 503); assert.ok(await f.row());
    } finally { a.service.close(); }
  });
  await check('retained run discovery withholds changing pages and late authority loss without holding SQL leases in authorization callbacks', async () => {
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
  await check('retained run discovery never discloses held discarded published or retention-expired histories', async () => {
    for (const column of ["held=true,hold_reference='00000000-0000-4000-8000-000000000001'", "discarded_at=now(),use_until=now()+interval '60 seconds'",
      "published_at=now(),use_until=now()+interval '60 seconds',publication_operation='00000000-0000-4000-8000-000000000001',publication_input=repeat('a',64)"]) {
      const f = await setup(), a = harness(f); try {
        await admin.query(`UPDATE steer_drafts.draft_lifecycles SET ${column} WHERE organization_id=$1 AND draft_id=$2`, [f.config.organizationId, f.draftId]);
        assert.equal((await a.post()).status, 503); assert.ok(await f.row());
      } finally { a.service.close(); }
    }
    const f = await setup(), a = harness(f, {}, {}, true); try { assert.equal((await a.post()).status, 503); assert.ok(await f.row()); } finally { a.service.close(); }
  });
}
