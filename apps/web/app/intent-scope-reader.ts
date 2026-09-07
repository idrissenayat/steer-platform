import { bindIntentDisposition, intentOverlapInputSchema, intentOverlapOutputSchema } from '@steer/tool-registry/intent-overlap-contracts';
import { createReadTransport } from './read-transport.ts';
export { bindIntentDisposition };

/** Scope is fixed by the caller's verified display; the API independently reauthorizes. */
export function createIntentScopeReader(scope: { organizationId: string; repository: string }, origin: string, transport: typeof fetch = fetch) {
  const bound = Object.freeze({ ...scope });
  const reader = createReadTransport(origin, transport); let closed = false;
  return {
    async check(intent: string) {
      const input = intentOverlapInputSchema.parse({ ...bound, intent });
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(intent))))]
        .map(value => value.toString(16).padStart(2, '0')).join('');
      if (closed) throw new Error('Scope review closed.');
      const result = intentOverlapOutputSchema.parse(await reader.request('intent.overlap.check', input));
      if (closed || result.organizationId !== bound.organizationId || result.repository !== bound.repository || result.sourceDigest !== digest ||
          result.coverage.candidateCount < result.candidates.length || result.coverage.inspectedIntents > result.coverage.catalogCount) throw new Error('Scope review could not be verified.');
      return result;
    },
    close() { closed = true; reader.close(); },
  };
}
