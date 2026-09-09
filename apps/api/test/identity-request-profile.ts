import { summarizeNativeRequests } from './native-request-metrics.ts';
import { identityRequestFrames, identityRequestOrigins } from './identity-request-profile-context.ts';
export { identityRequestFrames } from './identity-request-profile-context.ts';

type Counts = ReturnType<typeof summarizeNativeRequests>;
/** Diagnostic source locations only: no function names, absolute paths, error
 * messages, request paths, arguments, credentials or content may be emitted. */

/** Explicit opt-in, synthetic transport only. Counts are conserved even when a
 * stack is unavailable or the group bound is reached. This is attribution, not
 * an authorization cache or a provider-delay/p95 benchmark. */
export function createIdentityRequestProfile(transport: typeof fetch) {
  const empty = () => ({ ...summarizeNativeRequests([]) });
  type Group = { frames: string[]; origins: readonly string[]; counts: Counts; attempts: number };
  let active: { groups: Map<string, Group>; attempts: number; captureErrors: number; overflow: number } | undefined;
  let outsideWindows = 0;
  const measured: typeof fetch = (input, init) => {
    if (active) {
      active.attempts++;
      let frames: string[] = [], category: keyof Counts = 'other';
      try {
        const prior = Error.stackTraceLimit;
        try { Error.stackTraceLimit = 64; frames = identityRequestFrames(new Error().stack); }
        finally { Error.stackTraceLimit = prior; }
      } catch { active.captureErrors++; }
      try {
        const counts = summarizeNativeRequests([{ path: new URL(input instanceof Request ? input.url : String(input)).pathname,
          method: init?.method ?? (input instanceof Request ? input.method : 'GET') }]);
        category = (Object.keys(counts) as Array<keyof Counts>).find(k => counts[k])!;
      } catch {}
      let origins = identityRequestOrigins(), key = JSON.stringify([frames, origins]);
      // Reserve the last of 512 slots for unattributed overflow; retain counts.
      if (!active.groups.has(key) && active.groups.size >= 511) { key = 'overflow'; frames = []; origins = []; active.overflow++; }
      let group = active.groups.get(key);
      if (!group) { group = { frames, origins, counts: empty(), attempts: 0 }; active.groups.set(key, group); }
      group.attempts++; (group.counts as Record<keyof Counts, number>)[category]++;
    } else outsideWindows++;
    return transport(input, init);
  };
  return {
    transport: measured,
    outsideWindows: () => outsideWindows,
    begin() {
      if (active) throw new Error('Synthetic profile already active.');
      const window = { groups: new Map<string, Group>(), attempts: 0, captureErrors: 0, overflow: 0 }; active = window;
      return { finish() {
        if (active !== window) throw new Error('Synthetic profile is closed.'); active = undefined;
        const groups = [...window.groups.values()].map(g => Object.freeze({ frames: Object.freeze([...g.frames]), origins: Object.freeze([...g.origins]),
          counts: Object.freeze({ ...g.counts }), attempts: g.attempts })).sort((a, b) => b.attempts - a.attempts);
        return Object.freeze({ attempts: window.attempts, captureErrors: window.captureErrors, overflow: window.overflow,
          groups: Object.freeze(groups) });
      } };
    },
  };
}
