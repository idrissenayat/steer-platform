import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import type { scopeDraftIntegrationFixture } from '../../../packages/data/test/scope-originals.integration.ts';
import type { nativeCandidateJourneyFixture } from './native-candidate-journey.fixture.ts';
import type { IntentJourneyFactoryDependencies } from '../src/runtime.ts';
import { intentDraftReadOutputSchema } from '@steer/tool-registry/intent-draft-contracts';
import { verifyDevelopmentReview } from '@steer/tool-registry/intent-development-review-contracts';
import { intentScopePrepareOutputSchema } from '@steer/tool-registry/intent-scope-prepare-contracts';
import { verifyIntentScopeReadOutput } from '@steer/tool-registry/intent-scope-read-contracts';
import { prepareIntentScopeReview } from '@steer/tool-registry/intent-scope-review';
import { verifyCandidateSaveReview } from '@steer/tool-registry/candidate-save-review-contracts';
import { verifyCandidateSavePreview } from '@steer/tool-registry/candidate-save-preview-contracts';
import { verifyCandidateSavePrepare } from '@steer/tool-registry/candidate-save-prepare-contracts';
import { scopeReviewFixture } from '../../../packages/tool-registry/test/intent-scope-review.fixture.ts';
import { createScopeStepRuntime } from '../../worker/src/scope-step-runtime.ts';
import type { authenticatedModelWorkflows } from '../../worker/test/authenticated-model-workflows.integration.ts';
import { summarizeNativeRequests,subtractNativeRequests,type createNativeRequestMeter } from './native-request-metrics.ts';
import { authenticatedJourneyChoice, authenticatedJourneyItem, type AuthenticatedJourneyDirection } from './authenticated-journey-direction.fixture.ts';

type Fixture = Awaited<ReturnType<typeof scopeDraftIntegrationFixture>>;
/** Continue the SAME signed-identity/SQL/recorded-generation test after correction.
 * Only synthetic candidate review/confirmation policies are enabled. The complete
 * production factory still constructs the services; no service result is injected.
 * Candidate-save scheduling, Git writing and publication remain unavailable. */
