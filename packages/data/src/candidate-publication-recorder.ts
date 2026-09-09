import { z } from 'zod';
import { candidateSaveStatusInputSchema, candidateSaveStatusScopeSchema, verifyCandidateSaveStatus,
  type CandidateSaveStatusReader, type CandidateSaveStatusOutput } from '@steer/tool-registry/candidate-save-status-contracts';
import { candidateBundleReferenceSchema } from '@steer/tool-registry/candidate-bundle-contracts';
import { candidateOriginalConfigurationSchema } from './candidate-originals.ts';
import { createDraftLifecycleStore } from './draft-lifecycle.ts';
import { freezeOriginal as freeze } from './development-original-contracts.ts';
import type { DatabasePool } from './runtime-pool.ts';

const clockSchema = z.strictObject({ configuration: candidateOriginalConfigurationSchema,
  input: candidateSaveStatusInputSchema, reference: candidateBundleReferenceSchema,
  confirmationDigest: candidateBundleReferenceSchema.shape.manifestDigest, publishedAt: z.iso.datetime({ precision: 3 }) });
type Configuration = z.infer<typeof candidateOriginalConfigurationSchema>;
type Input = z.infer<typeof candidateSaveStatusInputSchema>;
type Receipt = Extract<CandidateSaveStatusOutput, { outcome: 'committed' }>;
type Context = Readonly<{ configuration: Configuration; input: Input }>;
type Result = { outcome: 'ok'; reference: Receipt['reference']; publishedAt: string; useUntil: string; held: boolean; expired: boolean }
  | { outcome: 'unavailable' | 'unknown' | 'conflict' };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const fail = () => new Error('Candidate publication record is unavailable.');

/** Uninstalled, explicit records action. Status remains read-only. The runtime
 * must supply an original-bound receipt reader, adopted records authority and an
 * independently verified, durable publication clock. Git author timestamps,
 * browser values and verification-time Date.now() are NOT clock fallbacks.
 * Provider reads finish before lifecycle SQL. This cannot publish, delete,
 * destroy keys, grant retry, release holds or adopt a records policy. */
