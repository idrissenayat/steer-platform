import { briefDestinationInputSchema, briefDestinationOutputSchema, type BriefDestination } from '@steer/tool-registry/brief-contracts';
import { createReadTransport } from './read-transport.ts';

export type DestinationState =
  | { kind: 'idle' | 'loading' | 'unavailable' | 'stale' | 'expired' }
  | { kind: 'observed'; destination: BriefDestination };
export const destinationMessages = {
  idle: 'Check the configured destination before planning where this Brief will go.',
  loading: 'Checking current access and the repository revision…',
  unavailable: 'Destination unavailable. Refresh access and try again. A workspace owner may need to configure the destination or grant read access.',
  stale: 'Destination details cleared. Check again for a new observation.',
  expired: 'Session display expired. Refresh access before checking the destination.',
  observed: 'Read-only observation. The branch may change immediately after this check.',
} as const;

/** Display lifecycle only. No lease, persistence, automatic refresh or write capability. */
export function createDestinationController(rawScope: unknown, expiresAt: string, origin: string,
  publish: (state: DestinationState) => void, dependencies: {
    fetch?: typeof fetch; now?: () => number;
    schedule?: (callback: () => void, delay: number) => () => void;
  } = {}) {
  const scope = Object.freeze(briefDestinationInputSchema.parse(rawScope));
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry)) throw new Error('Invalid destination display expiry.');
  const now = dependencies.now ?? Date.now;
  const schedule = dependencies.schedule ?? ((callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); });
  let active: ReturnType<typeof createReadTransport> | undefined;
  let cancelTimer: (() => void) | undefined;
  let generation = 0, closed = false;
  const reset = () => { generation++; active?.close(); active = undefined; cancelTimer?.(); cancelTimer = undefined; };
  const clear = (kind: 'stale' | 'expired') => { reset(); if (!closed) publish({ kind }); };
  return {
    async load() {
      if (closed) return;
      reset(); const current = generation, started = now();
      if (!Number.isFinite(started) || started >= expiry) { publish({ kind: 'expired' }); return; }
      publish({ kind: 'loading' });
      let reader: ReturnType<typeof createReadTransport> | undefined;
      try {
        reader = createReadTransport(origin, dependencies.fetch); active = reader;
        const result = briefDestinationOutputSchema.parse(await reader.request('intent.brief.destination', scope));
        if (closed || current !== generation) return;
        const completed = now(), observed = Date.parse(result.observedAt);
        if (!Number.isFinite(completed) || completed < started || completed >= expiry) { clear('expired'); return; }
        if (result.organizationId !== scope.organizationId || observed > completed || completed - observed >= 15000 || completed - started >= 15000) throw new Error();
        // This is a display-clear timer, never validity of authority or branch state.
        const displayUntil = Math.min(expiry, observed + 15000);
        publish({ kind: 'observed', destination: result });
        cancelTimer = schedule(() => {
          if (!closed && generation === current) clear(now() >= expiry ? 'expired' : 'stale');
        }, displayUntil - completed);
      } catch {
        if (!closed && current === generation) publish({ kind: 'unavailable' });
      } finally { reader?.close(); if (active === reader) active = undefined; }
    },
    invalidate() { clear('stale'); },
    expire() { clear('expired'); },
    close() { closed = true; reset(); },
  };
}
