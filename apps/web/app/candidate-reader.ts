import { candidateBundleReadInputSchema, verifyCandidateBundleRead } from '@steer/tool-registry/candidate-bundle-read-contracts';
import { createReadTransport } from './read-transport.ts';

/** Only exact current-authorized reads. No draft adoption, cache, polling or writes. */
export function createCandidateReader(scope: Readonly<{ organizationId: string; repository: string }>, origin: string,
  transport: typeof fetch = globalThis.fetch) {
  const home = Object.freeze({ ...scope }), reader = createReadTransport(origin, transport);
  let closed = false;
  return {
    async read(raw: unknown) {
      try {
        const input = candidateBundleReadInputSchema.parse(raw);
        if (closed || input.organizationId !== home.organizationId || input.repository !== home.repository) throw new Error();
        const output = await verifyCandidateBundleRead(input, await reader.request('intent.candidate.read', input));
        if (closed) throw new Error();
        return output;
      } catch { throw new Error('This saved candidate could not be verified. Refresh access and reopen the exact link.'); }
    },
    close() { closed = true; reader.close(); },
  };
}
