type Current = () => Promise<void>;
type Track = <T>(pending: Promise<T>) => Promise<T>;
const unavailable = () => new Error('Read policy authority is unavailable.');

/** Private composition for permission-only metadata queries. The owner must
 * authenticate before entering its work and retain checked() around content IO,
 * keys, SDK verification and effects. Each policy still runs, followed by fresh
 * caller validation before SQL/data access or any continuation. No principal,
 * decision or result is cached; this does not prove a before/after read bracket.
 * Track and guard are trusted owner admission/drain bookkeeping, not policies.
 */
export function createReadPolicyAuthority(current: Current, track: Track, guard: () => void) {
  return async (action: string, policy: () => Promise<void>): Promise<void> => {
    guard();
    if (action !== 'read') throw unavailable();
    const pending = Promise.resolve().then(() => { guard(); return policy(); });
    // Observe late rejection; a tracker resolving early cannot grant unfinished work.
    void pending.catch(() => {});
    if (await track(pending) !== undefined || await pending !== undefined) throw unavailable();
    guard();
    if (await current() !== undefined) throw unavailable();
    guard();
  };
}
