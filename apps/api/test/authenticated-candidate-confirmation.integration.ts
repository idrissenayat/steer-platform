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

type Fixture = Awaited<ReturnType<typeof scopeDraftIntegrationFixture>>;
/** Continue the SAME signed-identity/SQL/recorded-generation test after correction.
 * Only synthetic candidate review/confirmation policies are enabled. The complete
 * production factory still constructs the services; no service result is injected.
 * Scheduling, Git writing and publication policies remain unavailable. */
export function authenticatedCandidateConfirmation(f: Fixture, native: ReturnType<typeof nativeCandidateJourneyFixture>,
  authority: () => Promise<void>, scopeRecords: IntentJourneyFactoryDependencies['scope']['records']['originals']) {
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
      previousScope: { reviewId: string; preparationDigest: string; resultsDigest: string }; modelCall(): void;
    }) {
      const { admin, post } = input, measurements: Array<{ tool: string; ms: number; nativeRequests: number }> = [];
      const read = async (tool: string, body: unknown) => {
        const start = performance.now(), before = native.git.calls.length;
        const result = await input.read(tool, body);
        const measurement = { tool, ms: Math.round(performance.now() - start), nativeRequests: native.git.calls.length - before };
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
        const choice = { action: 'new-distinct' as const, reason: 'Explicit synthetic final disposition after correcting the generated Brief.' };
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
        for (const batch of prepared.batches) {
          const worker = createScopeStepRuntime(f.pools, f.config, admitted.reference, {
            records: { originals: scopeRecords, authorize: authority }, profile: f.described.original.profile, authorize: authority,
            gateway: { gatewayUrl: 'http://127.0.0.1:4000/v1', gatewayKey: 'synthetic-unused', transport: async (_url, init) => {
              input.modelCall(); const wire = JSON.parse(String(init?.body)); assert.equal(wire.messages[1].content, batch.packet.request.source);
              return Response.json({ id: 'synthetic-final-scope', object: 'chat.completion', model: 'synthetic-model', choices: [{ index: 0,
                finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(sample.result(batch)) } }],
                usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } });
            } },
          });
          try { assert.equal((await worker.run(batch.metadata.batchId, new AbortController().signal)).outcome, 'succeeded'); }
          finally { worker.close(); }
        }
        const assessed = await verifyIntentScopeReadOutput(await read('intent.scope.read', { ...scope, ...admitted.reference }));
        assert.equal(assessed.status, 'review-available'); assert.equal(assessed.source.revision, 2);
        assert.equal(assessed.semanticQualityVerified, false); assert.ok(assessed.review);
        const finalInput = { ...preparation, choice, scopeReview: { kind: 'recorded' as const, ...admitted.reference, resultsDigest: assessed.review.resultsDigest } };
        const finalReview = await verifyCandidateSaveReview(finalInput, await read('intent.candidate.save.review', finalInput), draft.content.documents);
        const previewInput = { ...finalInput, reviewDigest: finalReview.reviewDigest, generation: input.generation, itemId: '0273-synthetic', proposalId: null };
        const preview = await verifyCandidateSavePreview(previewInput, await read('intent.candidate.save.preview', previewInput), draft.content.documents);
        assert.equal(preview.generation.source.revision, 1); assert.equal(preview.generation.source.latestRevision, 2);
        assert.deepEqual(preview.manifest.lineage.editedDocuments, ['brief']);
        assert.equal(preview.manifest.specConformance.state, 'stale'); assert.equal(preview.manifest.examReview.state, 'stale');
        assert.equal(preview.saveConfirmed, false); assert.equal(preview.savedToGit, false);
        const checked = await snapshot(); assert.equal(checked.reservations, '6'); assert.equal(checked.scopes, '2');
        assert.equal(checked.operations, '1'); assert.equal(checked.originals, '0');
        const confirmation = { organizationId: scope.organizationId, preview: previewInput, previewDigest: preview.previewDigest,
          confirmation: preview.proposedConfirmation, confirm: true as const };
        // Discard the first HTTP reply as a lost client acknowledgement, then
        // rebuild the owned identity/factory and recover the same exact command.
        const started = performance.now(), requestsBefore = native.git.calls.length;
        const lost = await post('intent.candidate.save.prepare', confirmation); assert.equal(lost.status, 200); await lost.body?.cancel();
        measurements.push({ tool: 'intent.candidate.save.prepare (discarded reply)', ms: Math.round(performance.now() - started), nativeRequests: native.git.calls.length - requestsBefore });
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
        console.log('PASS authenticated corrected package: stale assessment denied, two fresh recorded scope batches, exact edited-document lineage, human confirmation, discarded HTTP acknowledgement and reconstructed idempotent original recovery; six synthetic model calls/reservations, no scheduling or Git save');
        console.log('Synthetic authenticated corrected-package request measurements: ' + JSON.stringify(measurements));
        return { reference: recovered.reference, documents: draft.content.documents };
      } finally { enabled = false; }
    },
  };
}
