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
const metadata = new WeakMap<Function, { current: Current; query: Function }>();
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
    const pending = Promise.resolve().then(() => { guard(); return Reflect.apply(callback, receiver, pinned); });
    void pending.catch(() => {});
    if (await track(pending) !== undefined || await pending !== undefined) throw fail(); guard();
  };
  const current = barriers.get(callback);
  if (current) barriers.set(forward, current);
  const policy = metadata.get(callback);
  if (policy) metadata.set(forward, { current: policy.current, query: async () => {
    guard();
    const pending = Promise.resolve().then(() => { guard(); return Reflect.apply(policy.query, receiver, pinned); });
    void pending.catch(() => {});
    if (await track(pending) !== undefined || await pending !== undefined) throw fail(); guard();
  } });
  return forward;
}

/** Explicit permission-only source policy. Ordinary calls keep both caller
 * barriers. Only an already-authenticated private read window can select the
 * metadata path: execute the actual policy, then freshly check the caller BEFORE
 * data access/continuation. No content IO, key fetch or effect belongs in policy.
 * This construction proof is not inferred from generic bracketed callbacks. */
export function bracketHistoricalReadPolicyAuthority<A extends unknown[]>(current: Current,
  policy: (...args: A) => Promise<unknown>, track: Track, guard: () => void): (...args: A) => Promise<void> {
  const callback = bracketHistoricalReadAuthority(current, policy, track, guard);
  metadata.set(callback, { current, query: async (...args: A) => {
    guard();
    const pending = Promise.resolve().then(() => { guard(); return policy(...args); });
    void pending.catch(() => {});
    if (await track(pending) !== undefined || await pending !== undefined) throw fail(); guard();
    if (await current() !== undefined) throw fail(); guard();
  } });
  return callback;
}

/** Absent for copied, generic or differently scoped callbacks. The enclosing
 * read window still owns initial authentication, guards and final full readback. */
export function historicalReadPolicyQuery(callback: Current, current: Current): Current | undefined {
  const policy = metadata.get(callback);
  return policy?.current === current ? () => policy.query() : undefined;
}

export function historicalReadAuthorityCovers(callback: Function, current: Current): boolean {
  return barriers.has(callback) && barriers.get(callback) === current;
}
