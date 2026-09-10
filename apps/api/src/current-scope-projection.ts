import { intentScopeReadInputSchema, verifyIntentScopeReadOutput,
  type IntentScopeReader } from '@steer/tool-registry/intent-scope-read-contracts';

const unavailable = () => new Error('Current scope projection is unavailable.');
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value;
}
/** Private read-only consumption of an already verified, still-owned scope lease.
 * This helper does NOT finalize that lease: the producer must recheck its complete
 * records, keys, policies and source after this resolves, before returning from
 * its enclosing phase. Never use the callback for scheduling or other effects. */
export async function withCurrentScopeProjection(raw: unknown, current: () => Promise<void>, check: () => void,
  work: (reader: IntentScopeReader) => Promise<void>, authorize?: () => Promise<void>): Promise<void> {
  let closed = false, failed = false, reading = false, consumed = false;
  const tasks = new Set<Promise<unknown>>();
  const guard = () => { if (closed || failed) throw unavailable(); check(); };
  const present = async (callback: () => Promise<void>) => {
    guard(); if (typeof callback !== 'function' || await callback() !== undefined) throw unavailable(); guard();
  };
  // The producer supplies independent metadata-only purpose queries. This
  // helper itself calls the exact caller afterwards, before reuse/continuation.
  // No query, caller result, key or content read is cached or skipped.
  const ownerCurrent = async () => { if (authorize) await present(authorize); await present(current); };
  try {
    if (typeof current !== 'function' || typeof check !== 'function' || typeof work !== 'function'
      || (authorize !== undefined && typeof authorize !== 'function')) throw unavailable();
    await ownerCurrent();
    const value = freeze(await verifyIntentScopeReadOutput(raw)); guard();
    if (value.status !== 'review-available' || value.source.latestRevision !== value.source.revision) throw unavailable();
    const target = intentScopeReadInputSchema.parse({ organizationId: value.organizationId, productId: value.productId,
      repository: value.repository, reviewId: value.reviewId, preparationDigest: value.preparationDigest });
    const scope = freeze({ organizationId: value.organizationId, subject: value.subject, productId: value.productId, repository: value.repository });
    const reader: IntentScopeReader = Object.freeze({ scope, read(input: unknown, callback: () => Promise<void>) {
      if (closed || failed || reading) { failed = true; const denied = Promise.reject(unavailable()); void denied.catch(() => {}); return denied; }
      reading = true;
      const task = Promise.resolve().then(async () => {
        guard(); const requested = intentScopeReadInputSchema.parse(input);
        if ((['organizationId', 'productId', 'repository', 'reviewId', 'preparationDigest'] as const).some(key => requested[key] !== target[key])) throw unavailable();
        await ownerCurrent();
        // The exact parent callback just ran here. Unknown or independent
        // callbacks still run between two freshly authorized owner boundaries.
        if (callback !== current) { await present(callback); await ownerCurrent(); }
        consumed = true; return value;
      }).catch(() => { failed = true; throw unavailable(); }).finally(() => { reading = false; });
      tasks.add(task); void task.finally(() => tasks.delete(task)).catch(() => {}); return task;
    } });
    if (await work(reader) !== undefined || failed || !consumed || reading || tasks.size) throw unavailable();
    await ownerCurrent();
  } catch { throw unavailable(); }
  finally { closed = true; await Promise.allSettled([...tasks]); }
}

/** Delay opening an owned scope lease until its first real consumption. This
 * keeps dependent preview authorization ahead of scope IO while retaining the
 * producer through final native comparison and actual drainage. No effects. */
export async function withLazyCurrentScopeProjection(scope: IntentScopeReader['scope'], rawTarget: unknown,
  current: () => Promise<void>, check: () => void,
  open: (input: Parameters<IntentScopeReader['read']>[0], current: () => Promise<void>, work: (reader: IntentScopeReader) => Promise<void>) => Promise<void>,
  work: (reader: IntentScopeReader) => Promise<void>): Promise<void> {
  const target = freeze(intentScopeReadInputSchema.parse(rawTarget)), identity = JSON.stringify(scope);
  let ended = false, failed = false, reading = false, consumed = false, closing = false, invoked = false;
  let borrowed: IntentScopeReader | undefined, method: IntentScopeReader['read'] | undefined, producer: Promise<void> | undefined;
  let ready!: () => void, unavailableReady!: (reason: unknown) => void, release!: () => void;
  const available = new Promise<void>((resolve, reject) => { ready = resolve; unavailableReady = reject; }); void available.catch(() => {});
  const completed = new Promise<void>(resolve => { release = resolve; }), pending = new Set<Promise<unknown>>();
  const guard = () => { if (ended || failed) throw unavailable(); check(); };
  const port: IntentScopeReader = Object.freeze({ scope: freeze(structuredClone(scope)), read(raw: unknown, callback: () => Promise<void>) {
    if (ended || failed || reading || closing) { failed = true; const denied = Promise.reject(unavailable()); void denied.catch(() => {}); return denied; }
    reading = true;
    const task = Promise.resolve().then(async () => {
      guard(); const input = intentScopeReadInputSchema.parse(raw);
      if (JSON.stringify(input) !== JSON.stringify(target) || typeof callback !== 'function') throw unavailable();
      if (!producer) {
        producer = Promise.resolve().then(async () => {
          guard();
          const returned = await open(target, current, async reader => {
            guard(); if (invoked || !reader || typeof reader.read !== 'function' || JSON.stringify(reader.scope) !== identity) { failed = true; throw unavailable(); }
            invoked = true; borrowed = reader; method = reader.read; ready(); await completed; guard();
          });
          guard(); if (returned !== undefined || !invoked) throw unavailable();
        }).catch(error => { failed = true; unavailableReady(error); throw error; });
        void producer.catch(() => {});
      }
      await available; guard();
      if (!borrowed || borrowed.read !== method || JSON.stringify(borrowed.scope) !== identity) throw unavailable();
      const result = await Reflect.apply(method!, borrowed, [input, callback]); guard(); consumed = true; return result;
    }).catch(error => { failed = true; throw error; }).finally(() => { reading = false; });
    pending.add(task); void task.finally(() => pending.delete(task)).catch(() => {}); return task;
  } });
  try {
    guard(); const returned = await work(port); closing = true;
    if (returned !== undefined || !consumed || reading || pending.size || failed || !producer) throw unavailable();
    release(); await producer; guard();
  } catch { throw unavailable(); }
  finally { closing = true; ended = true; release(); await producer?.catch(() => {}); await Promise.allSettled([...pending]); }
}
