/** Private construction identity for current-only, read-only caller barriers.
 * Never a grant/result cache. Forwarding may add owner bookkeeping only, not
 * another policy or IO boundary. Historical proofs are deliberately separate. */
type Current = () => Promise<void>;
type Track = <T>(pending: Promise<T>) => Promise<T>;
const barriers = new WeakMap<Function, Current>();
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
  return Object.freeze(forward);
}

export function currentReadAuthorityCovers(callback: Function, current: Current): boolean {
  return barriers.has(callback) && barriers.get(callback) === current;
}
