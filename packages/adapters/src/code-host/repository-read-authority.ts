type Current = () => Promise<void>;
const authorities = new WeakMap<Function, Current>();

/** Private construction proof, not a permission/result cache. Only a bound,
 * argument-independent current-policy callback belongs here. The returned read
 * actually invokes it on both sides of every successful read. Owner guards are
 * synchronous lifetime/deadline bookkeeping, never additional policy or I/O. */
export function bracketRepositoryRead<A extends unknown[], T>(current: Current,
  work: (...args: A) => Promise<T>, guard: () => void,
  policy?: { before(...args: A): Promise<void>; after(...args: A): Promise<void> }) {
  const before = policy?.before, after = policy?.after;
  if (policy && (typeof before !== 'function' || typeof after !== 'function')) throw new Error('Repository read authority unavailable.');
  const read = async function (this: unknown, ...args: A): Promise<T> {
    const pinned = [...args] as A;
    guard();
    // Optional independent read-grant queries contain no source IO or effects.
    // Run caller authority AFTER each query, immediately before source dispatch
    // and before returning bytes. This avoids nesting another full caller pair
    // around those policy-only queries; no decision or grant is reused.
    if (before) {
      if (await Reflect.apply(before, policy, pinned) !== undefined) throw new Error('Repository read authority unavailable.');
      guard();
    }
    if (await current() !== undefined) throw new Error('Repository read authority unavailable.');
    guard();
    const value = await Reflect.apply(work, this, pinned);
    guard();
    if (after) {
      if (await Reflect.apply(after, policy, pinned) !== undefined) throw new Error('Repository read authority unavailable.');
      guard();
    }
    if (await current() !== undefined) throw new Error('Repository read authority unavailable.');
    guard();
    return value;
  };
  authorities.set(read, current);
  return Object.freeze(read);
}

/** Exact identities only. Wrapping, binding, copying properties or supplying an
 * equivalent-looking callback cannot claim that the caller's policy ran. This
 * module is deliberately absent from the package's public exports. */
export function repositoryReadCovers(read: Function, current: Function): boolean {
  return authorities.has(read) && authorities.get(read) === current;
}
