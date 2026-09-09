import { developmentOriginalHash as hash } from './development-original-contracts.ts';

type Current = () => Promise<void>;
type Read = (current: Current) => Promise<unknown>;
type Work = (read: Read) => Promise<void>;
type Run = (input: unknown, current: Current, work: Work) => Promise<void>;
type Track = <T>(pending: Promise<T>) => Promise<T>;
const sessions = new WeakMap<Function, { scopeDigest: string; run: Run }>();
const fail = () => new Error('Review read session is unavailable.');

/** Private construction proof, absent from package exports and request DTOs.
 * A registered owner must preserve full review semantics and share only immutable
 * evidence within one read-only computation, never across effects or requests. */
export function registerReviewReadSession(method: Function, scope: unknown, run: Run) {
  if (sessions.has(method)) throw fail();
  sessions.set(method, { scopeDigest: hash(scope), run });
}

export async function withReviewReadSession(reader: { scope: unknown; review: Function }, input: unknown,
  current: Current, work: Work, track: Track, guard: () => void): Promise<void> {
  const method = reader.review, scope = reader.scope, scopeDigest = hash(scope), registered = sessions.get(method);
  let closed = false, failed = false, invoked = false, completed = false, reading = false, reads = 0;
  const pending = new Set<Promise<unknown>>();
  const check = () => {
    guard(); if (closed || failed || reader.review !== method || reader.scope !== scope || hash(reader.scope) !== scopeDigest
      || (registered && registered.scopeDigest !== scopeDigest)) throw fail();
  };
  const present = async (callback: Current) => { check(); if (typeof callback !== 'function' || await callback() !== undefined) throw fail(); check(); };
  const run = (read: Read) => {
    if (invoked || typeof read !== 'function') { failed = true; const rejected = Promise.reject(fail()); void rejected.catch(() => {}); return rejected; }
    invoked = true;
    const readCurrent: Read = callback => {
      if (reading) { failed = true; const rejected = Promise.reject(fail()); void rejected.catch(() => {}); return rejected; }
      reading = true; reads++;
      const task = Promise.resolve().then(async () => {
        await present(callback);
        const value = await read(() => present(callback));
        await present(callback); return value;
      }).catch(error => { failed = true; throw error; });
      pending.add(task); void task.finally(() => { reading = false; pending.delete(task); }).catch(() => {});
      const tracked = (async () => { await track(task); const value = await task; check(); return value; })()
        .catch(error => { failed = true; throw error; });
      void tracked.catch(() => {}); return tracked;
    };
    const task = Promise.resolve().then(async () => {
      check(); if (await work(readCurrent) !== undefined) throw fail(); check();
      if (reading) throw fail(); completed = true;
    }).catch(error => { failed = true; throw error; });
    pending.add(task); void task.finally(() => pending.delete(task)).catch(() => {});
    const tracked = (async () => { if (await track(task) !== undefined) throw fail(); await task; check(); })()
      .catch(error => { failed = true; throw error; });
    void tracked.catch(() => {}); return tracked;
  };
  try {
    await present(current);
    const task = Promise.resolve().then(() => registered ? registered.run(input, () => present(current), run)
      : run(callback => Reflect.apply(method, reader, [input, callback])));
    void task.catch(() => {});
    if (await track(task) !== undefined || await task !== undefined) throw fail();
    check(); if (!invoked || !completed || !reads || reading || pending.size) throw fail(); await present(current);
  } finally { closed = true; }
}
