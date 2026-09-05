import { briefCatalogInputSchema, briefCatalogOutputSchema, briefProjectionInputSchema, briefProjectionOutputSchema,
  type BriefCatalog, type BriefProjection } from '@steer/tool-registry/brief-contracts';
import { createReadTransport } from './read-transport.ts';

export type BriefReference = BriefCatalog['records'][number];
/** Fixed scope and exact catalog membership; stale/foreign data never becomes a rendered Brief. */
export function createBriefReader(rawScope: unknown, origin: string, transport: typeof fetch = globalThis.fetch) {
  const scope = Object.freeze(briefCatalogInputSchema.parse(rawScope));
  const reader = createReadTransport(origin, transport);
  let records: BriefReference[] = []; let closed = false;
  const sameScope = (value: { organizationId: string; repository: string }) =>
    value.organizationId === scope.organizationId && value.repository === scope.repository;
  const failure = () => new Error('Brief access could not be verified. Refresh access and try again.');
  return {
    async catalog(): Promise<BriefReference[]> {
      records = [];
      try {
        const result = briefCatalogOutputSchema.parse(await reader.request('intent.brief.catalog', scope));
        if (closed || !sameScope(result) || new Set(result.records.map((item) => item.path)).size !== result.records.length) throw failure();
        records = result.records.map((item) => ({ ...item }));
        return records.map((item) => ({ ...item }));
      } catch { records = []; throw failure(); }
    },
    async read(reference: BriefReference): Promise<BriefProjection | null> {
      try {
        const input = briefProjectionInputSchema.parse({ ...scope, ...reference });
        if (!sameScope(input) || !records.some((item) => item.path === input.path && item.revision === input.revision && item.contentDigest === input.contentDigest)) throw failure();
        const result = briefProjectionOutputSchema.nullable().parse(await reader.request('intent.brief.read', input));
        if (closed || (result && (!sameScope(result) || result.path !== input.path || result.revision !== input.revision || result.contentDigest !== input.contentDigest))) throw failure();
        return result;
      } catch { records = []; throw failure(); }
    },
    close() { closed = true; records = []; reader.close(); },
  };
}
