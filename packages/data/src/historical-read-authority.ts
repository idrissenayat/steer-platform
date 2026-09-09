/** Private proof of a callback's construction, not a permission/result cache.
 * Only callbacks created here can prove they bracket their policy with the exact
 * same current-caller function. Forwarding preserves that proof only while still
 * invoking the original callback, with the owner's guards and pending-work lease.
 * Track/guard are trusted owner bookkeeping, not extra IO or policy callbacks.
 * Forwarding across a new authority/IO boundary must remain unrecognized.
 * Nothing is exported through the package/HTTP tool surface. */
type Current = () => Promise<void>;
type Track = <T>(pending: Promise<T>) => Promise<T>;
const barriers = new WeakMap<Function, Current>();
const fail = () => new Error('Historical read authority is unavailable.');

export function bracketHistoricalReadAuthority<A extends unknown[]>(current: Current,
  policy: (...args: A) => Promise<unknown>, track: Track, guard: () => void): (...args: A) => Promise<void> {
  const callback = async (...args: A) => {
    guard(); if (await current() !== undefined) throw fail(); guard();
    const pending = Promise.resolve().then(() => { guard(); return policy(...args); });
    // Observe late failure even when an owner tracker rejects before work drains.
    void pending.catch(() => {});
    if (await track(pending) !== undefined || await pending !== undefined) throw fail(); guard();
    if (await current() !== undefined) throw fail(); guard();
  };
  barriers.set(callback, current);
  return callback;
}

export function forwardHistoricalReadAuthority<A extends unknown[]>(callback: (...args: A) => Promise<unknown>,
  args: A, track: Track, guard: () => void, receiver?: unknown): Current {
  const pinned = [...args] as A;
  const forward = async () => {
    guard();
    const pending = Promise.resolve().then(() => { guard(); return callback.apply(receiver, pinned); });
    void pending.catch(() => {});
    if (await track(pending) !== undefined || await pending !== undefined) throw fail(); guard();
  };
  const current = barriers.get(callback);
  if (current) barriers.set(forward, current);
  return forward;
}

export function historicalReadAuthorityCovers(callback: Function, current: Current): boolean {
  return barriers.has(callback) && barriers.get(callback) === current;
}
