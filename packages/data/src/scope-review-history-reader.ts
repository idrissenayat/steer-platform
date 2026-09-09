import { z } from 'zod';
import { validateIntentScopeBatchResults } from '@steer/tool-registry/intent-scope-batches';
import { intentScopeAssessmentSchema } from '@steer/tool-registry/intent-evidence-contracts';
import { createScopeReviewOriginalStore, scopeRecordsConfigurationSchema } from './scope-review-originals.ts';
import { createScopeReviewObservationStore } from './scope-review-observations.ts';
import { createScopeReviewHistoryOperationReader } from './scope-review-operations.ts';
import { scopeOriginalHash as hash, freezeScopeOriginal as freeze } from './scope-original-contracts.ts';

const uuid = z.uuid().length(36).refine(v => v === v.toLowerCase());
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const scopeReviewReadTargetSchema = z.strictObject({ reviewId: uuid, preparationDigest: digest });
type Records = Parameters<typeof createScopeReviewObservationStore>[2] & Required<Pick<Parameters<typeof createScopeReviewObservationStore>[2], 'authorizeHistoricalRead' | 'authorizeHistoricalReview'>>;
const unavailable = () => new Error('Scope review history is unavailable.');

/** Explicit retained-history composition. No old execution grant is consulted.
 * Only succeeded, exact SDK-verified batch evidence is displayed, against its
 * retained source inventory. Historical results cannot satisfy the current review
 * contract. Current identity, historical records/source/profile, lifecycle and key
 * authority remain mandatory; no claim, dispatch, checkpoint or retry is exposed.
 */
export function createScopeReviewHistoryReader(pools: Parameters<typeof createScopeReviewOriginalStore>[0], rawConfiguration: unknown,
  dependencies: Records) {
  const config = freeze(scopeRecordsConfigurationSchema.parse(rawConfiguration));
  const scope = freeze({ organizationId: config.organizationId, subject: config.subject, productId: config.productId, repository: config.repository });
  const r = dependencies;
  if ([r?.authorize, r?.verifyObservation, r?.originals?.authorize, r?.originals?.authorizeOriginal,
    r?.authorizeHistoricalRead, r?.authorizeHistoricalReview, r?.originals?.authorizeDraft, r?.originals?.keyForDraft].some(v => typeof v !== 'function')) throw unavailable();
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
      const authority = async (action: string, work: () => Promise<void>) => {
        if (action !== 'read' || await checked(work) !== undefined) throw unavailable();
      };
      const secure: Records = {
        authorize: async () => { throw unavailable(); },
        authorizeHistoricalRead: context => authority('read', () => r.authorizeHistoricalRead(context)),
        authorizeHistoricalReview: context => {
          if (hash(context.request) !== hash(target)) throw unavailable();
          return authority('read', () => r.authorizeHistoricalReview(context));
        },
        verifyObservation: async context => { if (await checked(() => r.verifyObservation(context)) !== undefined) throw unavailable(); },
        originals: {
          authorize: context => authority(context.action, () => r.originals.authorize(context)),
          authorizeOriginal: context => authority(context.action, () => r.originals.authorizeOriginal(context)),
          authorizeReview: async () => { throw unavailable(); },
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
        // Even an empty/uncertain result set exposes retained inventory and batch
        // metadata. Require historical read authority for every planned batch,
        // not only those whose completed observation happens to be restored.
        const authorizeBatches = async () => {
          for (const batch of original.manifest.batches) await secure.authorizeHistoricalRead({
            configuration: config, target: { ...target, batchId: batch.batchId } });
        };
        await authorizeBatches();
        const source = original.original.source;
        const base = { kind: 'steer-scope-review-history/v1' as const, ...scope, ...target,
          source: { draftId: source.scope.draftId, revision: source.revision, revisionDigest: source.revisionDigest,
            scopeInputDigest: original.manifest.scopeInputDigest, latestRevision: original.latestDraftRevision },
          historical: true as const, reviewExpired: original.reviewExpired,
          head: original.original.evidence.head, sourceSnapshotDigest: original.manifest.sourceSnapshotDigest,
          inventory: original.original.evidence.inventory,
          semanticQualityVerified: false as const, authoritativeClearance: false as const, savedToGit: false as const,
          gateSigned: false as const, executionAuthorized: false as const, retryAuthorized: false as const };

        const operations = own(createScopeReviewHistoryOperationReader(scopedPools.execution, original.original.configuration, { authorize: secure.authorizeHistoricalReview }));
        const observations = own(createScopeReviewObservationStore(scopedPools, config, secure));
        const inspect = async () => {
          const observed = await operations.inspectHistory(target); guard();
          if (hash(observed.manifest) !== hash(original.manifest)) throw unavailable();
          return observed;
        };
        const initial = await inspect();
        const receipts: Array<{ planDigest: string; batchId: string; assessment: z.infer<typeof intentScopeAssessmentSchema> }> = [];
        for (const batch of initial.manifest.batches) {
          const step = initial.batches.find(s => s.binding.stepId === batch.batchId);
          if (step?.state !== 'succeeded') continue;
          const saved = await observations.readHistorical({ ...target, batchId: batch.batchId, stage: 'response' }); guard();
          if (saved.observation.stage !== 'response' || saved.batchState !== 'succeeded' || saved.requiresOutcomeResolution
            || !saved.historical || saved.payloadDigest !== step.resultDigest) throw unavailable();
          const result = saved.observation.result;
          receipts.push({ planDigest: result.planDigest, batchId: result.batchId, assessment: result.output });
        }
        const review = await validateIntentScopeBatchResults(original.original.evidence, receipts, original.original.profile.profileRevision); guard();
        if (review.planDigest !== original.manifest.planDigest) throw unavailable();
        // Do not mix earlier results with a changing batch set. Reads never retry
        // to chase the writer; a fresh caller can explicitly request a new snapshot.
        if (hash(await inspect()) !== hash(initial)) throw unavailable();
        const final = await originals.read(target); guard();
        if (hash(final.original) !== hash(original.original)) throw unavailable();
        base.source.latestRevision = final.latestDraftRevision;
        base.reviewExpired = final.reviewExpired;
        const batches = initial.manifest.batches.map(batch => {
          const step = initial.batches.find(s => s.binding.stepId === batch.batchId);
          return { batchId: batch.batchId, state: step?.state ?? 'pending' as const, resultDigest: step?.resultDigest ?? null };
        });
        await authorizeBatches(); await current(); return freeze({ ...base, batches, review });
      });
      void work.finally(() => { settled = true; release(); }).catch(() => {});
      try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(unavailable()), 30000); })]); }
      catch { throw unavailable(); }
      finally { finished = true; if (timer) clearTimeout(timer); for (const child of owned) { child.close(); children.delete(child); } }
    },
    close() { closed = true; for (const child of children) child.close(); },
  };
}
