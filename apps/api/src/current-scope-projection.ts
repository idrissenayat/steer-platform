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
  work: (reader: IntentScopeReader) => Promise<void>): Promise<void> {
  let closed = false, failed = false, reading = false, consumed = false;
  const tasks = new Set<Promise<unknown>>();
  const guard = () => { if (closed || failed) throw unavailable(); check(); };
  const present = async (callback: () => Promise<void>) => {
    guard(); if (typeof callback !== 'function' || await callback() !== undefined) throw unavailable(); guard();
  };
  try {
    if (typeof current !== 'function' || typeof check !== 'function' || typeof work !== 'function') throw unavailable();
    await present(current);
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
        await present(current); await present(callback); await present(current); consumed = true; return value;
      }).catch(() => { failed = true; throw unavailable(); }).finally(() => { reading = false; });
      tasks.add(task); void task.finally(() => tasks.delete(task)).catch(() => {}); return task;
    } });
    if (await work(reader) !== undefined || failed || !consumed || reading || tasks.size) throw unavailable();
    await present(current);
  } catch { throw unavailable(); }
  finally { closed = true; await Promise.allSettled([...tasks]); }
}
