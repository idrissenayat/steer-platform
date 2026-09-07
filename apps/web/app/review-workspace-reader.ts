import { briefCatalogInputSchema, type BriefProjection } from '@steer/tool-registry/brief-contracts';
import { createBriefReader, type BriefReference } from './brief-reader.ts';

/** Bounded, explicit record inspection. No background fan-out, assignments or gate state. */
export function createReviewWorkspaceReader(scope: { organizationId: string; repository: string }, origin: string,
  expiresAt: string, transport: typeof fetch = globalThis.fetch, clock = Date.now) {
  const expiry = Date.parse(expiresAt); let last = clock();
  if (!Number.isFinite(expiry) || !Number.isFinite(last)) throw new Error('Invalid review session.');
  const fixedScope = Object.freeze(briefCatalogInputSchema.parse(scope));
  let owner: ReturnType<typeof createBriefReader> | null = null, closed = false;
  let phase: 'idle' | 'loading' | 'ready' | 'failed' | 'expired' | 'closed' = 'idle';
  let records: BriefReference[] = [], selected: BriefProjection | null = null;
  let message = 'Choose Refresh review list to discover permitted Brief revisions.';
  const clear = (next: typeof phase = 'idle', notice = 'Review records cleared. Refresh the review list to recheck access.') => {
    owner?.close(); owner = null; records = []; selected = null; phase = next; message = notice;
  };
  const current = () => {
    if (closed || phase === 'expired') return false;
    const now = clock();
    if (!Number.isFinite(now) || now < last || now >= expiry) { clear('expired', 'Session display expired. Refresh access to continue.'); return false; }
    last = now; return true;
  };
  const view = () => {
    current();
    return { phase, records: records.map(value => ({ ...value })), selected: selected ? structuredClone(selected) : null, message };
  };
  return { view, clear: () => { if (!closed) clear(); return view(); },
    async refresh() {
      if (!current() || phase === 'loading') return view();
      clear('loading', 'Checking current access and discovering review sources…');
      let reader: ReturnType<typeof createBriefReader> | null = null;
      try {
        reader = createBriefReader(fixedScope, origin, transport); owner = reader;
        const next = await reader.catalog();
        if (owner !== reader || !current()) return view();
        records = next; phase = 'ready'; message = next.length ? 'Choose a Brief to inspect its recorded decisions.' :
          'No permitted projected Briefs were returned. This is not proof that no reviews exist.';
      } catch { if (owner === reader) clear('failed', 'Review access could not be checked. Refresh access and try again.'); }
      return view();
    },
    async open(reference: BriefReference) {
      if (!current() || phase !== 'ready' || !owner) return view();
      const reader = owner; selected = null; phase = 'loading'; message = 'Checking access to this exact Brief revision…';
      try {
        const next = await reader.read(reference);
        if (owner !== reader || !current()) return view();
        if (!next) clear('failed', 'This exact Brief revision is no longer available. Refresh the review list; no newer revision was substituted.');
        else { selected = next; phase = 'ready'; message = 'Exact Brief selected. Load its decision records below; approval remains unverified.'; }
      } catch { if (owner === reader) clear('failed', 'Review access could not be checked. Refresh access and try again.'); }
      return view();
    },
    close() { closed = true; clear('closed', 'Review workspace closed.'); },
  };
}
