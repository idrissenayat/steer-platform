import { z } from 'zod';
import { candidateSaveReviewInputSchema, candidateSaveReviewOutputSchema, verifyCandidateSaveReview } from './candidate-save-review-contracts.ts';
import { candidateBundleInputSchema, candidateBundleManifestSchema, planCandidateBundle } from './candidate-bundle-contracts.ts';
import { intentSaveBindingSchema } from './intent-revision-contracts.ts';
import { intentDevelopmentHistoryInputSchema, intentDevelopmentHistoryOutputSchema } from './intent-development-history-contracts.ts';
import { reviewedItemBriefTarget } from './reviewed-brief-target.ts';
export { reviewedItemBriefTarget } from './reviewed-brief-target.ts';

const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const bundle = candidateBundleInputSchema.shape;
export const candidateSavePreviewInputSchema = candidateSaveReviewInputSchema.extend({
  reviewDigest: digest,
  generation: intentDevelopmentHistoryInputSchema.pick({ operationId: true, inputDigest: true }),
  itemId: bundle.itemId,
  proposalId: bundle.amendment.unwrap().shape.proposalId.nullable(),
});
/** Repository-verified unchanged item surface plus independently established
 * lifecycle eligibility. Structural validation alone is never that authority. */
export const candidateProposalContinuitySchema = z.strictObject({
  kind: z.literal('steer-proposal-continuity/v1'), proposalId: bundle.amendment.unwrap().shape.proposalId,
  targetRevision: bundle.expectedHead, reviewedRevision: bundle.expectedHead,
  targetRootTreeSha: bundle.expectedHead, reviewedRootTreeSha: bundle.expectedHead,
  targetSurfaceDigest: digest, reviewedSurfaceDigest: digest, briefContentDigest: digest,
  pointerDigest: digest, manifestDigest: digest,
}).refine(v => v.targetSurfaceDigest === v.reviewedSurfaceDigest, 'The original target surface changed.');
/** Supplied only by a current, trusted repository/lifecycle reader. File presence
 * alone cannot prove that an item has not been pulled or that a target is mutable. */
export const candidateSaveDestinationSchema = z.strictObject({
  organizationId: bundle.organizationId, productId: bundle.productId, repository: bundle.repository, branch: bundle.branch,
  itemId: bundle.itemId, expectedHead: bundle.expectedHead, purpose: bundle.purpose,
  previousBundleDigest: bundle.previousBundleDigest, amendment: bundle.amendment, relationship: bundle.relationship,
  lifecycle: z.enum(['absent-item', 'candidate-not-pulled', 'existing-target-proposal-only']),
  authorityDigest: digest,
  proposalContinuity: candidateProposalContinuitySchema.optional(),
});
const role = z.strictObject({ configurationRevision: bundle.architectConfigurationRevision, resultRef: z.uuid(), resultDigest: digest, outputDigest: digest });
export const candidateGenerationLineageSchema = z.strictObject({
  ...candidateSavePreviewInputSchema.shape.generation.shape,
  source: intentDevelopmentHistoryOutputSchema.shape.source,
  architect: role, testAgent: role,
  originalDocuments: candidateSaveReviewOutputSchema.shape.documents,
});
export const candidateSavePreviewOutputSchema = z.strictObject({
  kind: z.literal('steer-candidate-save-preview/v1'), input: candidateSavePreviewInputSchema,
  review: candidateSaveReviewOutputSchema, generation: candidateGenerationLineageSchema,
  destination: candidateSaveDestinationSchema, manifest: candidateBundleManifestSchema,
  manifestDigest: digest, pointerPath: z.string().min(1).max(260), pointerDigest: digest,
  proposedConfirmation: intentSaveBindingSchema, previewDigest: digest,
  saveConfirmed: z.literal(false), operationCreated: z.literal(false), savedToGit: z.literal(false),
  executionAuthorized: z.literal(false), gateSigned: z.literal(false),
});
export type CandidateSavePreviewInput = z.infer<typeof candidateSavePreviewInputSchema>;
export type CandidateSavePreviewOutput = z.infer<typeof candidateSavePreviewOutputSchema>;
export type CandidateSaveDestination = z.infer<typeof candidateSaveDestinationSchema>;
export type CandidateGenerationLineage = z.infer<typeof candidateGenerationLineageSchema>;
export interface CandidateSavePreviewer {
  readonly scope: Readonly<{ organizationId: string; productId: string; repository: string; subject: string; branch: string; configurationRevision: string }>;
  preview(input: CandidateSavePreviewInput, current: () => Promise<void>): Promise<unknown>;
}
const hash = async (value: unknown) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))]
  .map(b => b.toString(16).padStart(2, '0')).join('');
