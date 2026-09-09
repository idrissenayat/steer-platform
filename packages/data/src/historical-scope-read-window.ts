import { intentScopeHistoryInputSchema, verifyIntentScopeHistoryOutput,
  type IntentScopeHistoryReader, type IntentScopeHistoryInput, type IntentScopeHistoryOutput } from '@steer/tool-registry/intent-scope-history-contracts';
import { developmentOriginalHash as hash, freezeOriginal as freeze } from './development-original-contracts.ts';
import { historicalReadAuthorityCovers, historicalReadPolicyQuery } from './historical-read-authority.ts';

const unavailable = () => new Error('Historical scope read is unavailable.');
/** Private composition boundary for ONE read-only generation-history projection.
 * Intermediate lineage checks reuse one verified immutable assessment, but still
 * invoke their caller's current authority. Nothing may escape work (or perform
 * writes/dispatch) before a second FULL authoritative scope read agrees. This is
 * not a current-assessment port, grant cache, cross-request cache or deadline.
 * The enclosing history reader owns cancellation, resources and its 30s bound.
 */
export async function withHistoricalScopeReadWindow<T>(reader: IntentScopeHistoryReader | undefined,
  current: () => Promise<void>, work: (reader: IntentScopeHistoryReader | undefined) => Promise<T>): Promise<T> {
  let closed = false, failed = false, reading = false;
  const scope = reader?.scope, scopeDigest = hash(scope ?? null), read = reader?.read;
  let target: IntentScopeHistoryInput | undefined, captured: IntentScopeHistoryOutput | undefined;
  let sourceCurrent: (() => Promise<void>) | undefined;
  const guard = () => {
    if (closed || failed || (reader && (reader.scope !== scope || hash(reader.scope) !== scopeDigest || reader.read !== read))) throw unavailable();
  };
  const check = async (callback: () => Promise<void>) => {
    guard(); if (typeof callback !== 'function' || await callback() !== undefined) throw unavailable(); guard();
  };
  const present = async (callback: () => Promise<void>) => {
    // Initial caller validation already ran at window entry. An explicitly
    // proven metadata-only source query may run first, followed by fresh caller
    // validation before any content/SQL/key work or result continuation. Ordinary
    // generic brackets retain their full path; no permission is cached.
    const query = historicalReadPolicyQuery(callback, current);
    if (query) { await check(query); return; }
    // A privately constructed callback already brackets its exact source policy
    // with this SAME caller check. Do not repeat that barrier without another IO
    // or policy boundary. Unknown/copied/differently scoped callbacks stay full.
    if (historicalReadAuthorityCovers(callback, current)) await check(callback);
    else { await check(current); await check(callback); await check(current); }
  };
  const inspect = async (input: IntentScopeHistoryInput, callback: () => Promise<void>) => {
    await present(callback);
    const value = await verifyIntentScopeHistoryOutput(await read!.call(reader, input, () => present(callback)));
    await present(callback);
    if (value.subject !== scope!.subject || (['organizationId', 'productId', 'repository', 'reviewId', 'preparationDigest'] as const)
      .some(k => value[k] !== input[k])) throw unavailable();
    return freeze(value);
  };
  const port: IntentScopeHistoryReader | undefined = reader ? {
    scope: freeze(structuredClone(scope!)),
    async read(raw, callback) {
      try {
        guard(); if (reading) throw unavailable();
        reading = true;
        const input = freeze(intentScopeHistoryInputSchema.parse(raw));
        if ((['organizationId', 'productId', 'repository'] as const).some(k => input[k] !== scope![k])
          || (target && hash(target) !== hash(input))) throw unavailable();
        await present(callback);
        if (!captured) { target = input; captured = await inspect(input, callback); sourceCurrent = callback; }
        await present(callback);
        return captured;
      } catch { failed = true; throw unavailable(); }
      finally { reading = false; }
    },
  } : undefined;
  try {
    await check(current);
    const result = await work(port);
    await check(current);
    if (reading) throw unavailable(); // Unawaited private work cannot be finalized.
    if (captured) {
      // Re-open original, keys, records/lifecycle, batch observations and profile
      // authority through the actual reader. A cached digest never authorizes it.
      const final = await inspect(target!, sourceCurrent!);
      const { reviewExpired: wasExpired, ...before } = captured;
      const { reviewExpired: nowExpired, ...after } = final;
      // Historical execution expiry may pass while reading; it cannot be renewed.
      if (hash(before) !== hash(after) || (wasExpired && !nowExpired)) throw unavailable();
    }
    await check(current);
    return result;
  } catch { throw unavailable(); }
  finally { closed = true; target = undefined; captured = undefined; sourceCurrent = undefined; }
}
