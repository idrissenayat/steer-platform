import { z } from 'zod';
import { candidateSaveStartInputSchema, candidateSaveStartOutputSchema, candidateSaveScheduleReceiptSchema,
  type CandidateSaveStarter, type CandidateSaveScheduler } from '@steer/tool-registry/candidate-save-start-contracts';
import { intentDraftReadOutputSchema, type IntentDraftService } from '@steer/tool-registry/intent-draft-contracts';
import { createCandidateAdmission, candidateAdmissionOptionsSchema, candidateRequestSchema } from './candidate-admission.ts';
import { createCandidateOriginalStore, candidateOriginalConfigurationSchema } from './candidate-originals.ts';
import { intentOperationConfigurationSchema } from './intent-operations.ts';
import { freezeOriginal as freeze } from './development-original-contracts.ts';
import type { DatabasePool } from './runtime-pool.ts';

const configuration = z.strictObject({ execution: intentOperationConfigurationSchema, records: candidateOriginalConfigurationSchema });
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const fail = () => new Error('Candidate save start is unavailable. Check the original save status before further action.');
/** Explicit, uninstalled start boundary. Reads only an existing admission and
 * encrypted original. It cannot prepare, renew, reserve, write Git or sign.
 * The trusted start port must verify current full-corpus/destination evidence,
 * exact human consent, publication/gate authority and records policy; hashes
 * and the browser's save flag cannot substitute for that authority. */
export function createCandidateSaveStarter(pools: { execution: DatabasePool; drafts: DatabasePool }, raw: unknown, rawOptions: unknown, deps: {
  drafts: IntentDraftService; scheduler: CandidateSaveScheduler;
  authorizeStart(original: Readonly<z.infer<typeof candidateRequestSchema>>): Promise<void>;
  authorizeOperation: Parameters<typeof createCandidateAdmission>[3];
  records: Omit<Parameters<typeof createCandidateOriginalStore>[2], 'verifyOriginal'>;
}) {
  const config = freeze(configuration.parse(raw)), options = freeze(candidateAdmissionOptionsSchema.parse(rawOptions));
  const { recordsPolicyDigest: _policy, ...scope } = config.records;
  if (config.execution.action !== 'candidate-save' || config.execution.budget !== null
    || (['organizationId', 'subject', 'productId', 'repository', 'branch', 'recordsPolicyDigest'] as const).some(k => config.execution[k] !== config.records[k])
    || [deps.drafts?.read, deps.scheduler?.start, deps.authorizeStart, deps.authorizeOperation,
      deps.records?.authorize, deps.records?.lifecycle, deps.records?.keyForDraft].some(v => typeof v !== 'function')) throw fail();
  let closed = false, active = 0; const children = new Set<{ close(): void }>();
  return { scope: freeze(scope),
    async start(rawInput, revalidate) {
      const input = freeze(candidateSaveStartInputSchema.parse(rawInput));
      const scopeChanged = () => (['organizationId', 'productId', 'repository', 'branch'] as const).some(k => input[k] !== scope[k])
        || (['organizationId', 'subject', 'productId', 'repository'] as const).some(k => deps.drafts.scope[k] !== scope[k]);
      if (closed || active >= 4 || typeof revalidate !== 'function' || scopeChanged()) throw fail();
      active++; let finished = false, settled = false, pending = 0, released = false, timer: ReturnType<typeof setTimeout> | undefined;
      const owned: { close(): void }[] = [], target = freeze({ organizationId: input.organizationId, operationId: input.operationId, inputDigest: input.inputDigest });
      const release = () => { if (settled && !pending && !released) { released = true; active--; } };
      const guard = () => { if (closed || finished || scopeChanged() || Date.now() >= Date.parse(config.execution.expiresAt)) throw fail(); };
      const track = async <T>(task: Promise<T>) => { pending++; try { return await task; } finally { pending--; release(); } };
      const current = async () => { guard(); if (await track(Promise.resolve().then(revalidate)) !== undefined) throw fail(); guard(); };
      const checked = async <T>(task: () => Promise<T>) => { await current(); const value = await track(Promise.resolve().then(task)); await current(); return value; };
      const authority = async (task: () => Promise<void>) => { if (await checked(task) !== undefined) throw fail(); };
      const own = <T extends { close(): void }>(store: T) => { owned.push(store); children.add(store); return store; };
      const pool = (source: DatabasePool): DatabasePool => ({ connect: async () => {
        guard(); const client = await track(source.connect());
        try { guard(); return client; } catch (error) { client.release(true); throw error; }
      } });
      const work = Promise.resolve().then(async () => {
        await current();
        const source = async (original: z.infer<typeof candidateRequestSchema>) => {
          if (original.confirmation.draftId !== input.draftId || original.confirmation.draftRevision !== input.draftRevision) throw fail();
          const draft = intentDraftReadOutputSchema.parse(await checked(() => deps.drafts.read({ organizationId: scope.organizationId,
            productId: scope.productId, repository: scope.repository, draftId: input.draftId, revision: 'latest' }, current)));
          if (draft.draftId !== input.draftId || draft.revision !== input.draftRevision || draft.latestRevision !== input.draftRevision
            || draft.scopeInputDigest !== original.bundle.scopeInputDigest || !equal(draft.content.documents, original.bundle.documents)) throw fail();
        };
        const admission = own(createCandidateAdmission(pool(pools.execution), config.execution, options, async context => {
          const observed = z.strictObject({ operationId: z.literal(input.operationId), inputDigest: z.string().regex(/^[a-f0-9]{64}$/) }).parse(context.request);
          if (observed.operationId !== input.operationId) throw fail();
          await authority(() => deps.authorizeOperation(context));
        }));
        const originals = own(createCandidateOriginalStore(pool(pools.drafts), config.records, {
          authorize: context => { if (!equal(context.target, target)) throw fail(); return authority(() => deps.records.authorize(context)); },
          verifyOriginal: async original => { await checked(() => admission.verifyOriginal(original)); await source(original); },
          lifecycle: ref => { if (ref.draftId !== input.draftId) throw fail(); return checked(() => deps.records.lifecycle(ref)); },
          keyForDraft: (ref, keyId) => { if (ref.draftId !== input.draftId || keyId === null) throw fail(); return checked(() => deps.records.keyForDraft(ref, keyId)); },
        }));
        const original = freeze(candidateRequestSchema.parse(await originals.read(target))); guard();
        const authorize = async () => {
          await current(); if (!equal(await originals.read(target), original)) throw fail();
          await authority(() => deps.authorizeStart(original));
          // Source, holds, keys and operation expiry are checked again after
          // external publication/consent authorization and before scheduling.
          if (!equal(await originals.read(target), original)) throw fail(); await current();
        };
        await authorize();
        const receipt = candidateSaveScheduleReceiptSchema.parse(await track(deps.scheduler.start(freeze({ ...target, expiresAt: config.execution.expiresAt }), authorize)));
        await authorize();
        return freeze(candidateSaveStartOutputSchema.parse({ ...input, kind: 'steer-candidate-save-start/v1', receipt,
          savedToGit: false, executionAuthorized: false, retryAuthorized: false, gateSigned: false }));
      });
      void work.finally(() => { settled = true; release(); }).catch(() => {});
      try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(fail()), 90000); })]); }
      catch { throw fail(); }
      finally { finished = true; if (timer) clearTimeout(timer); for (const child of owned) { child.close(); children.delete(child); } }
    },
    close() { closed = true; children.forEach(child => child.close()); },
  } satisfies CandidateSaveStarter & { close(): void };
}