function freeze<T>(v: T): T { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
const fail = () => new Error('Candidate package preview is unavailable or changed.');
// No operation is minted by a preview. Only the manifest/pointer are exposed;
// this placeholder and its receipt never leave the pure planner.
const placeholder = '00000000-0000-4000-8000-000000000000';
const uuidFromDigest = (v: string) => `${v.slice(0, 8)}-${v.slice(8, 12)}-8${v.slice(13, 16)}-a${v.slice(17, 20)}-${v.slice(20, 32)}`;

/** Pure reproducible proposal, not authority or durable human consent. All ports
 * must be rechecked by the server before confirmation/admission and dispatch. */
export async function describeCandidateSavePreview(raw: unknown, rawReview: unknown, documents: unknown,
  rawLineage: unknown, rawDestination: unknown, serviceCommitter: string) {
  const input = candidateSavePreviewInputSchema.parse(raw);
  const { reviewDigest, generation: selected, itemId, proposalId, ...reviewInput } = input;
  const review = await verifyCandidateSaveReview(reviewInput, rawReview, documents);
  const generation = candidateGenerationLineageSchema.parse(rawLineage), destination = candidateSaveDestinationSchema.parse(rawDestination);
  if (review.reviewDigest !== reviewDigest || generation.operationId !== selected.operationId || generation.inputDigest !== selected.inputDigest
    || generation.source.draftId !== input.draftId || generation.source.revision > input.revision || generation.source.latestRevision !== input.revision
    || (generation.source.revision === input.revision && (generation.source.revisionDigest !== input.revisionDigest || generation.source.scopeInputDigest !== input.scopeInputDigest))
    || (['organizationId', 'productId', 'repository', 'branch', 'expectedHead'] as const).some(k => destination[k] !== review[k])
    || destination.itemId !== itemId
    || (proposalId !== null && (destination.amendment?.proposalId !== proposalId
      || destination.purpose !== 'amendment' || !destination.amendment.parentProposalDigest || !destination.previousBundleDigest))
    || (proposalId === null && (destination.amendment?.parentProposalDigest || destination.proposalContinuity))) throw fail();
  const choice = input.choice;
  const targetReference = 'target' in choice ? reviewedItemBriefTarget(choice.target.path) : null;
  const target = targetReference?.itemId;
  if ('target' in choice && !target) throw fail(); // Never invent a legacy-to-items mapping.
  if (choice.action === 'extend-existing') {
    if (itemId !== target || destination.purpose === 'new-candidate') throw fail();
    if(targetReference?.bundleId && (destination.purpose!=='candidate-revision'||proposalId!==null))throw fail();
    if (proposalId !== null) {
      const continuity = destination.proposalContinuity;
      if (!continuity || continuity.proposalId !== proposalId || continuity.targetRevision !== destination.amendment?.target.revision
        || continuity.reviewedRevision !== choice.target.revision || continuity.reviewedRevision !== review.expectedHead
        || continuity.briefContentDigest !== choice.target.contentDigest || continuity.pointerDigest !== destination.amendment.parentProposalDigest
        || continuity.manifestDigest !== destination.previousBundleDigest) throw fail();
    } else if (destination.amendment && destination.amendment.target.revision !== choice.target.revision) throw fail();
  } else if (destination.purpose !== 'new-candidate') throw fail();
  if (choice.action === 'new-linked') {
    if (!destination.relationship || destination.relationship.itemId !== target || destination.relationship.revision !== choice.target.revision) throw fail();
  } else if (choice.action === 'new-distinct' && destination.relationship !== null) throw fail();
  const editedDocuments = (['brief', 'spec', 'exam'] as const).filter(name =>
    JSON.stringify(review.documents[name]) !== JSON.stringify(generation.originalDocuments[name]));
  const identity = await hash(['steer-candidate-preview-bundle/v1', input, review, generation, destination, serviceCommitter]);
  const { authorityDigest: _authority, lifecycle: _lifecycle, proposalContinuity: _continuity, ...destinationInput } = destination;
  const value = candidateBundleInputSchema.parse({ ...destinationInput,
    bundleId: uuidFromDigest(identity), operationId: placeholder, originatorSubject: review.subject, serviceCommitter,
    architectConfigurationRevision: generation.architect.configurationRevision, examConfigurationRevision: generation.testAgent.configurationRevision,
    editedDocuments, scopeInputDigest: review.scopeInputDigest, sourceSnapshotDigest: review.sourceSnapshotDigest,
    assessmentDigest: review.assessmentDigest, dispositionDigest: review.dispositionDigest,
    specConformance: editedDocuments.some(n => n !== 'exam') ? 'stale' : 'unreviewed',
    examReview: editedDocuments.length ? 'stale' : 'unreviewed', documents });
  const plan = await planCandidateBundle(value);
  if (plan.requiredLifecycle !== destination.lifecycle) throw fail();
  const root = `items/${itemId}`, manifestFile = plan.files.find(f => f.path === `${root}/candidates/${value.bundleId}/MANIFEST.json`)!;
  const manifest = candidateBundleManifestSchema.parse(JSON.parse(manifestFile.content));
  const pointerPath = destination.amendment ? `${root}/proposals/${destination.amendment.proposalId}.json` : `${root}/CANDIDATE.json`;
  const proposedConfirmation = intentSaveBindingSchema.parse({ kind: 'steer-intent-save-binding/v1',
    organizationId: review.organizationId, productId: review.productId, subject: review.subject, draftId: input.draftId,
    draftRevision: input.revision, repository: review.repository, branch: review.branch, item: root, expectedHead: review.expectedHead,
    bundleManifestDigest: plan.manifestDigest, scopeInputDigest: review.scopeInputDigest, sourceSnapshotDigest: review.sourceSnapshotDigest,
    assessmentDigest: review.assessmentDigest, dispositionDigest: review.dispositionDigest });
  const body = { kind: 'steer-candidate-save-preview/v1', input, review, generation, destination, manifest,
    manifestDigest: plan.manifestDigest, pointerPath, pointerDigest: plan.pointerDigest, proposedConfirmation,
    saveConfirmed: false, operationCreated: false, savedToGit: false, executionAuthorized: false, gateSigned: false };
  const output = candidateSavePreviewOutputSchema.parse({ ...body, previewDigest: await hash(['steer-candidate-save-preview/v1', body]) });
  const { operationId: _operation, ...submissionBundle } = value;
  return freeze({ output, submission: { bundle: submissionBundle, confirmation: proposedConfirmation } });
}
/** Browser equality validation does not authenticate generation or lifecycle. */
export async function verifyCandidateSavePreview(input: unknown, raw: unknown, documents?: unknown) {
  const output = candidateSavePreviewOutputSchema.parse(raw);
  if (JSON.stringify(candidateSavePreviewInputSchema.parse(input)) !== JSON.stringify(output.input)) throw fail();
  const { previewDigest, ...body } = output;
  if (previewDigest !== await hash(['steer-candidate-save-preview/v1', body])) throw fail();
  const { reviewDigest, generation: _generation, itemId: _item, proposalId: _proposal, ...reviewInput } = output.input;
  await verifyCandidateSaveReview(reviewInput, output.review, documents);
  if (reviewDigest !== output.review.reviewDigest) throw fail();
  if (documents === undefined) return freeze(output);
  const expected = await describeCandidateSavePreview(input, output.review, documents, output.generation, output.destination, output.manifest.lineage.serviceCommitter);
  if (JSON.stringify(expected.output) !== JSON.stringify(output)) throw fail();
  return expected.output;
}
