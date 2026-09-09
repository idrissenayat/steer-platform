import { candidateSaveReviewInputSchema, verifyCandidateSaveReview, type CandidateSaveReviewInput } from '@steer/tool-registry/candidate-save-review-contracts';
import { createReadTransport } from './read-transport.ts';

/** Fixed read-only tool; source bytes remain in the editor, never in the request. */
export function createCandidateSaveReviewClient(origin: string, transport: typeof fetch = fetch) {
  const reader = createReadTransport(origin, transport); let closed = false;
  return {
    async review(raw: CandidateSaveReviewInput, documents: unknown) {
      const input = candidateSaveReviewInputSchema.parse(raw);
      const output = await verifyCandidateSaveReview(input, await reader.request('intent.candidate.save.review', input), documents);
      if (closed) throw new Error('Final review unavailable.'); return output;
    },
    close() { closed = true; reader.close(); },
  };
}
