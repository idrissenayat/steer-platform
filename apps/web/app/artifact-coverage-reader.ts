import { briefProjectionInputSchema } from '@steer/tool-registry/brief-contracts';
import { briefArtifactsOutputSchema, type BriefArtifacts } from '@steer/tool-registry/lifecycle-contracts';
import { createReadTransport } from './read-transport.ts';

type Phase = 'idle' | 'loading' | 'ready' | 'unavailable' | 'failed' | 'expired' | 'closed';
/** Display-only lifetime. Every actual read still requires current server authorization. */
export function createArtifactCoverageReader(rawBrief: unknown, origin: string, expiresAt: string,
  transport: typeof fetch = globalThis.fetch, clock: () => number = Date.now) {
  const brief = Object.freeze(briefProjectionInputSchema.parse(rawBrief));
  const expires = Date.parse(expiresAt);
  let phase: Phase = 'idle', result: BriefArtifacts | null = null, lastTime = -Infinity;
  let active: ReturnType<typeof createReadTransport> | null = null;
  const dispose = () => { active?.close(); active = null; result = null; };
  const valid = () => {
    if (phase === 'expired' || phase === 'closed') return false;
    const now = clock();
    if (!Number.isFinite(now) || !Number.isFinite(expires) || now < lastTime || now >= expires) {
      dispose(); phase = 'expired'; return false;
    }
    lastTime = now; return true;
  };
  const view = () => { valid(); return { phase, result: result ? structuredClone(result) : null }; };
  return {
    view,
    clear() { if (valid()) { dispose(); phase = 'idle'; } return view(); },
    async read() {
      if (!valid() || phase === 'loading') return view();
      dispose(); phase = 'loading';
      let current: ReturnType<typeof createReadTransport> | null = null;
      try {
        current = createReadTransport(origin, transport); active = current;
        const next = briefArtifactsOutputSchema.nullable().parse(await current.request('intent.brief.artifacts', brief));
        if (!valid() || active !== current) return view();
        if (next && Object.keys(brief).some(key => brief[key as keyof typeof brief] !== next.brief[key as keyof typeof brief])) throw new Error();
        result = next; phase = next ? 'ready' : 'unavailable';
      } catch {
        if (valid() && active === current) { result = null; phase = 'failed'; }
      } finally { current?.close(); if (active === current) active = null; }
      return view();
    },
    close() { dispose(); phase = 'closed'; },
  };
}
