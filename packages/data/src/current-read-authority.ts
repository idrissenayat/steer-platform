/** Private construction identity for current-only, read-only caller barriers.
 * Never a grant/result cache. Forwarding may add owner bookkeeping only, not
 * another policy or IO boundary. Historical proofs are deliberately separate. */
type Current = () => Promise<void>;
type Track = <T>(pending: Promise<T>) => Promise<T>;
const barriers = new WeakMap<Function, Current>();
const metadata = new WeakMap<Function, { current: Current; query: Function }>();
const unavailable = () => new Error('Current read authority is unavailable.');

export function bracketCurrentReadAuthority<A extends unknown[]>(current: Current,
  policy: (...args: A) => Promise<unknown>, track: Track, guard: () => void): (...args: A) => Promise<void> {
  const callback = async (...args: A) => {
    guard(); if (await current() !== undefined) throw unavailable(); guard();
    const pending = Promise.resolve().then(() => { guard(); return Reflect.apply(policy, undefined, args); });
    void pending.catch(() => {});
    if (await track(pending) !== undefined || await pending !== undefined) throw unavailable(); guard();
    if (await current() !== undefined) throw unavailable(); guard();
  };
  barriers.set(callback, current);
  return Object.freeze(callback);
}

export function forwardCurrentReadAuthority<A extends unknown[]>(callback: (...args: A) => Promise<unknown>,
  args: A, track: Track, guard: () => void, receiver?: unknown): Current {
  const pinned = [...args] as A;
  const forward = async () => {
    guard();
    const pending = Promise.resolve().then(() => { guard(); return Reflect.apply(callback, receiver, pinned); });
    void pending.catch(() => {});
    if (await track(pending) !== undefined || await pending !== undefined) throw unavailable(); guard();
  };
  const current = barriers.get(callback);
  if (current) barriers.set(forward, current);
  const policy = metadata.get(callback);
  if (policy) metadata.set(forward, { current: policy.current, query: async () => {
    guard();
    const pending = Promise.resolve().then(() => { guard(); return Reflect.apply(policy.query, receiver, pinned); });
    void pending.catch(() => {});
    if (await track(pending) !== undefined || await pending !== undefined) throw unavailable(); guard();
  } });
  return Object.freeze(forward);
}

/** Explicit permission-only current-source policy. Ordinary invocation retains
 * both caller barriers. An already-authenticated private read window may instead
 * run the policy followed by a fresh caller check BEFORE data IO/continuation.
 * The policy must contain no content/key reads, mutation or scheduling effects.
 * Generic brackets, historical proofs and copied functions cannot select it. */
export function bracketCurrentReadPolicyAuthority<A extends unknown[]>(current: Current,
  policy: (...args: A) => Promise<unknown>, track: Track, guard: () => void): (...args: A) => Promise<void> {
  const callback = bracketCurrentReadAuthority(current, policy, track, guard);
  metadata.set(callback, { current, query: async (...args: A) => {
    guard();
    const pending = Promise.resolve().then(() => { guard(); return Reflect.apply(policy, undefined, args); });
    void pending.catch(() => {});
    if (await track(pending) !== undefined || await pending !== undefined) throw unavailable(); guard();
    if (await current() !== undefined) throw unavailable(); guard();
  } });
  return callback;
}

/** No result or permission cache; exact construction and caller identity only.
 * The consuming window owns initial authentication, guard and final readback. */
export function currentReadPolicyQuery(callback: Current, current: Current): Current | undefined {
  const policy = metadata.get(callback);
  return policy && policy.current === current ? Object.freeze(async () => {
    if (await Reflect.apply(policy.query, undefined, []) !== undefined) throw unavailable();
  }) : undefined;
}

export function currentReadAuthorityCovers(callback: Function, current: Current): boolean {
  return barriers.has(callback) && barriers.get(callback) === current;
}
