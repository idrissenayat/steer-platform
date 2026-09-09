import { z } from 'zod';
import { validateIntentScopeBatchResults } from '@steer/tool-registry/intent-scope-batches';
import { intentScopeAssessmentSchema } from '@steer/tool-registry/intent-evidence-contracts';
import { createScopeReviewOriginalStore, scopeRecordsConfigurationSchema } from './scope-review-originals.ts';
import { createScopeReviewObservationStore } from './scope-review-observations.ts';
import { createScopeReviewOperationStore, describeScopeReviewCheckpoint } from './scope-review-operations.ts';
import { scopeOriginalHash as hash, freezeScopeOriginal as freeze } from './scope-original-contracts.ts';
import { createReadPolicyAuthority } from './read-policy-authority.ts';

const uuid = z.uuid().length(36).refine(v => v === v.toLowerCase());
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
export const scopeReviewReadTargetSchema = z.strictObject({ reviewId: uuid, preparationDigest: digest });
type Records = Parameters<typeof createScopeReviewObservationStore>[2];
const unavailable = () => new Error('Scope review read is unavailable.');

/** Disabled read-only composition. Restores only checkpointed exact SDK results,
 * then combines them against the complete retained source/coverage plan. A valid
 * combined result is not semantic quality, uniqueness, retry or save authority.
 * The caller must revalidate its current human/service identity and query grant;
 * records callbacks must enforce current source, lifecycle and key authority.
 * No claim, checkpoint mutation, scheduling, model call or private result copy.
 */
