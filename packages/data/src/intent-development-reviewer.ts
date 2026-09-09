import { intentDevelopmentReviewInputSchema, verifyDevelopmentReview, type IntentDevelopmentReviewReader,
  type IntentDevelopmentReviewInput } from '@steer/tool-registry/intent-development-review-contracts';
import { intentDraftReadOutputSchema, type IntentDraftService } from '@steer/tool-registry/intent-draft-contracts';
import { intentEvidenceInputSchema } from '@steer/tool-registry/intent-evidence-contracts';
import { planIntentScopeBatches } from '@steer/tool-registry/intent-scope-batches';
import { developmentRecordsConfigurationSchema } from './development-originals.ts';
import { developmentOriginalHash as hash, freezeOriginal as freeze } from './development-original-contracts.ts';

const unavailable = () => new Error('Current source review is unavailable; this does not establish new intent.');
/** Read-only composition over the existing owner-bound SQL draft service and a
 * mandatory evidence/provenance authority. No operation or original is created. */
export function createIntentDevelopmentReviewer(rawConfiguration: unknown, deps: {
  drafts: IntentDraftService;
  evidenceFor(input: Readonly<IntentDevelopmentReviewInput>, revalidate: () => Promise<void>): Promise<unknown>;
  // Installed only by the trusted read-only repository composition. This is not
  // selected by an HTTP input and must never enclose admission or other effects.
  withEvidenceRead?<T>(input: Readonly<IntentDevelopmentReviewInput>, revalidate: () => Promise<void>, work: (read: () => Promise<unknown>) => Promise<T>): Promise<T>;
  authorizeReview(input: Readonly<IntentDevelopmentReviewInput>, evidence: Readonly<ReturnType<typeof intentEvidenceInputSchema.parse>>): Promise<void>;
}) {
  const config = freeze(developmentRecordsConfigurationSchema.parse(rawConfiguration));
  const { organizationId, subject, productId, repository, configurationRevision } = config;
  const scope = freeze({ organizationId, subject, productId, repository, configurationRevision });
  if (typeof deps.drafts?.read !== 'function' || typeof deps.evidenceFor !== 'function' || typeof deps.authorizeReview !== 'function') throw unavailable();
  if (deps.withEvidenceRead !== undefined && typeof deps.withEvidenceRead !== 'function') throw unavailable();
  let closed = false, active = 0;
  return {
    scope,
    async review(raw, revalidate) {
      const input = freeze(intentDevelopmentReviewInputSchema.parse(raw));
      if (closed || active >= 4 || typeof revalidate !== 'function') throw unavailable();
      active++; let finished = false, timer: ReturnType<typeof setTimeout> | undefined;
      const guard = () => {
        if (closed || finished || (['organizationId', 'productId', 'repository'] as const).some(k => input[k] !== scope[k])
          || (['organizationId', 'subject', 'productId', 'repository'] as const).some(k => deps.drafts.scope[k] !== scope[k])) throw unavailable();
      };
      const current = async () => { guard(); if (await revalidate() !== undefined) throw unavailable(); guard(); };
      const read = async () => {
        await current();
        const draft = intentDraftReadOutputSchema.parse(await deps.drafts.read({ organizationId, productId, repository,
          draftId: input.draftId, revision: input.revision }, current));
        await current();
        if (draft.draftId !== input.draftId || draft.revision !== input.revision || draft.latestRevision !== input.revision
          || draft.revisionDigest !== input.revisionDigest || draft.scopeInputDigest !== input.scopeInputDigest) throw unavailable();
        return draft;
      };
      const evidence = async (evidenceFor: () => Promise<unknown>) => {
        await current(); const value = freeze(intentEvidenceInputSchema.parse(await evidenceFor())); await current();
        if ((['organizationId', 'productId', 'repository', 'branch'] as const).some(k => value[k] !== config[k]) || value.scopeInputDigest !== input.scopeInputDigest) throw unavailable();
        if (await deps.authorizeReview(input, value) !== undefined) throw unavailable(); await current(); return value;
      };
      const run = async (evidenceFor: () => Promise<unknown>) => {
        const draft = await read(), sources = await evidence(evidenceFor), plan = await planIntentScopeBatches(sources), envelope = plan.envelope;
        const { output } = await verifyDevelopmentReview(input, { ...input, kind: 'steer-development-review/v1', configurationRevision,
          sourceSnapshotDigest: envelope.sourceSnapshotDigest, scopeBatchPlan: plan.summary, evidence: sources, semanticReviewComplete: false,
          authoritativeClearance: false, executionAuthorized: false, savedToGit: false, gateSigned: false });
        if (hash(await read()) !== hash(draft) || hash(await evidence(evidenceFor)) !== hash(sources)) throw unavailable();
        await current(); return freeze(output);
      };
      const work = Promise.resolve().then(async () => {
        const result = deps.withEvidenceRead ? await deps.withEvidenceRead(input, current, run) : await run(() => deps.evidenceFor(input, current));
        await current(); return result;
      });
      // A timed-out dependency still owns its admission slot until it settles.
      void work.finally(() => { active--; }).catch(() => {});
      try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(unavailable()), 30000); })]); }
      catch { throw unavailable(); }
      finally { finished = true; if (timer) clearTimeout(timer); }
    },
    close() { closed = true; },
  } satisfies IntentDevelopmentReviewReader & { close(): void };
}
