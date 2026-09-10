import { intentDevelopmentReviewInputSchema, verifyDevelopmentReview, type IntentDevelopmentReviewReader,
  type IntentDevelopmentReviewInput } from '@steer/tool-registry/intent-development-review-contracts';
import { intentDraftReadOutputSchema, type IntentDraftService } from '@steer/tool-registry/intent-draft-contracts';
import { intentEvidenceInputSchema } from '@steer/tool-registry/intent-evidence-contracts';
import { planIntentScopeBatches } from '@steer/tool-registry/intent-scope-batches';
import { developmentRecordsConfigurationSchema } from './development-originals.ts';
import { developmentOriginalHash as hash, freezeOriginal as freeze } from './development-original-contracts.ts';
import { registerReviewReadSession } from './review-read-session.ts';

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
  const readDraft = async (input: IntentDevelopmentReviewInput, current: () => Promise<void>) => {
    await current();
    const draft = intentDraftReadOutputSchema.parse(await deps.drafts.read({ organizationId, productId, repository,
      draftId: input.draftId, revision: input.revision }, current));
    await current();
    if (draft.draftId !== input.draftId || draft.revision !== input.revision || draft.latestRevision !== input.revision
      || draft.revisionDigest !== input.revisionDigest || draft.scopeInputDigest !== input.scopeInputDigest) throw unavailable();
    return draft;
  };
  const authorizeSources = async (input: IntentDevelopmentReviewInput, value: ReturnType<typeof intentEvidenceInputSchema.parse>, current: () => Promise<void>) => {
    if (await deps.authorizeReview(input, value) !== undefined) throw unavailable(); await current();
  };
  const readEvidence = async (input: IntentDevelopmentReviewInput, current: () => Promise<void>, evidenceFor: () => Promise<unknown>) => {
    await current(); const value = freeze(intentEvidenceInputSchema.parse(await evidenceFor())); await current();
    if ((['organizationId', 'productId', 'repository', 'branch'] as const).some(k => value[k] !== config[k]) || value.scopeInputDigest !== input.scopeInputDigest) throw unavailable();
    await authorizeSources(input, value, current); return value;
  };
  const describe = async (input: IntentDevelopmentReviewInput, sources: ReturnType<typeof intentEvidenceInputSchema.parse>) => {
    const plan = await planIntentScopeBatches(sources), envelope = plan.envelope;
    const { output } = await verifyDevelopmentReview(input, { ...input, kind: 'steer-development-review/v1', configurationRevision,
      sourceSnapshotDigest: envelope.sourceSnapshotDigest, scopeBatchPlan: plan.summary, evidence: sources, semanticReviewComplete: false,
      authoritativeClearance: false, executionAuthorized: false, savedToGit: false, gateSigned: false });
    return freeze(output);
  };
  async function review(raw: unknown, revalidate: () => Promise<void>, withEvidenceRead = deps.withEvidenceRead) {
      const input = freeze(intentDevelopmentReviewInputSchema.parse(raw));
      if (closed || active >= 4 || typeof revalidate !== 'function') throw unavailable();
      active++; let finished = false, timer: ReturnType<typeof setTimeout> | undefined;
      const guard = () => {
        if (closed || finished || (['organizationId', 'productId', 'repository'] as const).some(k => input[k] !== scope[k])
          || (['organizationId', 'subject', 'productId', 'repository'] as const).some(k => deps.drafts.scope[k] !== scope[k])) throw unavailable();
      };
      const current = async () => { guard(); if (await revalidate() !== undefined) throw unavailable(); guard(); };
      const read = () => readDraft(input, current);
      const evidence = (evidenceFor: () => Promise<unknown>) => readEvidence(input, current, evidenceFor);
      const run = async (evidenceFor: () => Promise<unknown>) => {
        const draft = await read(), sources = await evidence(evidenceFor), output = await describe(input, sources);
        if (hash(await read()) !== hash(draft) || hash(await evidence(evidenceFor)) !== hash(sources)) throw unavailable();
        await current(); return freeze(output);
      };
      const work = Promise.resolve().then(async () => {
        const result = withEvidenceRead ? await withEvidenceRead(input, current, run) : await run(() => deps.evidenceFor(input, current));
        await current(); return result;
      });
      // A timed-out dependency still owns its admission slot until it settles.
      void work.finally(() => { active--; }).catch(() => {});
      try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(unavailable()), 30000); })]); }
      catch { throw unavailable(); }
      finally { finished = true; if (timer) clearTimeout(timer); }
  }
  const service = { scope, review: (raw, current) => review(raw, current), close() { closed = true; } } satisfies IntentDevelopmentReviewReader & { close(): void };
  registerReviewReadSession(service.review, scope, async (raw, outerCurrent, work) => {
    const input = freeze(intentDevelopmentReviewInputSchema.parse(raw)), window = deps.withEvidenceRead;
    if (!window) { await work(current => review(input, current)); return; }
    if (closed || active >= 4 || typeof outerCurrent !== 'function' || typeof work !== 'function') throw unavailable();
    active++;
    const ports = [deps.drafts, deps.drafts.read, deps.authorizeReview, deps.evidenceFor, window];
    const deadline = AbortSignal.timeout(30000);
    let ended = false, failed = false, invoked = false, completed = false, consumed = false, reading = false, consumptionsClosed = false,
      childCurrent: (() => Promise<void>) | undefined;
    const pending = new Set<Promise<unknown>>(), windows = new Set<Promise<unknown>>();
    const guard = () => { deadline.throwIfAborted(); if (closed || ended || failed
      || (['organizationId', 'productId', 'repository'] as const).some(k => input[k] !== scope[k])
      || (['organizationId', 'subject', 'productId', 'repository'] as const).some(k => deps.drafts.scope[k] !== scope[k])
      || [deps.drafts, deps.drafts.read, deps.authorizeReview, deps.evidenceFor, deps.withEvidenceRead]
        .some((port, i) => port !== ports[i])) throw unavailable(); };
    const current = async () => {
      guard(); if (await outerCurrent() !== undefined) throw unavailable(); guard();
      if (childCurrent && await childCurrent() !== undefined) throw unavailable(); guard();
    };
    const readState = async (read: () => Promise<unknown>) => {
      const draft = freeze(await readDraft(input, current)), sources = await readEvidence(input, current, read);
      const output = await describe(input, sources); await current(); return freeze({ draft, sources, output });
    };
    let initial: Awaited<ReturnType<typeof readState>> | undefined;
    try {
      await current();
      const result = await window(input, current, evidenceFor => {
        if (invoked || typeof evidenceFor !== 'function') { failed = true; const rejected = Promise.reject(unavailable()); void rejected.catch(() => {}); return rejected; } invoked = true;
        const task = Promise.resolve().then(async () => {
        guard();
        const read = (present: () => Promise<void>) => {
          if (reading || consumptionsClosed || typeof present !== 'function') {
            failed = true; const rejected = Promise.reject(unavailable()); void rejected.catch(() => {}); return rejected;
          }
          reading = true; childCurrent = present;
          const task = Promise.resolve().then(async () => {
            guard(); await current();
            if (!initial) initial = await readState(evidenceFor);
            else await authorizeSources(input, initial.sources, current);
            await current(); consumed = true; return initial.output;
          }).catch(error => { failed = true; throw error; })
            .finally(() => { reading = false; childCurrent = undefined; });
          pending.add(task); void task.finally(() => pending.delete(task)).catch(() => {}); return task;
        };
        try {
          let returned: unknown;
          try { returned = await work(read); } finally { consumptionsClosed = true; }
          if (returned !== undefined || !consumed || reading || !initial) throw unavailable();
          guard(); const final = await readState(evidenceFor);
          if (hash(final) !== hash(initial)) throw unavailable(); await current(); completed = true;
        }
        catch (error) { failed = true; throw error; }
        finally { await Promise.allSettled([...pending]); }
        });
        windows.add(task); void task.finally(() => windows.delete(task)).catch(() => {}); return task;
      });
      guard(); if (result !== undefined || !invoked || !completed || !initial || pending.size || childCurrent) throw unavailable();
      // The enclosing corpus performs a final freshness check after all reviews.
      // Re-open the exact draft after that callback too: a late edit, hold or key
      // loss cannot leave the shared preview tied to stale draft metadata.
      if (hash(await readDraft(input, current)) !== hash(initial.draft)) throw unavailable(); await current();
    } catch { throw unavailable(); }
    finally { ended = true; await Promise.allSettled([...windows]); await Promise.allSettled([...pending]); active--; }
  });
  return service;
}
