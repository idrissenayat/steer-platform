import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { createIdentityRuntime, createOwnedIntentJourney } from '../src/runtime.ts';
import type { ManagedRuntimeIntentJourney } from '../src/intent-journey-services.ts';
import { intentJourneyFactoryFixture } from './intent-journey-factory.fixture.ts';
import { recordedRuntimeFixture } from './recorded-runtime-fixture.ts';
import { nativeCandidateJourneyFixture } from './native-candidate-journey.fixture.ts';
import { scopeDraftIntegrationFixture } from '../../../packages/data/test/scope-originals.integration.ts';
import { scopeReviewFixture } from '../../../packages/tool-registry/test/intent-scope-review.fixture.ts';
import { prepareIntentScopeReview } from '@steer/tool-registry/intent-scope-review';
import { intentScopePrepareOutputSchema } from '@steer/tool-registry/intent-scope-prepare-contracts';
import { verifyIntentScopeReadOutput } from '@steer/tool-registry/intent-scope-read-contracts';
import { verifyDevelopmentReview } from '@steer/tool-registry/intent-development-review-contracts';
import { buildIntentDevelopmentContext } from '@steer/tool-registry/intent-development-context';
import { intentDevelopmentPrepareOutputSchema } from '@steer/tool-registry/intent-development-prepare-contracts';
import { intentDevelopmentReadOutputSchema } from '@steer/tool-registry/intent-development-read-contracts';
import { intentDevelopmentHistoryOutputSchema } from '@steer/tool-registry/intent-development-history-contracts';
import { createScopeStepRuntime } from '../../worker/src/scope-step-runtime.ts';
import { createRecordedDevelopmentModel } from '../../worker/src/recorded-development-model.ts';
import { createDevelopmentStepRuntime } from '../../worker/src/development-step-runtime.ts';
import { authenticatedCandidateConfirmation } from './authenticated-candidate-confirmation.integration.ts';
import { authenticatedCandidateSave } from '../../worker/test/authenticated-candidate-save.integration.ts';
import { authenticatedModelWorkflows } from '../../worker/test/authenticated-model-workflows.integration.ts';
import { createNativeRequestMeter, summarizeNativeRequests, subtractNativeRequests } from './native-request-metrics.ts';
import { authenticatedJourneyChoice, authenticatedJourneyItem, type AuthenticatedJourneyDirection } from './authenticated-journey-direction.fixture.ts';
import { createIntentPerformanceProbe } from './intent-performance-probe.ts';
import { testAuthenticatedPerformancePrefix } from './authenticated-performance-prefix.integration.ts';
import { createIdentityRequestProfile } from './identity-request-profile.ts';
import { testRecordsReadsetFeasibility } from './records-readset-feasibility.integration.ts';
import { testOwnedRecordsReadset } from './records-owned-readset.integration.ts';
import { ownedScopeReadFixture, ownedDevelopmentReadFixture, ownedDevelopmentOriginalFixture } from './owned-scope-read.fixture.ts';
import { testOwnedDevelopmentHistoryProjection } from './owned-development-history.integration.ts';
import { testOwnedDevelopmentStartClosure } from './owned-development-start.integration.ts';

/** Signed synthetic JWT + native Git grants, real API constructor graph, SQL and
 * recorded SDK roles. No real issuer, model transport, live migration or external Git write.
 * Scope, drafting and confirmed save execute on their fixed Temporal workflows.
 * This check does not claim real provider authority or signed-in UI acceptance. */
