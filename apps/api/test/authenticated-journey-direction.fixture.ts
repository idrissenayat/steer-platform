import { intentEvidenceInputSchema } from '@steer/tool-registry/intent-evidence-contracts';
import type { CandidateSaveReviewInput } from '@steer/tool-registry/candidate-save-review-contracts';

export type AuthenticatedJourneyDirection = 'new-distinct' | 'candidate-revision';
export const authenticatedJourneyItem = (direction: AuthenticatedJourneyDirection) => {
  if (direction === 'new-distinct') return '0273-synthetic';
  if (direction === 'candidate-revision') return '0002-existing';
  throw new Error('Unsupported synthetic journey direction.');
};
/** Test input selection, not a verdict or authority. The real reviewer,
 * destination resolver and writer must independently verify this exact target. */
export function authenticatedJourneyChoice(direction: AuthenticatedJourneyDirection, rawEvidence: unknown): CandidateSaveReviewInput['choice'] {
  const evidence = intentEvidenceInputSchema.parse(rawEvidence), itemId = authenticatedJourneyItem(direction);
  if (direction === 'new-distinct') return { action: 'new-distinct', reason: 'Explicit synthetic final disposition after correcting the generated Brief.' };
  const matches = evidence.inventory.filter(source => source.targetId === `items/${itemId}` && source.status === 'candidate'
    && source.path.startsWith(`items/${itemId}/candidates/`) && source.path.endsWith('/BRIEF.md'));
  if (matches.length !== 1) throw new Error('The exact synthetic pre-pull candidate must be present, not inferred from a root mirror.');
  return { action: 'extend-existing', reason: 'Explicit synthetic extension of the reviewed pre-pull candidate; not a new item or automatic merge.',
    target: { path: matches[0]!.path, revision: evidence.head, contentDigest: matches[0]!.contentDigest } };
}
