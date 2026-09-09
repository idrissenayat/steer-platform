import { intentScopeReadInputSchema, verifyIntentScopeReadOutput,
  type IntentScopeReader, type IntentScopeReadInput, type IntentScopeReadOutput } from '@steer/tool-registry/intent-scope-read-contracts';
import { developmentOriginalHash as hash, freezeOriginal as freeze } from './development-original-contracts.ts';

const unavailable = () => new Error('Current scope validation is unavailable.');
/** ONE private, read-only pre-effect validation. A full current read brackets
 * intermediate exact-lineage reuse; every reuse still checks caller authority.
 * The full final read must agree before the caller may perform any scheduler RPC.
 * Never wrap scheduling/dispatch itself, share between revalidation callbacks,
 * accept history/expired results, or treat the snapshot as a grant. */
export async function withCurrentScopeReadWindow<T>(reader: IntentScopeReader | undefined, current: () => Promise<void>,
  work: (reader: IntentScopeReader | undefined) => Promise<T>): Promise<T> {
  let closed = false, failed = false, reading = false;
  const scope = reader?.scope, pinned = hash(scope ?? null), read = reader?.read;
  let target: IntentScopeReadInput | undefined, captured: IntentScopeReadOutput | undefined, sourceCurrent: (() => Promise<void>) | undefined;
  const guard = () => { if (closed || failed || (reader && (reader.scope !== scope || hash(reader.scope) !== pinned || reader.read !== read))) throw unavailable(); };
  const check = async (callback: () => Promise<void>) => { guard(); if (typeof callback !== 'function' || await callback() !== undefined) throw unavailable(); guard(); };
  const present = async (callback: () => Promise<void>) => { await check(current); await check(callback); await check(current); };
  const inspect = async (input: IntentScopeReadInput, callback: () => Promise<void>) => {
    await present(callback);
    const value = await verifyIntentScopeReadOutput(await read!.call(reader, input, () => present(callback)));
    await present(callback);
    if (value.subject !== scope!.subject || value.status !== 'review-available' || value.source.latestRevision !== value.source.revision
      || (['organizationId', 'productId', 'repository', 'reviewId', 'preparationDigest'] as const).some(k => value[k] !== input[k])) throw unavailable();
    return freeze(value);
  };
  const port: IntentScopeReader | undefined = reader ? { scope: freeze(structuredClone(scope!)),
    async read(raw, callback) {
      try {
        guard(); if (reading) throw unavailable(); reading = true;
        const input = freeze(intentScopeReadInputSchema.parse(raw));
        if ((['organizationId', 'productId', 'repository'] as const).some(k => input[k] !== scope![k])
          || (target && hash(target) !== hash(input))) throw unavailable();
        await present(callback);
        if (!captured) { target = input; captured = await inspect(input, callback); sourceCurrent = callback; }
        await present(callback); return captured;
      } catch { failed = true; throw unavailable(); }
      finally { reading = false; }
    },
  } : undefined;
  try {
    await check(current); const result = await work(port); await check(current);
    if (reading) throw unavailable();
    // Full current source/records/key/profile/expiry/observation checks again,
    // not merely a client hash or historical-scope proof. No effect has occurred.
    if (captured && hash(await inspect(target!, sourceCurrent!)) !== hash(captured)) throw unavailable();
    await check(current); return result;
  } catch { throw unavailable(); }
  finally { closed = true; captured = undefined; target = undefined; sourceCurrent = undefined; }
}