export async function testAuthenticatedGeneration({ admin, connect, check }: {
  admin: Pool; connect(role: string): Pool; check(name: string, run: () => Promise<void>): Promise<void>;
}, direction: AuthenticatedJourneyDirection = 'new-distinct', performanceOnly = false, profileRequests = false, recordsFeasibility = false, combinedFeasibility: false | 'separate' | 'graph' | 'native-graph' | 'owned-records' | 'owned-content' | 'owned-history' = false) {
  if (profileRequests && performanceOnly) throw new Error('Attribution overhead must not be mixed with performance acceptance.');
  if (recordsFeasibility && (profileRequests || performanceOnly)) throw new Error('Records feasibility must be an isolated test selection.');
  if (combinedFeasibility && !recordsFeasibility) throw new Error('Combined feasibility requires native records.');
  const itemId = authenticatedJourneyItem(direction);
  const name = performanceOnly ? `bounded authenticated ${direction} performance prefix preserves records and reports incomplete/failed benchmark honestly`
    : direction === 'new-distinct' ? 'concrete authenticated journey binds native multi-batch scope, both SDK roles, corrected confirmation and fixed save/reopen through restart'
    : `concrete authenticated ${direction} journey binds native multi-batch scope, both SDK roles, corrected confirmation and fixed save/reopen through restart`;
  await check(name, async () => {
    const cleanup: Array<() => void> = [];
    try {
    const performanceProbe = performanceOnly ? createIntentPerformanceProbe() : undefined;
    const native = nativeCandidateJourneyFixture({ after: run => cleanup.push(run) }, true, performanceProbe?.wrap);
    // Seed only this disposable scenario before identity/corpus snapshots. The
    // existing canonical Exam must survive, but must never enter either prompt.
    if (direction === 'first-amendment' || direction === 'proposal-continuation') native.git.add([
      { path: `items/${itemId}/EXAM.md`, content: '# Synthetic canonical Exam\nEXAM-MARKER-NOT-FOR-SCOPE\n' },
      { path: `items/${itemId}/.notes/preserved.md`, content: 'Synthetic existing context; preserve exact bytes. فارسی 🌸\n' },
    ]);
    const attribution = profileRequests ? createIdentityRequestProfile(native.git.transport) : undefined;
    const identityTraffic=createNativeRequestMeter(attribution?.transport ?? native.git.transport);
    const identity = await recordedRuntimeFixture({ after: run => cleanup.push(run) }, { source: {...native.git,transport:identityTraffic.transport},
      organizationId: `authenticated-generation-${randomUUID()}`,
      selection: { itemId: `items/${itemId}`, idempotencyKey: randomUUID() },
      actor: { type: 'human', subject: 'synthetic-human', authorizationPath: 'access/generation.json', toolGrants: [
        'intent.draft.read', 'intent.draft.append', 'intent.development.review', 'intent.scope.prepare', 'intent.scope.read',
        'intent.development.prepare', 'intent.development.read', 'intent.development.history',
        'intent.candidate.save.review', 'intent.candidate.save.preview', 'intent.candidate.save.prepare',
        'intent.candidate.save.start', 'intent.candidate.save.status', 'intent.candidate.read',
        'intent.scope.start', 'intent.development.start',
      ] } });
    // Extend only this disposable membership before any reviewed corpus snapshot;
    // each HTTP action still gets a freshly signed three-minute synthetic token.
    identity.publish({ ...identity.grant, expiresAt: new Date(Date.now() + 1200000).toISOString() });
    const pools: Pool[] = [], runtimes: Awaited<ReturnType<typeof createIdentityRuntime>>[] = [];
    const connection = (role: string) => { const pool = connect(role); pools.push(pool); return pool; };
    const f = await scopeDraftIntegrationFixture({ admin, connect: connection }, false, 3600000, { sourceCount: 32,
      organizationId: identity.grant.organizationId, branch: native.branch, repositoryEvidence: native.repositoryEvidence });
    let allowed = true, executionAllowed = true, constructions = 0, closures = 0, modelCalls = 0;
    const authority = async () => { if (!allowed) throw new Error('PRIVATE current records denied'); };
    const executionAuthority = async () => { await authority(); if (!executionAllowed) throw new Error('PRIVATE execution denied'); };
    const scopeRecords = { ...f.deps, authorize: authority, authorizeOriginal: authority,
      authorizeReview: executionAuthority, authorizeDraft: authority };
    const originalRecords = { authorize: authority, authorizeOriginal: authority, authorizeOperation: executionAuthority,
      authorizeDraft: authority, authorizeHistoricalRead: authority, keyForDraft: f.deps.keyForDraft };
    const results = { authorizeOperation: executionAuthority, authorizeDraft: authority, authorizeResult: authority,
      authorizeHistoricalResult: authority, keyForDraft: f.deps.keyForDraft };
    // Linking requires the reviewed target in the governed destination allowlist
    // as well as the distinct new item. These remain synthetic profile grants.
    const expected = { ...f.config, itemIds: direction === 'new-linked' ? [itemId, '0002-existing'] : [itemId] }, fixture = intentJourneyFactoryFixture(expected);
    fixture.config.scope = f.execution; fixture.config.scopeProfile = f.described.original.profile;
    fixture.config.development = { ...f.execution, action: 'develop' };
    // scopeTerms belong only to the scope execution schema.
    delete (fixture.config.development as Partial<typeof f.execution>).scopeTerms;
    fixture.config.candidate = { ...f.config, action: 'candidate-save', expiresAt: f.execution.expiresAt, budget: null };
    fixture.config.retrievalConfigurationRevision = 'synthetic-native-corpus-r1';
    const workflows = authenticatedModelWorkflows(executionAuthority);
    const candidate = authenticatedCandidateConfirmation(f, native, authority, scopeRecords, workflows,identityTraffic,direction);
    const save = authenticatedCandidateSave(f, native, fixture.config, authority,direction);
    const profiles = fixture.config.developmentProfiles;
    const { recordedScheduling: _unused, ...base } = identity.profile;
    const profile = { ...base, intentJourney: expected };
    let owned!: ManagedRuntimeIntentJourney;
    let historyFixture!: Parameters<typeof testOwnedDevelopmentHistoryProjection>[2];
    const make = async () => {
      const runtime = await createIdentityRuntime(profile, identity.secrets, { ...identity.ports,
        authorizeIntentJourney: authority,
        createIntentJourney: async () => {
          const deps = intentJourneyFactoryFixture(expected).deps;
          const drafts = connection('steer_draft_runtime'), execution = connection('steer_app'); constructions++;
          deps.resources = { pools: { drafts, execution }, reader: native.reader(f.config.organizationId),
            shutdown: async () => { await Promise.all([drafts.end(), execution.end()]); closures++; } };
          deps.drafts = { lifecycle: { authorize: authority }, revisions: { authorize: authority, keyForDraft: f.deps.keyForDraft } };
          deps.corpus = native.corpusAuthority;
          deps.scope.records = { originals: scopeRecords, authorize: authority };
          deps.scope.history = { originals: scopeRecords, authorize: authority, authorizeHistoricalRead: authority, authorizeHistoricalReview: authority };
          deps.scope.ownedReads = {
            current: ownedScopeReadFixture(f.execution.budget.budgetId, f.deps.keyForDraft, authority),
            history: ownedScopeReadFixture(f.execution.budget.budgetId, f.deps.keyForDraft, authority),
          };
          deps.scope.authorizePreparation = executionAuthority;
          deps.development.records = { originals: originalRecords, results, authorize: authority };
          deps.development.history = { originals: originalRecords, results, authorize: authority, authorizeHistoricalRead: authority };
          deps.development.ownedHistory = ownedDevelopmentReadFixture(f.execution.budget.budgetId, f.deps.keyForDraft, authority);
          deps.development.ownedCurrent = ownedDevelopmentOriginalFixture(f.execution.budget.budgetId, f.deps.keyForDraft, authority);
          historyFixture = { records: { ...deps.development.history }, profiles,
            ownedRead: { ...deps.development.ownedHistory, scope: { records: deps.scope.history,
              ownedRead: deps.scope.ownedReads.history, profile: fixture.config.scopeProfile } } };
          deps.development.authorizeReview = authority; deps.development.authorizePreparation = executionAuthority;
          candidate.configure(deps);
          save.configure(deps);
          workflows.configure(deps);
          owned = await createOwnedIntentJourney(expected, fixture.config, deps); return owned;
        } });
      runtimes.push(runtime); return runtime;
    };
    let runtime: Awaited<ReturnType<typeof createIdentityRuntime>>;
    const post = async (name: string, input: unknown) => {
      const trace = attribution?.begin(), identityBefore = identityTraffic.snapshot();
      try { return await runtime.fetch(new Request(`https://steer.example/v1/tools/${name}`, {
      method: 'POST', headers: { authorization: `Bearer ${await identity.issueBearer()}`, 'content-type': 'application/json' }, body: JSON.stringify(input),
      })); } finally {
        if (trace) {
          const profile = trace.finish(), counts = subtractNativeRequests(identityTraffic.snapshot(), identityBefore);
          assert.equal(profile.attempts, Object.values(counts).reduce((a,b) => a+b,0));
          assert.equal(profile.attempts, profile.groups.reduce((n,g) => n+g.attempts,0));
          console.log('Synthetic authenticated identity attribution: ' + JSON.stringify({ tool: name, counts, ...profile }));
        }
      }
    };
    const read = async (name: string, input: unknown) => { const start = performance.now(), before = native.git.calls.length, identityBefore = identityTraffic.snapshot();
      const response = await post(name, input);
      assert.equal(response.status, 200, JSON.stringify({ tool: name, ms: Math.round(performance.now() - start),
        nativeRequests: native.git.calls.length - before, identity: identity.counts(), response: await response.clone().text() }));
      if (name === 'intent.scope.start' || name === 'intent.development.start') console.log('Synthetic authenticated workflow start: ' + JSON.stringify({
        tool: name, ms: Math.round(performance.now() - start), nativeRequests: native.git.calls.length - before }));
      if (name === 'intent.development.prepare') {
        const requestKinds = summarizeNativeRequests(native.git.calls, before), identity = subtractNativeRequests(identityTraffic.snapshot(), identityBefore),
          repository = subtractNativeRequests(requestKinds, identity), nativeRequests = native.git.calls.length - before;
        assert.equal(Object.values(requestKinds).reduce((sum, count) => sum + count, 0), nativeRequests);
        console.log('Synthetic authenticated development preparation: ' + JSON.stringify({ tool: name, ms: Math.round(performance.now() - start),
          nativeRequests, requestKinds, origins: { identity, repository } }));
      }
      return response.json(); };
    const scope = { organizationId: f.config.organizationId, productId: f.config.productId, repository: f.config.repository };
    const source = { ...scope, draftId: f.draftId, revision: 1, revisionDigest: f.saved.reference.revisionDigest, scopeInputDigest: f.saved.reference.scopeInputDigest };
    const snapshot = async () => (await admin.query(`SELECT
      (SELECT count(*) FROM steer_execution.scope_review_runs WHERE organization_id=$1) AS scope_runs,
      (SELECT count(*) FROM steer_drafts.scope_review_originals WHERE organization_id=$1) AS scope_originals,
      (SELECT count(*) FROM steer_execution.intent_operations WHERE organization_id=$1) AS operations,
      (SELECT count(*) FROM steer_drafts.development_originals WHERE organization_id=$1) AS originals,
      (SELECT count(*) FROM steer_usage.model_reservations WHERE organization_id=$1) AS reservations`, [f.config.organizationId])).rows[0];
    try {
      runtime = await make();
      if (performanceProbe) {
        const before = await snapshot(), head = native.git.head();
        await testAuthenticatedPerformancePrefix({ probe: performanceProbe, source, content: f.content, direction, post,
          restart: async () => { await runtime.shutdown(); runtime = await make(); } });
        assert.deepEqual(await snapshot(), before); assert.equal(native.git.head(), head);
        assert.equal(modelCalls, 0); assert.equal(native.git.mutations(), 0);
        await runtime.shutdown(); assert.equal(constructions, 4); assert.equal(closures, 4);
        return;
      }
      const b = f.execution.budget, terms = f.execution.scopeTerms;
      await admin.query('INSERT INTO steer_usage.scope_review_terms VALUES($1,$2,$3,$4,$5,$6,$7,true)',
        [b.organizationId, b.budgetId, b.subject, b.configurationRevision, terms.approvalDigest, terms.profileDigest, terms.amountMicrousd]);
      const reviewed = await verifyDevelopmentReview(source, await read('intent.development.review', source));
      assert.equal(reviewed.output.evidence.documents.length, 34); assert.deepEqual(reviewed.output.evidence, f.described.original.evidence);
      const prepareInput = { ...source, configurationRevision: f.config.configurationRevision, sourceSnapshotDigest: reviewed.output.sourceSnapshotDigest };
      const scopePrepared = intentScopePrepareOutputSchema.parse(await read('intent.scope.prepare', prepareInput));
      assert.equal(scopePrepared.outcome, 'prepared'); assert.ok(scopePrepared.reference); assert.equal(scopePrepared.modelCallsStarted, 0);
      const beforeScope = await snapshot(); assert.equal(beforeScope.scope_runs, '1'); assert.equal(beforeScope.reservations, '0');
      assert.deepEqual(await read('intent.scope.prepare', prepareInput), scopePrepared); assert.deepEqual(await snapshot(), beforeScope);
      const prepared = await prepareIntentScopeReview(f.described.original.source.scope, reviewed.output.evidence, fixture.config.scopeProfile);
      const sample = await scopeReviewFixture(); assert.equal(prepared.batches.length, 2);
      {
        const worker = createScopeStepRuntime(f.pools, f.config, scopePrepared.reference!, {
          records: { originals: scopeRecords, authorize: authority }, profile: fixture.config.scopeProfile, authorize: executionAuthority,
          gateway: { gatewayUrl: 'http://127.0.0.1:4000/v1', gatewayKey: 'synthetic-unused', transport: async (_url, init) => {
            modelCalls++; const wire = JSON.parse(String(init?.body));
            const batch = prepared.batches.find(batch => batch.packet.request.source === wire.messages[1].content); assert.ok(batch);
            return Response.json({ id: 'synthetic-authenticated-scope', object: 'chat.completion', model: 'synthetic-model', choices: [{ index: 0,
              finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(sample.result(batch)) } }], usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } });
          } } });
        try { await workflows.run({ kind: 'scope', runtime: worker, batchIds: prepared.batches.map(batch => batch.metadata.batchId),
          input: { ...scope, ...scopePrepared.reference!, draftId: f.draftId, revision: 1, revisionDigest: source.revisionDigest },
          post, read, effects: snapshot, modelCalls: () => modelCalls }); }
        finally { worker.close(); }
      }
      const scopeOutput = await verifyIntentScopeReadOutput(await read('intent.scope.read', { ...scope, ...scopePrepared.reference! }));
      assert.equal(scopeOutput.status, 'review-available'); assert.equal(scopeOutput.semanticQualityVerified, false);
      const developmentInput = { ...prepareInput, choice: direction === 'new-distinct'
        ? { action: 'new-distinct' as const, reason: 'Explicit synthetic disposition; not a novelty verdict.' }
        : authenticatedJourneyChoice(direction, reviewed.output.evidence),
        scopeReview: { kind: 'recorded', ...scopePrepared.reference!, resultsDigest: scopeOutput.review!.resultsDigest },
        draftingContextDigest: (await buildIntentDevelopmentContext(reviewed.output.evidence)).contextDigest };
      const generated = intentDevelopmentPrepareOutputSchema.parse(await read('intent.development.prepare', developmentInput));
      assert.equal(generated.outcome, 'prepared'); assert.ok(generated.reference); assert.equal(generated.documentsReady, false);
      assert.deepEqual(await read('intent.development.prepare', developmentInput), generated);
      const reference = generated.reference!, records = { originals: { ...originalRecords, scopeReview: owned.services.intentScopeReader }, results, authorize: authority };
      const documents = { brief: '# Synthetic generated Brief\r\nBooking فارسی 🌸', spec: '# Synthetic generated Spec\nEmail only; never SMS.', exam: '# Synthetic generated Exam\nNOT RUN' };
      {
        const model = createRecordedDevelopmentModel(f.pools, f.config, reference, { records, authorize: executionAuthority,
          gateway: { gatewayUrl: 'http://127.0.0.1:4000/v1', gatewayKey: 'synthetic-unused', profiles, transport: async (_url, init) => {
            modelCalls++; const wire = JSON.parse(String(init?.body)), input = JSON.parse(wire.messages[1].content);
            const role = wire.messages[0].content === profiles.architect.instructions ? 'architect' : 'test-agent';
            assert.equal(wire.messages[0].content, role === 'architect' ? profiles.architect.instructions : profiles.testAgent.instructions);
            assert.equal(input.scopeEvidence.evidence.length, 34); assert.doesNotMatch(wire.messages[1].content, /EXAM-MARKER-NOT-FOR-SCOPE/);
            assert.deepEqual(input.direction.choice, developmentInput.choice);
            if (role === 'test-agent') { assert.equal(input.brief, documents.brief); assert.equal(input.spec, documents.spec);
              assert.doesNotMatch(wire.messages[1].content, /Drafted from the recorded source|Synthetic generated Exam/); }
            return Response.json({ id: 'synthetic-authenticated-development', object: 'chat.completion', model: 'synthetic-only', choices: [{ index: 0,
              finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(role === 'architect'
                ? { message: 'Drafted from the recorded source', questions: [], brief: documents.brief, spec: documents.spec } : { exam: documents.exam }) } }],
              usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } });
          } } });
        const worker = createDevelopmentStepRuntime(f.pools, f.config, reference, { reader: { originals: records.originals, results, authorizeRequest: authority },
          model, authorize: executionAuthority });
        try { await workflows.run({ kind: 'development', runtime: worker, closeModel: () => model.close(),
          input: { ...scope, ...reference, draftId: f.draftId, revision: 1, revisionDigest: source.revisionDigest },
          post, read, effects: snapshot, modelCalls: () => modelCalls }); }
        finally { worker.close(); model.close(); }
      }
      const target = { ...scope, ...reference }, output = intentDevelopmentReadOutputSchema.parse(await read('intent.development.read', target));
      assert.equal(output.status, 'candidates-ready'); assert.equal(output.results.length, 2); assert.equal(output.savedToGit, false);
      const architect = output.results[0]!.result, testAgent = output.results[1]!.result;
      assert.equal(architect.role, 'architect'); assert.equal(testAgent.role, 'test-agent');
      if (architect.role !== 'architect' || testAgent.role !== 'test-agent') throw new Error('Role order mismatch');
      assert.deepEqual({ brief: architect.output.brief, spec: architect.output.spec, exam: testAgent.output.exam }, documents);
      const complete = await snapshot(); assert.equal(complete.reservations, '4'); assert.equal(complete.operations, '1'); assert.equal(modelCalls, 4);
      if (!performanceOnly && !recordsFeasibility) await testOwnedDevelopmentStartClosure(f.pools, f.config, historyFixture, target);
      await runtime.shutdown(); runtime = await make();
      assert.deepEqual(await read('intent.development.read', target), output); assert.deepEqual(await snapshot(), complete);
      const correction = { ...f.content, documents: { ...documents, brief: documents.brief + '\r\nHuman correction: preserve exact words.' } };
      const append = await read('intent.draft.append', { ...scope, draftId: f.draftId, mutationId: randomUUID(), expectedRevision: 1,
        expectedDigest: source.revisionDigest, content: correction });
      assert.equal(append.outcome, 'acknowledged');
      executionAllowed = false;
      const retained = intentDevelopmentHistoryOutputSchema.parse(await read('intent.development.history', target));
      assert.equal(retained.status, 'complete'); assert.equal(retained.source.latestRevision, 2); assert.equal(retained.source.revision, 1);
      assert.equal(retained.results.length, 2); assert.equal(retained.results[1]!.predecessorResultDigest, retained.results[0]!.resultDigest);
      assert.doesNotMatch(JSON.stringify(retained), /scopeEvidence|instructions|EXAM-MARKER-NOT-FOR-SCOPE|requestBody|responseBody/);
      if (!performanceOnly && !recordsFeasibility) await testOwnedDevelopmentHistoryProjection(f.pools, f.config, historyFixture, target, retained);
      const exact = await read('intent.draft.read', { ...scope, draftId: f.draftId, revision: 'latest' }); assert.deepEqual(exact.content, correction);
      assert.equal((await post('intent.development.read', { ...target, productId: 'foreign' })).status, 403);
      allowed = false; const denied = await post('intent.development.history', target); assert.equal(denied.status, 503);
      assert.doesNotMatch(await denied.text(), /PRIVATE|Synthetic generated|Human correction/); allowed = true;
      identity.publish({ ...identity.grant, expiresAt: new Date(Date.now() + 1200000).toISOString(), toolGrants: [] }); assert.equal((await post('intent.development.history', target)).status, 403);
      assert.deepEqual(await snapshot(), complete); assert.equal(modelCalls, 4); assert.equal(native.git.mutations(), 0);
      console.log('PASS authenticated concrete factory: 34 native sources, two recorded scope batches, separate Brief/Spec and Exam roles, exact result restart, editable durable draft and historical lineage after correction; four synthetic calls/reservations, no Git save');
      // A long synthetic integration is not one perpetual session. Renew only
      // fixture membership before capturing the final Git snapshot and issue a
      // fresh short-lived signed bearer for each subsequent HTTP action.
      identity.publish({ ...identity.grant, expiresAt: new Date(Date.now() + 1200000).toISOString() });
      executionAllowed = true;
      const confirmed = await candidate.run({ admin, post, read, generation: reference,
        previousScope: { ...scopePrepared.reference!, resultsDigest: scopeOutput.review!.resultsDigest }, modelCall: () => { modelCalls++; }, modelCalls: () => modelCalls,
        restart: async () => { await runtime.shutdown(); runtime = await make(); } });
      assert.equal(modelCalls, 6); assert.equal(native.git.mutations(), 0);
      assert.deepEqual(workflows.completed, { scope: 2, development: 1 });
      await save.run({ admin, post, read, ...confirmed,
        restart: async () => { await runtime.shutdown(); runtime = await make(); },
        revokeReadGrant: () => identity.publish({ ...identity.grant, expiresAt: new Date(Date.now() + 1200000).toISOString(),
          toolGrants: identity.grant.toolGrants.filter(tool => tool !== 'intent.candidate.read') }) });
      assert.equal(modelCalls, 6); assert.equal(native.git.mutations(), 1);
      await runtime.shutdown(); assert.equal(constructions, 4); assert.equal(closures, 4);
      if (combinedFeasibility === 'owned-records' || combinedFeasibility === 'owned-content' || combinedFeasibility === 'owned-history') await testOwnedRecordsReadset(f, identity, profiles, { draftId: f.draftId,
        operationIds: [reference.operationId, confirmed.reference.operationId], reviewIds: [scopePrepared.reference!.reviewId, confirmed.scopeReference.reviewId],
        revisions: [1, 2], budgetId: f.execution.budget.budgetId }, authority, native, combinedFeasibility !== 'owned-records', combinedFeasibility === 'owned-history');
      else if (recordsFeasibility) await testRecordsReadsetFeasibility(f, identity, profiles, { draftId: f.draftId,
        operationIds: [reference.operationId, confirmed.reference.operationId], reviewIds: [scopePrepared.reference!.reviewId, confirmed.scopeReference.reviewId],
        revisions: [1, 2], budgetId: f.execution.budget.budgetId }, authority, combinedFeasibility ? native : undefined, combinedFeasibility || 'separate');
    } finally {
      try { await Promise.all(runtimes.map(value => value.shutdown())); }
      finally { f.drafts.close(); f.lifecycle.close(); f.key.bytes.fill(0); await Promise.all(pools.filter(pool => !pool.ending).map(pool => pool.end())); }
    }
    } finally { cleanup.forEach(run => run()); }
  });
}
