import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import type { scopeStepIntegrationFixture } from '../../worker/test/scope-step-runtime.integration.ts';
import { createIntentDraftService } from '@steer/data/intent-draft-service';
import { createIntentDevelopmentReviewer } from '@steer/data/intent-development-reviewer';
import { createRecordedCandidateSaveReviewer, createRecordedCandidateSavePreviewer, createVerifiedDevelopmentHistoryReader } from '../src/runtime.ts';
import { createApi } from '../src/app.ts';
import { verifyCandidateSavePreview } from '@steer/tool-registry/candidate-save-preview-contracts';
import { testCandidateConfirmationWithHistory } from './candidate-save-prepare.integration.ts';
import type { nativeCandidateJourneyFixture } from './native-candidate-journey.fixture.ts';
import type { CandidateSaveReviewInput } from '@steer/tool-registry/candidate-save-review-contracts';
import { candidateSavePreviewInputSchema, type CandidateSavePreviewInput } from '@steer/tool-registry/candidate-save-preview-contracts';
import { testConfirmedNativeCandidateSave } from '../../worker/test/native-candidate-save.integration.ts';

type Fixture = Awaited<ReturnType<typeof scopeStepIntegrationFixture>>;
/** Composed inside the actual SQL + 34-source SDK journey. All authorities and
 * provider responses are synthetic; this is not a live-user acceptance result. */
