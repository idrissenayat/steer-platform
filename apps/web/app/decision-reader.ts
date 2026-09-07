import { briefProjectionInputSchema } from '@steer/tool-registry/brief-contracts';
import { briefDecisionsOutputSchema, decisionClaimsSchema, decisionPaths, verifyProjectionBytes } from '@steer/tool-registry/decision-contracts';
import { createReadTransport } from './read-transport.ts';

export function createDecisionReader(rawBrief: unknown, origin: string, transport: typeof fetch = globalThis.fetch) {
  const brief = Object.freeze(briefProjectionInputSchema.parse(rawBrief));
  const reader = createReadTransport(origin, transport); let closed = false;
  return {
    async read() {
      try {
        const result = briefDecisionsOutputSchema.nullable().parse(await reader.request('intent.brief.decisions', brief));
        if (closed) throw new Error();
        if (!result) return null;
        if (Object.keys(brief).some(key => brief[key as keyof typeof brief] !== result.brief[key as keyof typeof brief]) ||
            new Set(result.records.map(record => record.path)).size !== result.records.length) throw new Error();
        const paths = decisionPaths(brief.path);
        for (const record of result.records) {
          if (record.organizationId !== brief.organizationId || record.repository !== brief.repository ||
              paths[record.claims.gate - 1] !== record.path || new TextEncoder().encode(record.content).byteLength > 32768) throw new Error();
          await verifyProjectionBytes(record);
          const claims = decisionClaimsSchema.parse(JSON.parse(record.content));
          if (JSON.stringify(claims) !== JSON.stringify(record.claims) || record.briefLinked !==
              claims.artifacts.some(ref => ref.path === brief.path && ref.revision === brief.revision)) throw new Error();
        }
        if (closed) throw new Error();
        return result;
      } catch { throw new Error('Decision records could not be checked. Refresh access and try again.'); }
    },
    close() { closed = true; reader.close(); },
  };
}