export function createCandidatePublicationRecorder(pool: DatabasePool, rawConfiguration: unknown, dependencies: {
  status: CandidateSaveStatusReader;
  authorizeRecord(context: Context): Promise<void>;
  verifyPublicationClock(context: Context & Readonly<{ receipt: Receipt }>): Promise<unknown>;
}) {
  const configuration = freeze(candidateOriginalConfigurationSchema.parse(rawConfiguration));
  if ([dependencies.status?.read, dependencies.authorizeRecord, dependencies.verifyPublicationClock].some(v => typeof v !== 'function')) throw fail();
  const scope = freeze(candidateSaveStatusScopeSchema.parse(dependencies.status.scope));
  if ((['organizationId', 'subject', 'productId', 'repository', 'branch'] as const).some(k => scope[k] !== configuration[k])) throw fail();
  let closed = false, active = false;
  const children = new Set<ReturnType<typeof createDraftLifecycleStore>>();
  return { scope,
    async record(rawInput: unknown, revalidate: () => Promise<void>): Promise<Result> {
      const parsed = candidateSaveStatusInputSchema.safeParse(rawInput);
      if (!parsed.success || closed || active || typeof revalidate !== 'function') return { outcome: 'unavailable' };
      const input = freeze(parsed.data), context = freeze({ configuration, input });
      if ((['organizationId', 'productId', 'repository', 'branch'] as const).some(k => input[k] !== scope[k])) return { outcome: 'unavailable' };
      active = true;
      let finished = false, settled = false, pending = 0, attempted = false, verifiedAt: number | undefined;
      let lifecycle: ReturnType<typeof createDraftLifecycleStore> | undefined, timer: ReturnType<typeof setTimeout> | undefined;
      const release = () => { if (settled && !pending) active = false; };
      const guard = () => {
        if (closed || finished || !equal(candidateSaveStatusScopeSchema.parse(dependencies.status.scope), scope)) throw fail();
      };
      const tracked = async <T>(task: () => Promise<T>, timeout?: number): Promise<T> => {
        guard(); pending++;
        const work = Promise.resolve().then(() => { guard(); return task(); });
        void work.finally(() => { pending--; release(); }).catch(() => {});
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        try {
          const result = timeout === undefined ? await work : await Promise.race([work, new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(fail()), timeout);
          })]);
          guard(); return result;
        } finally { if (timeoutId) clearTimeout(timeoutId); }
      };
      const current = async () => { if (await tracked(revalidate, 5000) !== undefined) throw fail(); };
      const authorize = async () => {
        await current(); if (await tracked(() => dependencies.authorizeRecord(context), 5000) !== undefined) throw fail(); await current();
      };
      const fresh = () => { guard(); if (verifiedAt === undefined || performance.now() - verifiedAt >= 5000) throw fail(); };
      const work = Promise.resolve().then(async (): Promise<Result> => {
        await authorize();
        const read = async (): Promise<Receipt> => {
          const receipt = verifyCandidateSaveStatus(input, await tracked(() => dependencies.status.read(input, current)));
          await authorize();
          if (receipt.outcome !== 'committed' || !scope.itemIds.includes(receipt.reference.itemId)) throw fail();
          return freeze(receipt);
        };
        const clock = async (receipt: Receipt) => {
          const proof = freeze(clockSchema.parse(await tracked(() => dependencies.verifyPublicationClock(freeze({ ...context, receipt })), 5000)));
          if (!equal(proof.configuration, configuration) || !equal(proof.input, input) || !equal(proof.reference, receipt.reference)
            || proof.confirmationDigest !== receipt.confirmationDigest) throw fail();
          const observedAt = performance.now();
          await authorize(); return { proof, observedAt };
        };
        const receipt = await read(), firstClock = await clock(receipt), latest = await read();
        if (!equal(receipt, latest)) throw fail();
        const { proof, observedAt } = await clock(latest);
        if (!equal(firstClock.proof, proof)) throw fail();
        // Authorization latency consumes this proof's lifetime; it cannot renew
        // freshness merely because a later callback eventually returns.
        verifiedAt = observedAt; fresh();
        const target = freeze({ draftId: input.draftId, operationId: input.operationId, inputDigest: input.inputDigest });
        lifecycle = createDraftLifecycleStore({ connect: () => tracked(() => pool.connect().then(client => {
          try { fresh(); return client; } catch (error) { client.release(true); throw error; }
        })) }, configuration, {
          authorize: async ctx => {
            fresh(); if (ctx.action !== 'record-publication' || !equal(ctx.configuration, configuration) || !equal(ctx.request, target)) throw fail();
            await authorize(); fresh();
          },
          // Only this invocation's twice-verified evidence may cross into SQL.
          // No provider lookup occurs inside the existing five-second verifier.
          verifyPublication: async ctx => {
            fresh(); if (!equal(ctx.configuration, configuration) || !equal(ctx.request, target)) throw fail();
            return freeze({ ...target, publishedAt: proof.publishedAt });
          },
        });
        children.add(lifecycle); fresh(); attempted = true;
        const result = await tracked(() => lifecycle!.recordPublication(target));
        if (result.outcome !== 'ok') return result;
        fresh();
        if (result.value.publishedAt !== proof.publishedAt || result.value.publicationOperation !== input.operationId
          || result.value.publicationInput !== input.inputDigest) throw fail();
        return freeze({ outcome: 'ok', reference: receipt.reference, publishedAt: proof.publishedAt, useUntil: result.value.useUntil,
          held: result.value.held, expired: result.value.expired });
      });
      void work.finally(() => { settled = true; release(); }).catch(() => {});
      try { return await Promise.race([work, new Promise<Result>(resolve => { timer = setTimeout(() => resolve({ outcome: attempted ? 'unknown' : 'unavailable' }), 90000); })]); }
      catch { return { outcome: attempted ? 'unknown' : 'unavailable' }; }
      finally { finished = true; if (timer) clearTimeout(timer); if (lifecycle) { lifecycle.close(); children.delete(lifecycle); } }
    },
    close() { closed = true; children.forEach(child => child.close()); },
  };
}