export function authenticatedCandidateConfirmation(f: Fixture, native: ReturnType<typeof nativeCandidateJourneyFixture>,
  authority: () => Promise<void>, scopeRecords: IntentJourneyFactoryDependencies['scope']['records']['originals'],
  workflows: ReturnType<typeof authenticatedModelWorkflows>,identityTraffic:ReturnType<typeof createNativeRequestMeter>, direction: AuthenticatedJourneyDirection = 'new-distinct') {
  let enabled = false;
  const current = async () => { await authority(); if (!enabled) throw new Error('PRIVATE candidate confirmation policy denied'); };
  const records = { authorize: current, lifecycle: f.lifecycle.lifecycle, keyForDraft: f.deps.keyForDraft };
  return {
    configure(deps: IntentJourneyFactoryDependencies) {
      deps.candidate.destination = native.destinationAuthority;
      deps.candidate.authorizeReview = current; deps.candidate.authorizePreview = current;
      deps.candidate.confirmation = { records, authorizeConfirmation: current, authorizeOperation: current };
    },
    async run(input: {
      admin: Pool; post(name: string, input: unknown): Promise<Response>; read(name: string, input: unknown): Promise<unknown>;
      restart(): Promise<void>; generation: { operationId: string; inputDigest: string };
      previousScope: { reviewId: string; preparationDigest: string; resultsDigest: string }; modelCall(): void; modelCalls(): number;
    }) {
      const { admin, post } = input, measurements: Array<{ tool: string; ms: number; nativeRequests: number;
        requestKinds:ReturnType<typeof summarizeNativeRequests>;origins:{identity:ReturnType<typeof summarizeNativeRequests>;
          repository:ReturnType<typeof summarizeNativeRequests>} }> = [];
      const measured=(tool:string,start:number,before:number,identityBefore:ReturnType<typeof identityTraffic.snapshot>)=>{
        const requestKinds=summarizeNativeRequests(native.git.calls,before),identity=subtractNativeRequests(identityTraffic.snapshot(),identityBefore),
          repository=subtractNativeRequests(requestKinds,identity);
        assert.equal(Object.values(requestKinds).reduce((sum,count)=>sum+count,0),native.git.calls.length-before);
        return {tool,ms:Math.round(performance.now()-start),nativeRequests:native.git.calls.length-before,requestKinds,origins:{identity,repository}};
      };
      const read = async (tool: string, body: unknown) => {
        const start = performance.now(), before = native.git.calls.length,identityBefore=identityTraffic.snapshot();
        const result = await input.read(tool, body);
        const measurement = measured(tool,start,before,identityBefore);
        measurements.push(measurement);
        console.log('Synthetic authenticated corrected-package request: ' + JSON.stringify(measurement));
        return result;
      };
      const scope = { organizationId: f.config.organizationId,
        productId: f.config.productId, repository: f.config.repository };
      const snapshot = async () => (await admin.query(`SELECT
        (SELECT count(*) FROM steer_execution.intent_operations WHERE organization_id=$1) AS operations,
        (SELECT count(*) FROM steer_drafts.candidate_originals WHERE organization_id=$1) AS originals,
        (SELECT count(*) FROM steer_usage.model_reservations WHERE organization_id=$1) AS reservations,
        (SELECT count(*) FROM steer_execution.scope_review_runs WHERE organization_id=$1) AS scopes`, [f.config.organizationId])).rows[0];
      const before = await snapshot(); assert.equal(before.reservations, '4'); assert.equal(before.operations, '1');
      enabled = true;
      try {
        const draft = intentDraftReadOutputSchema.parse(await read('intent.draft.read', { ...scope, draftId: f.draftId, revision: 'latest' }));
        assert.equal(draft.revision, 2); assert.ok(draft.content.documents);
        const source = { ...scope, draftId: f.draftId, revision: draft.revision, revisionDigest: draft.revisionDigest, scopeInputDigest: draft.scopeInputDigest };
        const { output: review } = await verifyDevelopmentReview(source, await read('intent.development.review', source));
        const choice = authenticatedJourneyChoice(direction, review.evidence);
        const preparation = { ...source, configurationRevision: f.config.configurationRevision, sourceSnapshotDigest: review.sourceSnapshotDigest };
        const stale = { ...preparation, choice, scopeReview: { kind: 'recorded', ...input.previousScope } };
        const denied = await post('intent.candidate.save.review', stale); assert.equal(denied.status, 503);
        assert.doesNotMatch(await denied.text(), /PRIVATE|Human correction|Synthetic generated/);
        assert.deepEqual(await snapshot(), before); assert.equal(native.git.mutations(), 0);

        // The previous assessment cannot be relabelled for edited Brief/Spec bytes.
        // Reassess the latest revision through the actual HTTP admission and SDK.
        const admitted = intentScopePrepareOutputSchema.parse(await read('intent.scope.prepare', preparation));
        assert.equal(admitted.outcome, 'prepared'); assert.ok(admitted.reference);
        assert.notEqual(admitted.reference.reviewId, input.previousScope.reviewId);
        const prepared = await prepareIntentScopeReview({ ...f.described.original.source.scope,
          sourceRevision: draft.sourceRevision, originalText: draft.content.originalText,
          clarificationTurns: draft.content.clarificationTurns,
          documents: { brief: draft.content.documents.brief, spec: draft.content.documents.spec } }, review.evidence, f.described.original.profile);
        assert.equal(prepared.batches.length, 2); assert.equal(review.evidence.documents.length, 34);
        const sample = await scopeReviewFixture();
        {
          const worker = createScopeStepRuntime(f.pools, f.config, admitted.reference, {
            records: { originals: scopeRecords, authorize: authority }, profile: f.described.original.profile, authorize: authority,
            gateway: { gatewayUrl: 'http://127.0.0.1:4000/v1', gatewayKey: 'synthetic-unused', transport: async (_url, init) => {
              input.modelCall(); const wire = JSON.parse(String(init?.body));
              const batch = prepared.batches.find(batch => batch.packet.request.source === wire.messages[1].content); assert.ok(batch);
              return Response.json({ id: 'synthetic-final-scope', object: 'chat.completion', model: 'synthetic-model', choices: [{ index: 0,
                finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(sample.result(batch)) } }],
                usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } });
            } },
          });
          try { await workflows.run({ kind: 'scope', runtime: worker, batchIds: prepared.batches.map(batch => batch.metadata.batchId),
            input: { ...scope, ...admitted.reference, draftId: f.draftId, revision: draft.revision, revisionDigest: draft.revisionDigest },
            post, read, effects: snapshot, modelCalls: input.modelCalls }); }
          finally { worker.close(); }
        }
        const assessed = await verifyIntentScopeReadOutput(await read('intent.scope.read', { ...scope, ...admitted.reference }));
        assert.equal(assessed.status, 'review-available'); assert.equal(assessed.source.revision, 2);
        assert.equal(assessed.semanticQualityVerified, false); assert.ok(assessed.review);
        const finalInput = { ...preparation, choice, scopeReview: { kind: 'recorded' as const, ...admitted.reference, resultsDigest: assessed.review.resultsDigest } };
        const finalReview = await verifyCandidateSaveReview(finalInput, await read('intent.candidate.save.review', finalInput), draft.content.documents);
        const previewInput = { ...finalInput, reviewDigest: finalReview.reviewDigest, generation: input.generation, itemId: authenticatedJourneyItem(direction),
          proposalId: direction === 'proposal-continuation' ? native.proposalId : null };
        const preview = await verifyCandidateSavePreview(previewInput, await read('intent.candidate.save.preview', previewInput), draft.content.documents);
        assert.equal(preview.generation.source.revision, 1); assert.equal(preview.generation.source.latestRevision, 2);
        assert.deepEqual(preview.manifest.lineage.editedDocuments, ['brief']);
        assert.equal(preview.manifest.specConformance.state, 'stale'); assert.equal(preview.manifest.examReview.state, 'stale');
        assert.equal(preview.saveConfirmed, false); assert.equal(preview.savedToGit, false);
        if (direction === 'candidate-revision') {
          assert.equal(preview.destination.purpose, 'candidate-revision'); assert.equal(preview.destination.previousBundleDigest, native.parents().priorManifest);
          assert.equal(preview.destination.amendment, null); assert.equal(preview.destination.relationship, null);
          assert.ok('target' in choice); assert.match(choice.target.path, /\/candidates\/[a-f0-9-]+\/BRIEF\.md$/);
          assert.equal(preview.manifest.itemId, '0002-existing');
        }
        if (direction === 'new-linked') {
          assert.ok('target' in choice); assert.equal(choice.action, 'new-linked');
          assert.equal(preview.destination.purpose, 'new-candidate'); assert.equal(preview.destination.previousBundleDigest, null);
          assert.equal(preview.destination.amendment, null); assert.equal(preview.manifest.itemId, '0281-linked');
          assert.deepEqual(preview.destination.relationship, { itemId: '0002-existing', revision: choice.target.revision });
          assert.deepEqual(preview.manifest.relationship, preview.destination.relationship);
          assert.notEqual(preview.manifest.itemId, preview.destination.relationship!.itemId);
          assert.match(choice.target.path, /\/candidates\/[a-f0-9-]+\/BRIEF\.md$/);
        }
        if (direction === 'first-amendment') {
          assert.ok('target' in choice); assert.equal(choice.action, 'extend-existing');
          assert.equal(choice.target.path, 'items/0003-existing/BRIEF.md');
          assert.equal(preview.destination.purpose, 'amendment'); assert.equal(preview.destination.previousBundleDigest, null);
          assert.equal(preview.destination.relationship, null); assert.equal(preview.destination.lifecycle, 'existing-target-proposal-only');
          assert.equal(preview.manifest.itemId, '0003-existing'); assert.equal(preview.destination.amendment!.parentProposalDigest, null);
          assert.deepEqual(preview.destination.amendment!.target, { itemId: '0003-existing', revision: choice.target.revision });
          assert.deepEqual(preview.manifest.target, preview.destination.amendment!.target);
          assert.match(preview.destination.amendment!.proposalId, /^[a-f0-9]{8}-[a-f0-9]{4}-8[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/);
        }
        if (direction === 'proposal-continuation') {
          assert.ok('target' in choice); assert.equal(choice.action, 'extend-existing');
          assert.equal(choice.target.path, 'items/0001-existing/BRIEF.md');
          const parents = native.parents(), continuity = preview.destination.proposalContinuity!;
          assert.equal(preview.destination.purpose, 'amendment'); assert.equal(preview.manifest.itemId, '0001-existing');
          assert.equal(preview.destination.lifecycle, 'existing-target-proposal-only'); assert.equal(preview.destination.relationship, null);
          assert.equal(preview.destination.previousBundleDigest, parents.proposalManifest);
          assert.deepEqual(preview.destination.amendment, { proposalId: native.proposalId,
            target: { itemId: '0001-existing', revision: parents.originalTarget }, parentProposalDigest: parents.pointerDigest });
          assert.deepEqual(preview.manifest.target, preview.destination.amendment!.target);
          assert.equal(preview.manifest.previousBundleDigest, parents.proposalManifest);
          assert.equal(continuity.targetRevision, parents.originalTarget); assert.equal(continuity.reviewedRevision, choice.target.revision);
          assert.notEqual(continuity.targetRevision, continuity.reviewedRevision);
          assert.equal(continuity.targetSurfaceDigest, continuity.reviewedSurfaceDigest);
          assert.equal(continuity.pointerDigest, parents.pointerDigest); assert.equal(continuity.manifestDigest, parents.proposalManifest);
          native.state.continuationAllowed = false;
          try { assert.equal((await post('intent.candidate.save.preview', previewInput)).status, 503); }
          finally { native.state.continuationAllowed = true; }
          const missingProposal = { ...previewInput, proposalId: 'ffffffff-ffff-4fff-afff-ffffffffffff' };
          assert.notEqual(missingProposal.proposalId, native.proposalId);
          assert.equal((await post('intent.candidate.save.preview', missingProposal)).status, 503);
        }
        if (direction !== 'new-distinct') {
          assert.ok('target' in choice);
          native.state.sourceAllowed = false;
          try { assert.equal((await post('intent.candidate.save.preview', previewInput)).status, 503); }
          finally { native.state.sourceAllowed = true; }
          const wrongTarget = { ...finalInput, choice: { ...choice, target: { ...choice.target, contentDigest: '0'.repeat(64) } } };
          assert.equal((await post('intent.candidate.save.review', wrongTarget)).status, 503);
        }
        const checked = await snapshot(); assert.equal(checked.reservations, '6'); assert.equal(checked.scopes, '2');
        assert.equal(checked.operations, '1'); assert.equal(checked.originals, '0');
        const confirmation = { organizationId: scope.organizationId, preview: previewInput, previewDigest: preview.previewDigest,
          confirmation: preview.proposedConfirmation, confirm: true as const };
        // Discard the first HTTP reply as a lost client acknowledgement, then
        // rebuild the owned identity/factory and recover the same exact command.
        const started = performance.now(), requestsBefore = native.git.calls.length,identityBefore=identityTraffic.snapshot();
        const lost = await post('intent.candidate.save.prepare', confirmation); assert.equal(lost.status, 200); await lost.body?.cancel();
        measurements.push(measured('intent.candidate.save.prepare (discarded reply)',started,requestsBefore,identityBefore));
        console.log('Synthetic discarded confirmation request: ' + JSON.stringify(measurements.at(-1)));
        const stored = await snapshot(); assert.equal(stored.operations, '2'); assert.equal(stored.originals, '1');
        assert.equal(stored.reservations, '6');
        const rows = async () => (await admin.query('SELECT * FROM steer_drafts.candidate_originals WHERE organization_id=$1', [scope.organizationId])).rows;
        const encrypted = await rows(); assert.doesNotMatch(JSON.stringify(encrypted), /Human correction|Synthetic generated|Booking فارسی/);
        await input.restart();
        const recovered = verifyCandidateSavePrepare(confirmation, await read('intent.candidate.save.prepare', confirmation));
        assert.equal(recovered.outcome, 'prepared', JSON.stringify(measurements)); assert.ok(recovered.reference); assert.equal(recovered.originalPreserved, true);
        assert.equal(recovered.savedToGit, false); assert.equal(recovered.executionAuthorized, false);
        assert.deepEqual(verifyCandidateSavePrepare(confirmation, await read('intent.candidate.save.prepare', confirmation)), recovered);
        assert.deepEqual(await rows(), encrypted); assert.deepEqual(await snapshot(), stored); assert.equal(native.git.mutations(), 0);
        enabled = false;
        const unavailable = await post('intent.candidate.save.preview', previewInput); assert.equal(unavailable.status, 503);
        assert.doesNotMatch(await unavailable.text(), /PRIVATE|Human correction|Synthetic generated/);
        assert.deepEqual(await rows(), encrypted); assert.deepEqual(await snapshot(), stored);
      console.log(`PASS authenticated ${direction} corrected package: stale assessment denied, two fresh recorded scope batches, exact edited-document lineage, human confirmation, discarded HTTP acknowledgement and reconstructed idempotent original recovery; six synthetic model calls/reservations, no candidate-save scheduling or Git save`);
        console.log('Synthetic authenticated corrected-package request measurements: ' + JSON.stringify(measurements));
        return { reference: recovered.reference, documents: draft.content.documents };
      } finally { enabled = false; }
    },
  };
}
