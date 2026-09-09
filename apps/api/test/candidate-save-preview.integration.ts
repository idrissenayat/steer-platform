import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import type { scopeStepIntegrationFixture } from '../../worker/test/scope-step-runtime.integration.ts';
import { createIntentDraftService } from '@steer/data/intent-draft-service';
import { createIntentDevelopmentReviewer } from '@steer/data/intent-development-reviewer';
import { createRecordedCandidateSaveReviewer, createRecordedCandidateSavePreviewer, createVerifiedDevelopmentHistoryReader } from '../src/runtime.ts';
import { createApi } from '../src/app.ts';
import { verifyCandidateSavePreview } from '@steer/tool-registry/candidate-save-preview-contracts';
import { testCandidateConfirmationWithHistory } from './candidate-save-prepare.integration.ts';

type Fixture = Awaited<ReturnType<typeof scopeStepIntegrationFixture>>;
/** Composed inside the actual SQL + 34-source SDK journey. All authorities and
 * provider responses are synthetic; this is not a live-user acceptance result. */
export async function testCandidateSavePreviewWithHistory(f: Fixture,
  reference: { operationId: string; inputDigest: string },
  deps: Parameters<typeof createVerifiedDevelopmentHistoryReader>[2],
  scopeReader: NonNullable<Parameters<typeof createRecordedCandidateSaveReviewer>[1]['scopeReview']>, admin: Pool) {
  let allowed = true, moving = false, reads = 0, generationAllowed = true;
  const drafts = createIntentDraftService(f.pools.drafts, f.config, { lifecycle: { authorize: async () => {} },
    revisions: { authorize: f.deps.records.originals.authorizeDraft, keyForDraft: f.deps.records.originals.keyForDraft } });
  const sources = createIntentDevelopmentReviewer(f.config, { drafts, evidenceFor: async () => f.described.original.evidence, authorizeReview: async () => {} });
  const review = createRecordedCandidateSaveReviewer(f.config, { drafts, sources, scopeReview: scopeReader, authorizeReview: async () => {} });
  const records = { ...deps.records, results: { ...deps.records.results, authorizeHistoricalResult: async () => {
    if (!generationAllowed) throw new Error('PRIVATE historical result denial');
  } } };
  const history = createVerifiedDevelopmentHistoryReader(f.pools, f.config, { ...deps, records });
  const destination = { scope: review.scope, resolve: async () => ({ organizationId: f.config.organizationId, productId: f.config.productId,
    repository: f.config.repository, branch: f.config.branch, itemId: '0260-booking', expectedHead: moving && ++reads === 2 ? 'f'.repeat(40) : f.described.original.evidence.head,
    purpose: 'new-candidate', previousBundleDigest: null, amendment: null, relationship: null, lifecycle: 'absent-item', authorityDigest: 'a'.repeat(64) }) };
  const service = createRecordedCandidateSavePreviewer(f.pools, { ...f.config, serviceCommitter: 'app:synthetic' },
    { drafts, review, history, originals: records.originals, destination, authorizePreview: async () => { if (!allowed) throw new Error('PRIVATE preview denial'); } });
  try {
    const source = { organizationId: f.config.organizationId, productId: f.config.productId, repository: f.config.repository,
      draftId: f.draftId, revision: 1, revisionDigest: f.saved.reference.revisionDigest, scopeInputDigest: f.saved.reference.scopeInputDigest };
    const selected = await f.read(), evidence = await sources.review(source, async () => {});
    const reviewInput = { ...source, configurationRevision: f.config.configurationRevision, sourceSnapshotDigest: evidence.sourceSnapshotDigest,
      choice: { action: 'new-distinct' as const, reason: 'Booking is separate from the assessed existing corpus.' },
      scopeReview: { kind: 'recorded' as const, ...f.target, resultsDigest: selected.review!.resultsDigest } };
    const reviewed = await review.review(reviewInput, async () => {});
    const input = { ...reviewInput, reviewDigest: reviewed.reviewDigest, generation: reference, itemId: '0260-booking', proposalId: null };
    const principal = { organizationId: f.config.organizationId, subject: f.config.subject, type: 'human', hats: [],
      toolGrants: ['intent.candidate.save.preview'], expiresAt: new Date(Date.now() + 300000).toISOString() };
    const app = createApi({ authenticate: async () => principal, services: { candidateSavePreviewer: service } });
    const post = () => app.request('/v1/tools/intent.candidate.save.preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
    const snapshot = async () => (await admin.query(`SELECT
      (SELECT count(*) FROM steer_execution.intent_operations WHERE organization_id=$1) AS operations,
      (SELECT count(*) FROM steer_execution.intent_steps WHERE organization_id=$1) AS steps,
      (SELECT count(*) FROM steer_drafts.candidate_originals WHERE organization_id=$1) AS saves,
      (SELECT count(*) FROM steer_drafts.draft_revisions WHERE organization_id=$1) AS revisions`, [f.config.organizationId])).rows[0];
    const before = await snapshot(), reservations = await f.reservations(), response = await post();
    assert.equal(response.status, 200, await response.clone().text()); assert.equal(response.headers.get('cache-control'), 'no-store');
    const output = await verifyCandidateSavePreview(input, await response.json(), f.content.documents);
    assert.equal(output.generation.architect.configurationRevision, deps.profiles.architect.profileRevision);
    assert.equal(output.generation.testAgent.configurationRevision, deps.profiles.testAgent.profileRevision);
    assert.deepEqual(output.manifest.lineage.editedDocuments, ['brief', 'exam', 'spec']);
    assert.equal(output.manifest.specConformance.state, 'stale'); assert.equal(output.manifest.examReview.state, 'stale');
    assert.deepEqual(await (await post()).json(), output);
    assert.doesNotMatch(JSON.stringify(output), /EXAM-MARKER-NOT-FOR-SCOPE|# Assessed Brief|scopeEvidence|instructions|requestBody|responseBody/);
    moving = true; assert.equal((await post()).status, 503); moving = false;
    generationAllowed = false; const denied = await post(); assert.equal(denied.status, 503); assert.doesNotMatch(await denied.text(), /PRIVATE|manifestDigest/);
    generationAllowed = true; allowed = false; assert.equal((await post()).status, 503); allowed = true;
    principal.toolGrants = []; assert.equal((await post()).status, 403);
    assert.equal(await f.reservations(), reservations);
    assert.deepEqual(await snapshot(), before);
    console.log('PASS composed candidate preview: exact preserved bytes, both retained SDK roles, reproducibility and late destination/result/grant denial; no admission or model calls');
    await testCandidateConfirmationWithHistory(f, drafts, service, output, admin);
  } finally { service.close(); history.close(); review.close(); sources.close(); drafts.close(); }
}
