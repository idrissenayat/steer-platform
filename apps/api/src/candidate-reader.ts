import { candidateBundleReadInputSchema, candidateBundleReadScopeSchema, verifyCandidateBundleRead,
  type CandidateBundleReadService } from '@steer/tool-registry/candidate-bundle-read-contracts';
import { createCandidateBundleReader } from '@steer/adapters/candidate-bundle-reader';
import type { ArtifactReader } from '@steer/adapters/github';

/** Explicit read-only composition. No environment activation, new credentials,
 * live grants, provider writes or current-head fallback. One shared reader retains
 * its four-operation admission bound, including dependencies stalled after timeout.
 */
export function createVerifiedCandidateBundleReader(reader: ArtifactReader, rawScope: unknown,
  authorize: (input: Parameters<Parameters<typeof createCandidateBundleReader>[2]>[0], subject: string) => Promise<void>) {
  const parsed = candidateBundleReadScopeSchema.parse(rawScope);
  const scope = Object.freeze({ ...parsed, itemIds: Object.freeze(parsed.itemIds) });
  if (typeof authorize !== 'function') throw new Error('Candidate read authority unavailable.');
  const { subject, ...config } = scope;
  const adapter = createCandidateBundleReader(reader, config, input => authorize(input, subject));
  let closed = false;
  return { scope,
    async read(raw, current) {
      const input = candidateBundleReadInputSchema.parse(raw);
      if (closed || typeof current !== 'function' || await current() !== undefined) throw new Error('Candidate read unavailable.');
      const result = await verifyCandidateBundleRead(input, await adapter.reopen(input, current));
      if (await current() !== undefined || closed) throw new Error('Candidate read unavailable.');
      return result;
    },
    close() { closed = true; adapter.close(); },
  } satisfies CandidateBundleReadService & { close(): void };
}
