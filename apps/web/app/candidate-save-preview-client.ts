import { candidateSavePreviewInputSchema, verifyCandidateSavePreview, type CandidateSavePreviewInput } from '@steer/tool-registry/candidate-save-preview-contracts';
import { createReadTransport } from './read-transport.ts';

/** Only opaque run/draft/destination references are sent, never editable bytes,
 * claimed generation profiles, lifecycle assertions or a confirmation flag. */
export function createCandidateSavePreviewClient(origin: string, transport: typeof fetch = fetch) {
  const reader = createReadTransport(origin, transport); let closed = false;
  return {
    async preview(raw: CandidateSavePreviewInput, documents: unknown) {
      const input = candidateSavePreviewInputSchema.parse(raw);
      const output = await verifyCandidateSavePreview(input, await reader.request('intent.candidate.save.preview', input), documents);
      if (closed) throw new Error('Package preview unavailable.'); return output;
    },
    close() { closed = true; reader.close(); },
  };
}
