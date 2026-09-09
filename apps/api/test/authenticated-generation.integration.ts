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
import { createNativeRequestMeter } from './native-request-metrics.ts';

/** Signed synthetic JWT + native Git grants, real API constructor graph, SQL and
 * recorded SDK roles. No real issuer, model transport, live migration or external Git write.
 * Scope, drafting and confirmed save execute on their fixed Temporal workflows.
 * This check does not claim real provider authority or signed-in UI acceptance. */
export async function testAuthenticatedGeneration({ admin, connect, check }: {
  admin: Pool; connect(role: string): Pool; check(name: string, run: () => Promise<void>): Promise<void>;
}) {
  await check('concrete authenticated journey binds native multi-batch scope, both SDK roles, corrected confirmation and fixed save/reopen through restart', async () => {
    const cleanup: Array<() => void> = [];
    try {
    const native = nativeCandidateJourneyFixture({ after: run => cleanup.push(run) }, true);
    const identityTraffic=createNativeRequestMeter(native.git.transport);
    const identity = await recordedRuntimeFixture({ after: run => cleanup.push(run) }, { source: {...native.git,transport:identityTraffic.transport},
      organizationId: `authenticated-generation-${randomUUID()}`,
      selection: { itemId: 'items/0273-synthetic', idempotencyKey: randomUUID() },
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
    const expected = { ...f.config, itemIds: ['0273-synthetic'] }, fixture = intentJourneyFactoryFixture(expected);
    fixture.config.scope = f.execution; fixture.config.scopeProfile = f.described.original.profile;
    fixture.config.development = { ...f.execution, action: 'develop' };
    // scopeTerms belong only to the scope execution schema.
    delete (fixture.config.development as Partial<typeof f.execution>).scopeTerms;
    fixture.config.candidate = { ...f.config, action: 'candidate-save', expiresAt: f.execution.expiresAt, budget: null };
    fixture.config.retrievalConfigurationRevision = 'synthetic-native-corpus-r1';
    const workflows = authenticatedModelWorkflows(executionAuthority);
    const candidate = authenticatedCandidateConfirmation(f, native, authority, scopeRecords, workflows,identityTraffic);
    const save = authenticatedCandidateSave(f, native, fixture.config, authority);
    const profiles = fixture.config.developmentProfiles;
    const { recordedScheduling: _unused, ...base } = identity.profile;
    const profile = { ...base, intentJourney: expected };
    let owned!: ManagedRuntimeIntentJourney;
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
          deps.scope.authorizePreparation = executionAuthority;
          deps.development.records = { originals: originalRecords, results, authorize: authority };
          deps.development.history = { originals: originalRecords, results, authorize: authority, authorizeHistoricalRead: authority };
          deps.development.authorizeReview = authority; deps.development.authorizePreparation = executionAuthority;
          candidate.configure(deps);
          save.configure(deps);
          workflows.configure(deps);
          owned = await createOwnedIntentJourney(expected, fixture.config, deps); return owned;
        } });
      runtimes.push(runtime); return runtime;
    };
    let runtime: Awaited<ReturnType<typeof createIdentityRuntime>>;
    const post = async (name: string, input: unknown) => runtime.fetch(new Request(`https://steer.example/v1/tools/${name}`, {
      method: 'POST', headers: { authorization: `Bearer ${await identity.issueBearer()}`, 'content-type': 'application/json' }, body: JSON.stringify(input),
    }));
    const read = async (name: string, input: unknown) => { const start = performance.now(), before = native.git.calls.length;
      const response = await post(name, input);
      assert.equal(response.status, 200, JSON.stringify({ tool: name, ms: Math.round(performance.now() - start),
        nativeRequests: native.git.calls.length - before, identity: identity.counts(), response: await response.clone().text() }));
      if (name === 'intent.scope.start' || name === 'intent.development.start') console.log('Synthetic authenticated workflow start: ' + JSON.stringify({
        tool: name, ms: Math.round(performance.now() - start), nativeRequests: native.git.calls.length - before }));
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
      const developmentInput = { ...prepareInput, choice: { action: 'new-distinct', reason: 'Explicit synthetic disposition; not a novelty verdict.' },
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
    } finally {
      try { await Promise.all(runtimes.map(value => value.shutdown())); }
      finally { f.drafts.close(); f.lifecycle.close(); f.key.bytes.fill(0); await Promise.all(pools.filter(pool => !pool.ending).map(pool => pool.end())); }
    }
    } finally { cleanup.forEach(run => run()); }
  });
}
