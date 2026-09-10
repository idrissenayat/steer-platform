import { developmentOriginalHash as hash } from './development-original-contracts.ts';

type Current = () => Promise<void>;
type Read = () => Promise<unknown>;
type Work = (read: Read) => Promise<void>;
type Run = (input: unknown, current: Current, work: Work) => Promise<void>;
const owners = new WeakMap<Function, { scope: string; run: Run }>();
const fail = () => new Error('Draft read session is unavailable.');

/** Private constructor registration, not a request option or a grant. A producer
 * owns fresh read-purpose checks and full final records/key verification. Only
 * trusted read-only computations belong inside this phase, never effects. */
export function registerDraftReadSession(method: Function, scope: unknown, run: Run) {
  if (owners.has(method)) throw fail();
  owners.set(method, { scope: hash(scope), run });
}

export async function withDraftReadSession<T>(reader: { scope: unknown; read: Function }, input: unknown,
  current: Current, work: (read: () => Promise<T>) => Promise<void>): Promise<void> {
  const method = reader.read, scope = reader.scope, digest = hash(scope), owner = owners.get(method);
  const tasks = new Set<Promise<unknown>>(), windows = new Set<Promise<unknown>>();
  let ended = false, failed = false, invoked = false, reading = false, consumed = false;
  const guard = () => { if (ended || failed || reader.read !== method || reader.scope !== scope || hash(scope) !== digest
    || owner && owner.scope !== digest) throw fail(); };
  const run = (read: Read) => {
    if (invoked || typeof read !== 'function') { failed = true; const denied = Promise.reject(fail()); void denied.catch(() => {}); return denied; } invoked = true;
    const window = Promise.resolve().then(async () => {
    guard();
    const consume = () => {
      if (reading || ended || failed) { failed = true; const denied = Promise.reject(fail()); void denied.catch(() => {}); return denied; }
      reading = true;
      const task = Promise.resolve().then(async () => { guard(); const value = await read(); guard(); consumed = true; return value as T; })
        .catch(error => { failed = true; throw error; }).finally(() => { reading = false; });
      tasks.add(task); void task.finally(() => tasks.delete(task)).catch(() => {}); return task;
    };
    if (await work(consume) !== undefined || reading || tasks.size || !consumed) { failed = true; throw fail(); } guard();
    }).catch(error => { failed = true; throw error; });
    windows.add(window); void window.finally(() => windows.delete(window)).catch(() => {}); return window;
  };
  try {
    guard(); if (typeof current !== 'function' || typeof work !== 'function') throw fail();
    const result = owner ? await owner.run(input, current, run) : await run(() => Reflect.apply(method, reader, [input, current]));
    guard(); if (result !== undefined || !invoked || reading || tasks.size || windows.size || !consumed) throw fail();
  } catch { failed = true; throw fail(); }
  finally { ended = true; await Promise.allSettled([...windows]); await Promise.allSettled([...tasks]); }
}