export function createScopeReviewReader(pools: Parameters<typeof createScopeReviewOriginalStore>[0], rawConfiguration: unknown,
  dependencies: Records) {
  const config = freeze(scopeRecordsConfigurationSchema.parse(rawConfiguration));
  const scope = freeze({ organizationId: config.organizationId, subject: config.subject, productId: config.productId, repository: config.repository });
  const r = dependencies;
  if ([r?.authorize, r?.verifyObservation, r?.originals?.authorize, r?.originals?.authorizeOriginal,
    r?.originals?.authorizeReview, r?.originals?.authorizeDraft, r?.originals?.keyForDraft].some(v => typeof v !== 'function')) throw unavailable();
  let closed = false, running = 0;
  const children = new Set<{ close(): void }>();
  return {
    scope,
    async read(raw: unknown, revalidate: () => Promise<void>) {
      if (closed || running >= 4 || typeof revalidate !== 'function') throw unavailable();
      const parsed = scopeReviewReadTargetSchema.safeParse(raw);
      if (!parsed.success) throw unavailable();
      const target = freeze(parsed.data);
      running++;
      let finished = false, settled = false, pending = 0, released = false, timer: ReturnType<typeof setTimeout> | undefined;
      const owned: { close(): void }[] = [];
      const release = () => { if (settled && !pending && !released) { released = true; running--; } };
      const guard = () => { if (closed || finished) throw unavailable(); };
      const track = async <T>(work: Promise<T>): Promise<T> => { pending++; try { return await work; } finally { pending--; release(); } };
      const current = async () => { guard(); if (await track(Promise.resolve().then(revalidate)) !== undefined) throw unavailable(); guard(); };
      const checked = async <T>(work: () => Promise<T>) => { await current(); const value = await track(Promise.resolve().then(work)); await current(); return value; };
      const authority = createReadPolicyAuthority(current, track, guard);
      const secure: Records = {
        authorize: context => authority(context.action, () => r.authorize(context)),
        verifyObservation: async context => { if (await checked(() => r.verifyObservation(context)) !== undefined) throw unavailable(); },
        originals: {
          authorize: context => authority(context.action, () => r.originals.authorize(context)),
          authorizeOriginal: context => authority(context.action, () => r.originals.authorizeOriginal(context)),
          authorizeReview: context => {
            if (hash(context.request) !== hash(target)) throw unavailable();
            return authority('read', () => r.originals.authorizeReview(context));
          },
          authorizeDraft: context => authority(context.action, () => r.originals.authorizeDraft(context)),
          keyForDraft: (reference, keyId) => { if (keyId === null) throw unavailable(); return checked(() => r.originals.keyForDraft(reference, keyId)); },
        },
      };
      const scopedPools = { drafts: { connect: () => { guard(); return track(pools.drafts.connect()); } },
        execution: { connect: () => { guard(); return track(pools.execution.connect()); } } };
      const own = <T extends { close(): void }>(store: T): T => { owned.push(store); children.add(store); return store; };
      const work = Promise.resolve().then(async () => {
        await current();
        const originals = own(createScopeReviewOriginalStore(scopedPools, config, secure.originals));
        const original = await originals.read(target); guard();
        const source = original.original.source;
        const base = { kind: 'steer-scope-review-read/v1' as const, ...scope, ...target,
          source: { draftId: source.scope.draftId, revision: source.revision, revisionDigest: source.revisionDigest,
            scopeInputDigest: original.manifest.scopeInputDigest, latestRevision: original.latestDraftRevision },
          semanticQualityVerified: false as const, authoritativeClearance: false as const, savedToGit: false as const,
          gateSigned: false as const, executionAuthorized: false as const, retryAuthorized: false as const };
        if (original.reviewExpired) {
          await current(); return freeze({ ...base, status: 'expired' as const, batches: null, review: null });
        }
        const operations = own(createScopeReviewOperationStore(scopedPools.execution, original.original.configuration, { authorize: secure.originals.authorizeReview }));
        const observations = own(createScopeReviewObservationStore(scopedPools, config, secure));
        const inspect = async () => {
          const observed = await operations.inspect(target); guard();
          if (observed.outcome !== 'ok' || hash(observed.value.manifest) !== hash(original.manifest)) throw unavailable();
          return observed.value;
        };
        const initial = await inspect();
        const receipts: Array<{ planDigest: string; batchId: string; assessment: z.infer<typeof intentScopeAssessmentSchema> }> = [];
        for (const batch of initial.manifest.batches) {
          const step = initial.batches.find(s => s.binding.stepId === batch.batchId);
          if (step?.state !== 'succeeded') continue;
          const saved = await observations.read({ ...target, batchId: batch.batchId, stage: 'response' }); guard();
          const checkpoint = describeScopeReviewCheckpoint(original.original.configuration, target.preparationDigest, step, step.resultDigest!);
          if (saved.observation.stage !== 'response' || saved.batchState !== 'succeeded' || saved.requiresOutcomeResolution
            || !saved.checkpoint || hash(saved.checkpoint) !== hash(checkpoint) || saved.payloadDigest !== step.resultDigest) throw unavailable();
          const result = saved.observation.result;
          receipts.push({ planDigest: result.planDigest, batchId: result.batchId, assessment: result.output });
        }
        const review = await validateIntentScopeBatchResults(original.original.evidence, receipts, original.original.profile.profileRevision); guard();
        if (review.planDigest !== original.manifest.planDigest) throw unavailable();
        // Do not mix earlier results with a changing batch set. Reads never retry
        // to chase the writer; a fresh caller can explicitly request a new snapshot.
        if (hash(await inspect()) !== hash(initial)) throw unavailable();
        const final = await originals.read(target); guard();
        if (hash(final.original) !== hash(original.original) || final.reviewExpired) throw unavailable();
        base.source.latestRevision = final.latestDraftRevision;
        const batches = initial.manifest.batches.map(batch => {
          const step = initial.batches.find(s => s.binding.stepId === batch.batchId);
          return { batchId: batch.batchId, state: step?.state ?? 'pending' as const, resultDigest: step?.resultDigest ?? null };
        });
        const status = final.latestDraftRevision !== source.revision ? 'superseded' as const
          : batches.some(b => ['outcome-unknown', 'failed-known'].includes(b.state)) ? 'attention-required' as const
            : batches.some(b => b.state !== 'succeeded') ? 'pending' as const
              : review.structuralAssessmentComplete ? 'review-available' as const : 'incomplete' as const;
        await current(); return freeze({ ...base, status, batches, review });
      });
      void work.finally(() => { settled = true; release(); }).catch(() => {});
      try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(unavailable()), 30000); })]); }
      catch { throw unavailable(); }
      finally { finished = true; if (timer) clearTimeout(timer); for (const child of owned) { child.close(); children.delete(child); } }
    },
    close() { closed = true; for (const child of children) child.close(); },
  };
}
