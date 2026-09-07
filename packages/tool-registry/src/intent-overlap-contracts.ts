import { z } from 'zod';
import { briefCatalogInputSchema, artifactProjectionInputSchema, briefProjectionInputSchema } from './brief-contracts.ts';

export const intentOverlapInputSchema = briefCatalogInputSchema.extend({
  intent: z.string().min(1).max(13050).refine(value => value.trim().length > 0),
});
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const intentOverlapOutputSchema = briefCatalogInputSchema.extend({
  kind: z.literal('intent-overlap-candidates'),
  sourceDigest: digest, catalogFingerprint: digest, reviewFingerprint: digest,
  method: z.literal('lexical-candidates/v1'),
  coverage: z.strictObject({ scope: z.literal('configured-projections-only'),
    catalogCount: z.number().int().min(0).max(1000), inspectedIntents: z.number().int().min(0).max(50),
    inspectedDocuments: z.number().int().min(0).max(100), candidateCount: z.number().int().min(0).max(100),
    resultsTruncated: z.boolean(), scanLimited: z.boolean(),
    gaps: z.array(z.strictObject({ path: artifactProjectionInputSchema.shape.path,
      reason: z.enum(['not-configured', 'not-projected']) })).max(100),
  }),
  candidates: z.array(z.strictObject({
    briefPath: briefProjectionInputSchema.shape.path,
    briefContentDigest: digest,
    path: artifactProjectionInputSchema.shape.path, revision: artifactProjectionInputSchema.shape.revision, contentDigest: digest,
    document: z.enum(['BRIEF', 'SPEC']), signal: z.enum(['matching-text', 'shared-terms']),
    queryTermCoverage: z.number().min(0).max(1), matchedTerms: z.array(z.string().min(1).max(13050)).max(12),
    excerpt: z.string().max(500),
  })).max(10),
  semanticReviewComplete: z.literal(false), authoritativeClearance: z.literal(false),
});
export type IntentOverlapInput = z.infer<typeof intentOverlapInputSchema>;
export type IntentOverlapOutput = z.infer<typeof intentOverlapOutputSchema>;

const dispositionTarget = z.strictObject({ path: briefProjectionInputSchema.shape.path,
  revision: artifactProjectionInputSchema.shape.revision, contentDigest: digest });
const reason = z.string().min(1).max(3000).refine(value => value.trim().length > 0);
export const intentDispositionChoiceSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('extend-existing'), target: dispositionTarget, reason }),
  z.strictObject({ action: z.literal('new-linked'), target: dispositionTarget, reason }),
  z.strictObject({ action: z.literal('new-distinct'), reason }),
]);
export type IntentDispositionChoice = z.infer<typeof intentDispositionChoiceSchema>;
export const intentDispositionProposalSchema = briefCatalogInputSchema.extend({
  kind: z.literal('intent-disposition-proposal'), sourceDigest: digest, catalogFingerprint: digest, reviewFingerprint: digest,
  choice: intentDispositionChoiceSchema, semanticReviewComplete: z.literal(false), authoritativeClearance: z.literal(false), persisted: z.literal(false),
});

/** A proposed human direction, not authority, persistence or a semantic duplicate verdict. */
export function bindIntentDisposition(previousRaw: unknown, currentRaw: unknown, rawChoice: unknown) {
  const previous = intentOverlapOutputSchema.parse(previousRaw), current = intentOverlapOutputSchema.parse(currentRaw);
  const choice = intentDispositionChoiceSchema.parse(rawChoice);
  if (previous.organizationId !== current.organizationId || previous.repository !== current.repository ||
      previous.sourceDigest !== current.sourceDigest || previous.catalogFingerprint !== current.catalogFingerprint ||
      previous.reviewFingerprint !== current.reviewFingerprint) throw new Error('Scope changed. Review the current sources before choosing again.');
  if ('target' in choice && !current.candidates.some(candidate => candidate.briefPath === choice.target.path &&
      candidate.revision === choice.target.revision && candidate.briefContentDigest === choice.target.contentDigest)) {
    throw new Error('Choose an existing Brief from the current reviewed matches.');
  }
  return intentDispositionProposalSchema.parse({ kind: 'intent-disposition-proposal', organizationId: current.organizationId, repository: current.repository,
    sourceDigest: current.sourceDigest, catalogFingerprint: current.catalogFingerprint, reviewFingerprint: current.reviewFingerprint,
    choice, semanticReviewComplete: false, authoritativeClearance: false, persisted: false });
}
export type IntentDispositionProposal = ReturnType<typeof bindIntentDisposition>;

/** Compare a caller proposal with freshly authorized server evidence; no browser attestation is trusted. */
export function recheckIntentDisposition(rawProposal: unknown, rawReview: unknown) {
  const proposal = intentDispositionProposalSchema.parse(rawProposal), review = intentOverlapOutputSchema.parse(rawReview);
  if (proposal.organizationId !== review.organizationId || proposal.repository !== review.repository ||
      proposal.sourceDigest !== review.sourceDigest || proposal.catalogFingerprint !== review.catalogFingerprint ||
      proposal.reviewFingerprint !== review.reviewFingerprint) throw new Error('Scope review is stale.');
  return bindIntentDisposition(review, review, proposal.choice);
}
