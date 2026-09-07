import { decisionEvidenceInputSchema, decisionEvidenceOutputSchema, decisionPaths, verifyProjectionBytes } from '@steer/tool-registry/decision-contracts';
import { createReadTransport } from './read-transport.ts';

/** Exact named context, same-origin read only; request facts never grant access. */
export function createDecisionEvidenceReader(rawInput: unknown, origin: string, transport: typeof fetch = globalThis.fetch) {
  const input = decisionEvidenceInputSchema.parse(rawInput);
  const { decision, evidence, ...brief } = input;
  if (!decisionPaths(brief.path).includes(decision.path)) throw new Error('Invalid decision source selection.');
  const reader = createReadTransport(origin, transport); let closed = false;
  return {
    async read() {
      try {
        const result = decisionEvidenceOutputSchema.nullable().parse(await reader.request('intent.brief.decision.evidence', input));
        if (closed) throw new Error();
        if (!result) return null;
        if (Object.keys(brief).some(key => brief[key as keyof typeof brief] !== result.brief[key as keyof typeof brief]) ||
            Object.keys(decision).some(key => decision[key as keyof typeof decision] !== result.decision[key as keyof typeof decision]) ||
            result.artifact.organizationId !== brief.organizationId || result.artifact.repository !== brief.repository ||
            result.artifact.path !== evidence.path || result.artifact.revision !== evidence.revision) throw new Error();
        await verifyProjectionBytes(result.artifact);
        if (closed) throw new Error();
        return result;
      } catch { throw new Error('Evidence source could not be checked. Refresh access and reload the decision records.'); }
    },
    close() { closed = true; reader.close(); },
  };
}