export async function testCandidateSavePreviewWithHistory(f: Fixture,
  reference: { operationId: string; inputDigest: string },
  deps: Parameters<typeof createVerifiedDevelopmentHistoryReader>[2],
  scopeReader: NonNullable<Parameters<typeof createRecordedCandidateSaveReviewer>[1]['scopeReview']>, admin: Pool,
  native: ReturnType<typeof nativeCandidateJourneyFixture>, save=false) {
  let allowed = true, changing = false, reads = 0, generationAllowed = true;
  const drafts = createIntentDraftService(f.pools.drafts, f.config, { lifecycle: { authorize: async () => {} },
    revisions: { authorize: f.deps.records.originals.authorizeDraft, keyForDraft: f.deps.records.originals.keyForDraft } });
  const sources = createIntentDevelopmentReviewer(f.config, { drafts, evidenceFor: async () => f.described.original.evidence, authorizeReview: async () => {} });
  const review = createRecordedCandidateSaveReviewer(f.config, { drafts, sources, scopeReview: scopeReader, authorizeReview: async () => {} });
  const records = { ...deps.records, results: { ...deps.records.results, authorizeHistoricalResult: async () => {
    if (!generationAllowed) throw new Error('PRIVATE historical result denial');
  } } };
  const history = createVerifiedDevelopmentHistoryReader(f.pools, f.config, { ...deps, records });
  const resolved = native.destination(f.config);
  const destination = { scope: resolved.scope, resolve: async (...args: Parameters<typeof resolved.resolve>) => {
    if(changing&&++reads===2)native.state.policyRevision='synthetic-policy-r2';
    return resolved.resolve(...args);
  } };
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
    const post = (selected:CandidateSavePreviewInput=input) => app.request('/v1/tools/intent.candidate.save.preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(selected) });
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
    assert.equal(output.destination.expectedHead,native.git.head());
    for(const variant of (save?[]:['linked','linked-candidate','revision','first-amendment','continuation']) as Array<'linked'|'linked-candidate'|'revision'|'first-amendment'|'continuation'>){
      const linked=variant==='linked'||variant==='linked-candidate';
      const item=variant==='revision'||variant==='linked-candidate'?'0002-existing':variant==='continuation'?'0001-existing':'0003-existing';
      const target=f.described.original.evidence.inventory.find(s=>s.targetId===`items/${item}`&&s.path.endsWith('/BRIEF.md')&&s.status!=='amendment')!;
      const choice:CandidateSaveReviewInput['choice']={action:linked?'new-linked':'extend-existing',reason:'Explicit synthetic disposition of assessed scope.',
        target:{path:target.path,revision:native.git.head(),contentDigest:target.contentDigest}};
      const variantInput={...reviewInput,choice},variantReview=await review.review(variantInput,async()=>{});
      const request=candidateSavePreviewInputSchema.parse({...input,...variantInput,reviewDigest:variantReview.reviewDigest,
        itemId:linked?input.itemId:item,proposalId:variant==='continuation'?native.proposalId:null});
      const response=await post(request);assert.equal(response.status,200,`${variant}: ${await response.clone().text()}`);
      const result=await verifyCandidateSavePreview(request,await response.json(),f.content.documents);
      assert.deepEqual(result.generation,output.generation);assert.equal(result.saveConfirmed,false);assert.equal(result.savedToGit,false);
      if(linked)assert.deepEqual(result.destination.relationship,{itemId:item,revision:native.git.head()});
      else if(variant==='revision'){assert.equal(result.destination.purpose,'candidate-revision');assert.equal(result.destination.previousBundleDigest,native.parents().priorManifest);}
      else {
        assert.equal(result.destination.purpose,'amendment');assert.equal(result.destination.amendment!.target.revision,
          variant==='continuation'?native.parents().originalTarget:native.git.head());
        if(variant==='continuation'){
          assert.equal(result.destination.previousBundleDigest,native.parents().proposalManifest);
          assert.equal(result.destination.amendment!.parentProposalDigest,native.parents().pointerDigest);
          assert.notEqual(result.destination.amendment!.target.revision,result.review.expectedHead);
          native.state.continuationAllowed=false;assert.equal((await post(request)).status,503);native.state.continuationAllowed=true;
        }
      }
      native.state.sourceAllowed=false;assert.equal((await post(request)).status,503);native.state.sourceAllowed=true;
    }
    changing = true; assert.equal((await post()).status, 503); changing = false;native.state.policyRevision='synthetic-policy-r1';
    native.state.allowed=false;assert.equal((await post()).status,503);native.state.allowed=true;
    generationAllowed = false; const denied = await post(); assert.equal(denied.status, 503); assert.doesNotMatch(await denied.text(), /PRIVATE|manifestDigest/);
    generationAllowed = true; allowed = false; assert.equal((await post()).status, 503); allowed = true;
    principal.toolGrants = []; assert.equal((await post()).status, 403);
    assert.equal(await f.reservations(), reservations);
    assert.deepEqual(await snapshot(), before);
    console.log(save?'PASS composed native-Git save journey preview: exact corpus/draft/SDK lineage and current policy/result/grant denial; no admission or model calls'
      :'PASS composed native-Git candidate preview: six cases across five directions, exact corpus/draft/SDK lineage, original proposal target, current policy/source/result/grant denial; no admission or model calls');
    const confirmedOriginal=await testCandidateConfirmationWithHistory(f, drafts, service, output, admin);
    principal.toolGrants=['intent.candidate.save.preview'];
    // The expanded matrix can outlive the original synthetic session. Establish
    // a fresh test identity for this independent race; do not relax API expiry.
    principal.expiresAt=new Date(Date.now()+300000).toISOString();
    if(save){
      await testConfirmedNativeCandidateSave(f,drafts,confirmedOriginal,native,admin);
      principal.expiresAt=new Date(Date.now()+300000).toISOString();
      const saved=await snapshot();assert.equal((await post()).status,503);
      assert.deepEqual(await snapshot(),saved);assert.equal(await f.reservations(),reservations);
      assert.equal(native.git.mutations(),1);
      return;
    }
    const confirmed=await snapshot();native.state.moveAtProof=native.state.proofs+2;
    assert.equal((await post()).status,503);assert.notEqual(native.git.head(),output.review.expectedHead);
    assert.deepEqual(await snapshot(),confirmed);assert.equal(await f.reservations(),reservations);
    assert.equal(native.git.mutations(),0);assert.equal(native.git.approvals(),0);
    assert.ok(native.git.calls.every(c=>c.method==='GET'||c.path==='/app/installations/1/access_tokens'));
  } finally { service.close(); resolved.close(); history.close(); review.close(); sources.close(); drafts.close(); }
}
