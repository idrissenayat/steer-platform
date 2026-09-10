/** Private construction identity for current-only, read-only caller barriers.
 * Never a grant/result cache. Forwarding may add owner bookkeeping only, not
 * another policy or IO boundary. Historical proofs are deliberately separate. */
type Current = () => Promise<void>;
type Track = <T>(pending: Promise<T>) => Promise<T>;
const barriers = new WeakMap<Function, Current>();
type Policy = { current: Current; query: Function; policy: Function; check: () => void };
const metadata = new WeakMap<Function, Policy>();
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
  const forwardPolicy = (method: Function) => async () => {
    guard();
    const pending = Promise.resolve().then(() => { guard(); return Reflect.apply(method, receiver, pinned); });
    void pending.catch(() => {});
    if (await track(pending) !== undefined || await pending !== undefined) throw unavailable(); guard();
  };
  if (policy) metadata.set(forward, { current: policy.current, query: forwardPolicy(policy.query), policy: forwardPolicy(policy.policy),
    check: () => { guard(); policy.check(); } });
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
  const permit = async (...args: A) => {
    guard();
    const pending = Promise.resolve().then(() => { guard(); return Reflect.apply(policy, undefined, args); });
    void pending.catch(() => {});
    if (await track(pending) !== undefined || await pending !== undefined) throw unavailable(); guard();
  };
  metadata.set(callback, { current, policy: permit, check: guard, query: async (...args: A) => {
    await permit(...args); if (await current() !== undefined) throw unavailable(); guard();
  } });
  return callback;
}

/** No result or permission cache; exact construction and caller identity only.
 * The consuming window owns initial authentication, guard and final readback. */
export function currentReadPolicyQuery(callback: Current, current: Current): Current | undefined {
  const policy = metadata.get(callback);
  if (!policy || policy.current !== current) return undefined;
  const query = Object.freeze(async () => {
    if (await Reflect.apply(policy.query, undefined, []) !== undefined) throw unavailable();
  });
  metadata.set(query, policy); return query;
}

/** Construction-only decomposition of a server-owned caller into its exact
 * parent and independent metadata policies. Ordinary invocation is unchanged.
 * The policy must contain every owner/record/key-purpose check, but no content,
 * key lookup, mutation or scheduling. Never register caller-provided functions.
 */
export function registerCurrentReadPolicyOwner(callback: Current, current: Current, policy: Current, check: () => void) {
  if ([callback, current, policy, check].some(value => typeof value !== 'function') || callback === current || metadata.has(callback)) throw unavailable();
  const query = async () => {
    check(); if (await policy() !== undefined) throw unavailable(); check();
    if (await current() !== undefined) throw unavailable(); check();
  };
  metadata.set(callback, { current, policy, check, query });
}

/** One authenticated, metadata-only boundary, not a cached caller decision.
 * Only exact constructed owners with the SAME parent can combine. Execute both
 * independent policies freshly, then their parent once, and recheck both owners
 * before any consumer can receive a value. Unknown/different-parent callbacks
 * deliberately return no composition and retain ordinary full boundaries.
 */
export function combineCurrentReadPolicyQueries(owner: Current, child: Current): Current | undefined {
  const first = metadata.get(owner), second = metadata.get(child);
  if (!first || !second || first.current !== second.current) return undefined;
  const check = () => { first.check(); second.check(); };
  const policy = async () => {
    check(); if (await Reflect.apply(first.policy, undefined, []) !== undefined) throw unavailable(); check();
    if (await Reflect.apply(second.policy, undefined, []) !== undefined) throw unavailable(); check();
  };
  const query = Object.freeze(async () => {
    await policy(); if (await first.current() !== undefined) throw unavailable(); check();
  });
  metadata.set(query, { current: first.current, policy, check, query }); return query;
}

export function currentReadAuthorityCovers(callback: Function, current: Current): boolean {
  return barriers.has(callback) && barriers.get(callback) === current;
}
