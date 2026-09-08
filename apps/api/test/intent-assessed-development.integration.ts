import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { scopeStepIntegrationFixture } from '../../worker/test/scope-step-runtime.integration.ts';
import { buildIntentEvidenceEnvelope } from '@steer/tool-registry/intent-evidence-contracts';
import { planIntentScopeBatches } from '@steer/tool-registry/intent-scope-batches';
import { createDevelopmentOriginalStore } from '@steer/data/development-originals';
import { describeDevelopmentOriginal } from '@steer/data/development-original-contracts';
import { renderDevelopmentRequest, createDevelopmentRequestReader } from '@steer/data/development-requests';
import { originalFixture } from '../../../packages/data/test/development-original.fixture.ts';
import { createAssessedRecordedDevelopmentPreparer, createVerifiedScopeReviewReader, createRecordedDevelopmentStarter } from '../src/runtime.ts';
import { createApi } from '../src/app.ts';

type Fixture = Awaited<ReturnType<typeof scopeStepIntegrationFixture>>;
type Dependencies = Parameters<typeof createAssessedRecordedDevelopmentPreparer>[3];
async function assessedApi(f: Fixture, evidence = f.described.original.evidence, patch: Partial<Dependencies> = {}) {
  const execution = { ...f.config, action: 'develop', expiresAt: f.execution.expiresAt, budget: f.execution.budget };
  const baseline = await originalFixture(execution, { draftId: f.draftId, revision: 1, sourceRevision: 1,
    revisionDigest: f.saved.reference.revisionDigest, content: f.content });
  const records: Dependencies['records'] = { authorize: async () => {}, authorizeOriginal: async () => {}, authorizeOperation: async () => {},
    authorizeDraft: f.deps.records.originals.authorizeDraft, keyForDraft: f.deps.records.originals.keyForDraft };
  const scope = { records: f.deps.records, profile: f.deps.profile };
  const service = createAssessedRecordedDevelopmentPreparer(f.pools, execution, baseline.original.profiles, {
    records, scope, evidenceFor: async () => evidence, authorizePreparation: async () => {}, ...patch });
  const principal = { organizationId: f.config.organizationId, subject: f.config.subject, type: 'human', hats: [],
    toolGrants: ['intent.development.prepare'], expiresAt: new Date(Date.now() + 300000).toISOString() };
  const app = createApi({ authenticate: async () => principal, services: { intentDevelopmentPreparer: service } });
  const input = { organizationId: f.config.organizationId, productId: f.config.productId, repository: f.config.repository,
    configurationRevision: f.config.configurationRevision, draftId: f.draftId, revision: 1, revisionDigest: f.saved.reference.revisionDigest,
    scopeInputDigest: f.saved.reference.scopeInputDigest, sourceSnapshotDigest: (await buildIntentEvidenceEnvelope(evidence)).sourceSnapshotDigest,
    choice: baseline.original.direction.choice };
  const post = (scopeReview?: unknown) => app.fetch(new Request('https://steer.example/v1/tools/intent.development.prepare', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input, ...(scopeReview ? { scopeReview } : {}) }) }));
  return { service, post, records, scope, input, baseline };
}
const selection = (f: Fixture, review: Awaited<ReturnType<Fixture['read']>>) => ({ kind: 'recorded', ...f.target, resultsDigest: review.review!.resultsDigest });

