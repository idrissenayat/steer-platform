import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { createIntentDraftService } from '@steer/data/intent-draft-service';
import { createDraftLifecycleStore } from '@steer/data/draft-lifecycle';
import type { DatabasePool } from '@steer/data/runtime-pool';
import { createGitHubReader } from '@steer/adapters/github';
import { verifyDevelopmentReview } from '@steer/tool-registry/intent-development-review-contracts';
import { createIdentityRuntime, createOwnedIntentJourney } from '../src/runtime.ts';
import { intentJourneyRuntimeFixture } from './intent-journey-runtime.fixture.ts';
import { intentJourneyFixture } from './intent-journey.fixture.ts';
import { intentJourneyFactoryFixture } from './intent-journey-factory.fixture.ts';
import { now as nativeFixtureNow } from '../../../packages/adapters/test/github-brief-fixture.ts';

/** Actual signed-JWT/native-Git authorization and encrypted SQL through the
 * production identity composition. Issuer, records authority and keys are
 * synthetic. Other bundle capabilities deny; this is not full I1–I6 acceptance. */
export async function testManagedIntentJourneyRuntime({ admin, connect, check }: {
  admin: Pool; connect(role: string): Pool; check(name: string, run: () => Promise<void>): Promise<void>;
}) {
  for (const concrete of [false, true]) await check(`${concrete ? 'concrete factory' : 'managed inventory'} authenticated journey retains exact encrypted draft across lost acknowledgement and runtime reconstruction with current policy and Git revocation`, async () => {
    const cleanup: Array<() => void> = [], identity = await intentJourneyRuntimeFixture({ after: run => cleanup.push(run) });
    const runtimes: Awaited<ReturnType<typeof createIdentityRuntime>>[] = [], key = { keyId: 'synthetic-managed-draft', bytes: randomBytes(32) };
    const { itemIds: _items, ...records } = identity.configuration, pool = connect('steer_draft_runtime');
    const scope = { organizationId: records.organizationId, productId: records.productId, repository: records.repository };
    const factoryConfiguration = intentJourneyFactoryFixture(identity.configuration).config, factoryPools: Pool[] = [];
    const discoveryTools = ['intent.draft.discover', 'intent.runs.discover', 'intent.scope.discover', 'intent.admissions.discover'];
    const repositoryDocuments = [{ path: 'intent/0272/BRIEF.md', content: '# Existing billing\r\nHuman invoice review. 🌸\r\n' },
      { path: 'intent/0272/SPEC.md', content: '# Existing scope\nOut of scope: appointment booking.\n' }];
    if (concrete) {
      identity.publish({ ...identity.grant, toolGrants: [...identity.grant.toolGrants, ...discoveryTools, 'intent.development.review'] });
      identity.source.add(repositoryDocuments);
    }
    let lost = false, allowed = true, corpusAllowed = true, closed = 0, active = 0;
    const uncertainFor = (selected: Pool): DatabasePool => ({ async connect() {
      const client = await selected.connect(); let inserted = false;
      return { query: async (sql: string, values?: unknown[]) => {
        const result = await client.query(sql, values);
        if (sql.includes('INSERT INTO steer_drafts.draft_revisions')) inserted = true;
        if (sql === 'COMMIT' && inserted && !lost) { lost = true; throw new Error('PRIVATE lost managed draft acknowledgement'); }
        return result;
      }, release: (broken: boolean) => client.release(broken) } as PoolClient;
    } });
    const uncertain = uncertainFor(pool);
    const authority = async () => { if (!allowed) throw new Error('PRIVATE current synthetic policy denied'); };
    const make = async () => {
      const runtime = await createIdentityRuntime(identity.profile, identity.secrets, { ...identity.ports,
        createIntentJourney: async () => {
          if (concrete) {
            const fixture = intentJourneyFactoryFixture(identity.configuration), drafts = connect('steer_draft_runtime'), execution = connect('steer_app');
            factoryPools.push(drafts, execution);
            fixture.deps.resources.pools = { drafts: uncertainFor(drafts), execution };
            fixture.deps.resources.reader = createGitHubReader(identity.profile.github.binding,
              { appJwt: async () => 'synthetic-app-jwt', fetch: identity.source.transport, now: () => nativeFixtureNow });
            fixture.deps.drafts = { lifecycle: { authorize: authority }, revisions: { authorize: authority, keyForDraft: async () => key } };
            const discovery = { authorize: authority, authorizeEntry: authority };
            fixture.deps.discovery = { drafts: discovery, runs: discovery, scopes: discovery, admissions: discovery };
            const sourceAuthority = async () => { await authority(); if (!corpusAllowed) throw new Error('PRIVATE corpus denied'); };
            fixture.deps.corpus = {
              authorize: async () => { await sourceAuthority(); return { permissionsRevision: identity.source.head() }; },
              select: async context => { await sourceAuthority(); assert.equal(context.root, 'intent/0272');
                return { ...context, selection: 'canonical', authorityDigest: 'b'.repeat(64) }; },
              authorizeSource: async reference => { await sourceAuthority(); assert.ok(repositoryDocuments.some(d => d.path === reference.path)); },
            };
            fixture.deps.development.authorizeReview = sourceAuthority;
            fixture.deps.resources.shutdown = async () => { closed++; await Promise.all([drafts.end(), execution.end()]); active--; };
            active++;
            return createOwnedIntentJourney(identity.configuration, factoryConfiguration, fixture.deps);
          }
          const fixture = intentJourneyFixture(identity.configuration);
          const draft = createIntentDraftService(uncertain, records, { lifecycle: { authorize: authority },
            revisions: { authorize: authority, keyForDraft: async () => key } });
          (fixture.services as any).intentDrafts = draft;
          fixture.owned.shutdown = async () => { closed++; active--; draft.close(); }; active++;
          return fixture.owned;
        }, authorizeIntentJourney: authority });
      runtimes.push(runtime); return runtime;
    };
    const post = (runtime: Awaited<ReturnType<typeof make>>, name: string, input: unknown) => runtime.fetch(identity.request(`intent.draft.${name}`, input));
    try {
      const first = await make(), request = { ...scope, requestId: randomUUID() };
      const create = await post(first, 'create', request); assert.equal(create.status, 200, await create.clone().text());
      const created = await create.json(); assert.equal(created.outcome, 'created');
      const content = { originalText: ' Keep the human intent exactly 🌸\r\n', clarificationTurns: [' Exact answer '],
        documents: { brief: '# Brief\r\nExact source ', spec: '# Spec\nNo guessed claims ', exam: '# Exam\nNOT RUN ' } };
      const append = { ...scope, draftId: created.draftId, mutationId: randomUUID(), expectedRevision: 0, expectedDigest: null, content };
      const response = await post(first, 'append', append); assert.equal(response.status, 200); assert.equal((await response.json()).outcome, 'unknown'); assert.equal(lost, true);
      const rows = async () => (await admin.query('SELECT * FROM steer_drafts.draft_revisions WHERE organization_id=$1 AND draft_id=$2', [scope.organizationId, created.draftId])).rows;
      const encrypted = await rows(); assert.equal(encrypted.length, 1); assert.doesNotMatch(JSON.stringify(encrypted), /human intent|Exact answer|No guessed claims|NOT RUN/);
      assert.equal(first.status().database.connections, 0); await first.shutdown(); assert.equal(closed, 1);
      const restored = await make(), recovery = await post(restored, 'append', append);
      assert.equal(recovery.status, 200); const ack = await recovery.json(); assert.equal(ack.outcome, 'acknowledged'); assert.equal(ack.revision, 1);
      assert.deepEqual(await rows(), encrypted);
      const read = { ...scope, draftId: created.draftId, revision: 'latest' };
      const exact = await post(restored, 'read', read); assert.equal(exact.status, 200); const value = await exact.json();
      assert.deepEqual(value.content, content); assert.equal(value.revisionDigest, ack.revisionDigest); assert.equal(value.savedToGit, false);
      if (concrete) {
        const queries = [{ ...scope, cursor: null }, { ...scope, draftId: created.draftId, cursor: null },
          { ...scope, draftId: created.draftId, revision: value.revision, revisionDigest: value.revisionDigest, scopeInputDigest: value.scopeInputDigest, cursor: null },
          { ...scope, draftId: created.draftId, cursor: null }];
        for (let i = 0; i < discoveryTools.length; i++) {
          const response = await restored.fetch(identity.request(discoveryTools[i]!, queries[i]));
          assert.equal(response.status, 200, await response.clone().text()); const page = await response.json();
          assert.equal(page.contentLoaded ?? page.originalContentVerified, false); assert.equal(page.savedToGit, false);
          if (i === 0) assert.equal(page.entries[0].draftId, created.draftId); else assert.deepEqual(page.entries, []);
          if (i === 3) assert.equal(page.configuredExecutionCount, 2);
          assert.doesNotMatch(JSON.stringify(page), /human intent|Exact answer|No guessed claims/);
        }
        const reviewInput = { ...scope, draftId: created.draftId, revision: value.revision, revisionDigest: value.revisionDigest, scopeInputDigest: value.scopeInputDigest };
        const reviewResponse = await restored.fetch(identity.request('intent.development.review', reviewInput));
        assert.equal(reviewResponse.status, 200, await reviewResponse.clone().text());
        const { output, envelope } = await verifyDevelopmentReview(reviewInput, await reviewResponse.json());
        assert.equal(envelope.coverage.complete, true); assert.equal(output.evidence.head, identity.source.head());
        assert.deepEqual(output.evidence.documents.map(d => d.content), repositoryDocuments.map(d => d.content));
        assert.equal(output.semanticReviewComplete, false); assert.equal(output.scopeBatchPlan.modelCallsStarted, 0);
        assert.equal(output.savedToGit, false); corpusAllowed = false;
        const denied = await restored.fetch(identity.request('intent.development.review', reviewInput));
        assert.equal(denied.status, 503); assert.doesNotMatch(await denied.text(), /PRIVATE|Existing billing|appointment booking/); corpusAllowed = true;
      }
      assert.equal((await post(restored, 'read', { ...read, productId: 'foreign' })).status, 403);
      allowed = false; const denied = await post(restored, 'read', read); assert.equal(denied.status, 503); assert.doesNotMatch(await denied.text(), /PRIVATE|human intent/); allowed = true;
      identity.publish({ ...identity.grant, toolGrants: [] }); assert.equal((await post(restored, 'read', read)).status, 403);
      identity.publish({ ...identity.grant, active: false }); assert.equal((await post(restored, 'read', read)).status, 401);
      identity.publish();
      const lifecycle = createDraftLifecycleStore(pool, records, { authorize: authority, verifyHold: async () => {} });
      try { assert.equal((await lifecycle.hold({ draftId: created.draftId, holdReference: randomUUID() })).outcome, 'ok'); } finally { lifecycle.close(); }
      const held = await post(restored, 'read', read); assert.equal(held.status, 503); assert.doesNotMatch(await held.text(), /human intent|Exact answer/);
      assert.deepEqual(await rows(), encrypted); assert.equal(identity.source.mutations(), 0); assert.equal(restored.status().database.connections, 0);
      assert.equal((await admin.query('SELECT published_at FROM steer_drafts.draft_lifecycles WHERE draft_id=$1', [created.draftId])).rows[0].published_at, null);
      await restored.shutdown(); assert.equal(closed, 2); assert.equal(active, 0);
      if (concrete) { assert.equal(factoryPools.length, 4); assert.ok(factoryPools.every(p => p.ending)); }
    } finally {
      try { await Promise.all(runtimes.map(runtime => runtime.shutdown())); }
      finally { key.bytes.fill(0); cleanup.forEach(run => run()); }
    }
  });
}
