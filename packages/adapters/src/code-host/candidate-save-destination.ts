import { candidateSavePreviewInputSchema, type CandidateSavePreviewInput } from '@steer/tool-registry/candidate-save-preview-contracts';
import type { CandidateSaveReviewOutput } from '@steer/tool-registry/candidate-save-review-contracts';
import { createNewCandidateSaveDestination, newCandidateDestinationConfigurationSchema, type NewCandidateDestinationAuthority } from './new-candidate-destination.ts';
import { createExistingCandidateSaveDestination, type ExistingCandidateDestinationAuthority } from './existing-candidate-destination.ts';
import type { CorpusRepositoryReader } from './github.ts';

/** Explicit startup composition only. Never route failed existing-item requests
 * into new work, infer lifecycle, allocate an item ID or install live authority. */
export function createCandidateSaveDestination(reader: CorpusRepositoryReader, rawConfiguration: unknown,
  authorities: { newItem: NewCandidateDestinationAuthority; existingItem: ExistingCandidateDestinationAuthority }) {
  const config = newCandidateDestinationConfigurationSchema.parse(rawConfiguration);
  const newItem = createNewCandidateSaveDestination(reader, config, authorities.newItem);
  let existingItem: ReturnType<typeof createExistingCandidateSaveDestination>;
  try { existingItem = createExistingCandidateSaveDestination(reader, config, authorities.existingItem); }
  catch (error) { newItem.close(); throw error; }
  return { scope: newItem.scope,
    resolve(raw: CandidateSavePreviewInput, review: CandidateSaveReviewOutput, current: () => Promise<void>) {
      const input = candidateSavePreviewInputSchema.parse(raw);
      return input.choice.action === 'extend-existing' ? existingItem.resolve(input, review, current) : newItem.resolve(input, review, current);
    },
    close() { newItem.close(); existingItem.close(); },
  };
}