export async function testAssessedDevelopment(setup: (count?: number, ttl?: number) => Promise<Fixture>,
  check: (name: string, run: () => Promise<void>) => Promise<void>, admin: Pool) {
  await check('assessed HTTP preparation binds actual recorded SDK/SQL findings, retries one immutable input and renders both fresh roles without prior Exam', async () => {
    const f = await setup(); assert.equal((await f.run()).outcome, 'succeeded'); const review = await f.read(), selected = selection(f, review), a = await assessedApi(f);
    const reader = createVerifiedScopeReviewReader(f.pools, f.config, a.scope);
    const originals = createDevelopmentOriginalStore(f.pools, f.config, { ...a.records, scopeReview: reader });
    try {
      const response = await a.post(selected); assert.equal(response.status, 200); const prepared = await response.json();
      assert.equal(prepared.outcome, 'prepared'); assert.ok(prepared.reference);
      const again = await (await a.post(selected)).json(); assert.deepEqual(again, prepared);
      const original = (await originals.read(prepared.reference)).original;
      assert.deepEqual(original.direction.scopeReview, { kind: 'recorded', ...f.target, results: review.review });
      assert.deepEqual(original.source.content, f.content); assert.deepEqual(original.direction.choice, a.input.choice);
      const { scopeReview: _review, ...legacyDirection } = original.direction;
      assert.notEqual((await describeDevelopmentOriginal({ ...original, direction: legacyDirection })).inputDigest, prepared.reference.inputDigest);
      const architect = await renderDevelopmentRequest({ original, operationId: prepared.reference.operationId, role: 'architect', predecessor: null });
      const context = JSON.parse(architect.rendered.request.source); assert.deepEqual(context.direction, original.direction);
      const predecessor = { checkpoint: { binding: { organizationId: f.config.organizationId, subject: f.config.subject,
        operationId: prepared.reference.operationId, stepId: 'architect', draftId: f.draftId, draftRevision: 1,
        inputDigest: architect.stepReference.stepInputDigest, configurationRevision: f.config.configurationRevision },
        resultRef: randomUUID(), resultDigest: 'd'.repeat(64), recordsPolicyDigest: f.config.recordsPolicyDigest },
        result: { role: 'architect', output: { message: 'ARCHITECT-PRIVATE-MESSAGE', questions: [], brief: '# Synthetic Brief', spec: '# Synthetic Spec' } } };
      const examiner = await renderDevelopmentRequest({ original, operationId: prepared.reference.operationId, role: 'test-agent', predecessor });
      assert.deepEqual(JSON.parse(examiner.rendered.request.source).direction, original.direction);
      assert.doesNotMatch(architect.rendered.request.source + examiner.rendered.request.source, /EXAM-MARKER-NOT-FOR-SCOPE|ARCHITECT-PRIVATE-MESSAGE/);
      assert.equal(f.state.calls, 1); assert.equal(await f.reservations(), 1);
      assert.equal(Number((await admin.query('SELECT count(*) AS n FROM steer_drafts.development_originals WHERE organization_id=$1', [f.config.organizationId])).rows[0].n), 1);
      const noReader = createDevelopmentOriginalStore(f.pools, f.config, a.records);
      try { await assert.rejects(noReader.read(prepared.reference)); } finally { noReader.close(); }
      await f.edit(); await assert.rejects(originals.read(prepared.reference));
    } finally { originals.close(); reader.close(); a.service.close(); }
  });
  await check('assessed admission rejects omitted references, caller findings, pending review and substituted results before creating development records', async () => {
    const f = await setup(), a = await assessedApi(f);
    try {
      assert.notEqual((await a.post()).status, 200);
      const selected = { kind: 'recorded', ...f.target, resultsDigest: 'd'.repeat(64) };
      assert.notEqual((await a.post({ ...selected, findings: [] })).status, 200);
      assert.equal((await (await a.post(selected)).json()).outcome, 'unavailable');
      assert.equal((await f.run()).outcome, 'succeeded');
      assert.equal((await (await a.post(selected)).json()).outcome, 'unavailable');
      assert.equal(Number((await admin.query('SELECT count(*) AS n FROM steer_execution.intent_operations WHERE organization_id=$1', [f.config.organizationId])).rows[0].n), 0);
    } finally { a.service.close(); }
  });
  await check('assessed preparation and restored input require current pinned profile and scope source permissions', async () => {
    const f = await setup(); assert.equal((await f.run()).outcome, 'succeeded'); const selected = selection(f, await f.read());
    let allowed = true;
    const scope = { profile: f.deps.profile, records: { ...f.deps.records, authorize: async () => { if (!allowed) throw new Error('Private revocation'); } } };
    const a = await assessedApi(f, f.described.original.evidence, { scope });
    const reader = createVerifiedScopeReviewReader(f.pools, f.config, scope), originals = createDevelopmentOriginalStore(f.pools, f.config, { ...a.records, scopeReview: reader });
    try {
      const prepared = await (await a.post(selected)).json(); assert.equal(prepared.outcome, 'prepared');
      allowed = false; await assert.rejects(originals.read(prepared.reference));
      assert.equal((await (await a.post(selected)).json()).outcome, 'unavailable');
      allowed = true;
      const wrong = await assessedApi(f, f.described.original.evidence, { scope: { ...scope, profile: { ...f.described.original.profile, modelRoute: 'different' } } });
      try { assert.equal((await (await wrong.post(selected)).json()).outcome, 'unavailable'); } finally { wrong.service.close(); }
      assert.equal(f.state.calls, 1); assert.equal(await f.reservations(), 1);
    } finally { originals.close(); reader.close(); a.service.close(); }
  });
  await check('explicit complete empty corpus prepares without a scope model call but incomplete inventory remains blocked', async () => {
    const f = await setup(), evidence = { ...f.described.original.evidence, inventory: [], documents: [] }, a = await assessedApi(f, evidence);
    const selected = { kind: 'empty-corpus', planDigest: (await planIntentScopeBatches(evidence)).summary.planDigest };
    try { const prepared = await (await a.post(selected)).json(); assert.equal(prepared.outcome, 'prepared');
      const originals = createDevelopmentOriginalStore(f.pools, f.config, a.records);
      try { assert.deepEqual((await originals.read(prepared.reference)).original.direction.scopeReview, selected); } finally { originals.close(); }
      assert.equal(f.state.calls, 0); assert.equal(await f.reservations(), 0);
    } finally { a.service.close(); }
    const incomplete = await assessedApi(f, { ...evidence, inventoryComplete: false });
    try { assert.equal((await (await incomplete.post(selected)).json()).outcome, 'scope-incomplete'); } finally { incomplete.service.close(); }
  });
  await check('completed batched scope assessment does not bypass legacy generation coverage limits', async () => {
    const f = await setup(34); assert.equal((await f.run(0)).outcome, 'succeeded'); assert.equal((await f.run(1)).outcome, 'succeeded');
    const review = await f.read(); assert.equal(review.status, 'review-available'); const a = await assessedApi(f);
    try { assert.equal((await (await a.post(selection(f, review))).json()).outcome, 'scope-incomplete');
      assert.equal(f.state.calls, 2); assert.equal(await f.reservations(), 2);
    } finally { a.service.close(); }
  });
  await check('assessed start and worker request reconstruction revalidate scope evidence; missing reader or later revocation cannot schedule or release context', async () => {
    const f = await setup(); assert.equal((await f.run()).outcome, 'succeeded'); const selected = selection(f, await f.read()), a = await assessedApi(f);
    let allowed = true, schedules = 0;
    const scope = createVerifiedScopeReviewReader(f.pools, f.config, { ...a.scope, records: { ...a.scope.records,
      authorize: async () => { if (!allowed) throw new Error('Private source revocation'); } } });
    const records = { ...a.records, scopeReview: scope }, scheduler = { start: async (_target: unknown, current: () => Promise<void>) => {
      await current(); schedules++; return { outcome: 'unknown' }; } };
    const starter = createRecordedDevelopmentStarter(f.pools, f.config, { records, scheduler, authorizeStart: async () => {} });
    const missing = createRecordedDevelopmentStarter(f.pools, f.config, { records: a.records, scheduler, authorizeStart: async () => {} });
    const requests = createDevelopmentRequestReader(f.pools, f.config, { originals: records,
      results: { ...a.records, authorizeResult: async () => {} }, authorizeRequest: async () => {} });
    try {
      const prepared = await (await a.post(selected)).json(); assert.equal(prepared.outcome, 'prepared');
      const input = { organizationId: f.config.organizationId, productId: f.config.productId, repository: f.config.repository,
        ...prepared.reference, draftId: f.draftId, revision: 1, revisionDigest: f.saved.reference.revisionDigest };
      await assert.rejects(missing.start(input, async () => {})); assert.equal(schedules, 0);
      assert.equal((await starter.start(input, async () => {})).receipt.outcome, 'unknown'); assert.equal(schedules, 1);
      const request = await requests.read({ ...prepared.reference, role: 'architect' });
      assert.equal(JSON.parse(request.rendered.request.source).direction.scopeReview.results.resultsDigest, selected.resultsDigest);
      allowed = false; await assert.rejects(requests.read({ ...prepared.reference, role: 'architect' }));
      await assert.rejects(starter.start(input, async () => {})); assert.equal(schedules, 1); assert.equal(await f.reservations(), 1);
    } finally { requests.close(); missing.close(); starter.close(); scope.close(); a.service.close(); }
  });
}
