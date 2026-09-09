import { intentEvidenceInputSchema } from '@steer/tool-registry/intent-evidence-contracts';
import type { CandidateSaveReviewInput } from '@steer/tool-registry/candidate-save-review-contracts';

export type AuthenticatedJourneyDirection = 'new-distinct' | 'candidate-revision' | 'new-linked' | 'first-amendment';
export const authenticatedJourneyItem = (direction: AuthenticatedJourneyDirection) => {
  if (direction === 'new-distinct') return '0273-synthetic';
  if (direction === 'candidate-revision') return '0002-existing';
  if (direction === 'new-linked') return '0281-linked';
  if (direction === 'first-amendment') return '0003-existing';
  throw new Error('Unsupported synthetic journey direction.');
};
/** Test input selection, not a verdict or authority. The real reviewer,
 * destination resolver and writer must independently verify this exact target. */
export function authenticatedJourneyChoice(direction: AuthenticatedJourneyDirection, rawEvidence: unknown): CandidateSaveReviewInput['choice'] {
  const evidence = intentEvidenceInputSchema.parse(rawEvidence);
  authenticatedJourneyItem(direction); // Reject unsupported directions without a creation fallback.
  if (direction === 'new-distinct') return { action: 'new-distinct', reason: 'Explicit synthetic final disposition after correcting the generated Brief.' };
  if (direction === 'first-amendment') {
    const targets = evidence.inventory.filter(source => source.targetId === 'items/0003-existing'
      && source.status === 'canonical' && source.path === 'items/0003-existing/BRIEF.md');
    if (targets.length !== 1) throw new Error('The exact synthetic canonical Brief must be present; no candidate or new-item fallback.');
    return { action: 'extend-existing', reason: 'Explicit synthetic proposal to add scope to the canonical item; preserve its existing Brief, Spec and Exam.',
      target: { path: targets[0]!.path, revision: evidence.head, contentDigest: targets[0]!.contentDigest } };
  }
  // Both target-bearing scenarios deliberately select the same reviewed source;
  // only candidate-revision writes that item. New-linked writes a separate root.
  const matches = evidence.inventory.filter(source => source.targetId === 'items/0002-existing' && source.status === 'candidate'
    && source.path.startsWith('items/0002-existing/candidates/') && source.path.endsWith('/BRIEF.md'));
  if (matches.length !== 1) throw new Error('The exact synthetic pre-pull candidate must be present, not inferred from a root mirror.');
  if (direction === 'new-linked') return { action: 'new-linked', reason: 'Explicit synthetic distinct work linked to the reviewed candidate; do not update or merge its scope.',
    target: { path: matches[0]!.path, revision: evidence.head, contentDigest: matches[0]!.contentDigest } };
  return { action: 'extend-existing', reason: 'Explicit synthetic extension of the reviewed pre-pull candidate; not a new item or automatic merge.',
    target: { path: matches[0]!.path, revision: evidence.head, contentDigest: matches[0]!.contentDigest } };
}
