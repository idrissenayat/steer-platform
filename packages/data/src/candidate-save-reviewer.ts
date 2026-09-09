import { candidateSaveReviewInputSchema, describeCandidateSaveReview, type CandidateSaveReviewer } from '@steer/tool-registry/candidate-save-review-contracts';
import { intentDraftReadOutputSchema, type IntentDraftService } from '@steer/tool-registry/intent-draft-contracts';
import { intentDevelopmentReviewInputSchema, verifyDevelopmentReview, type IntentDevelopmentReviewReader } from '@steer/tool-registry/intent-development-review-contracts';
import { fingerprintIntentScope } from '@steer/tool-registry/intent-revision-contracts';
import type { IntentScopeReader } from '@steer/tool-registry/intent-scope-read-contracts';
import { draftRecordsConfigurationSchema } from './draft-revisions.ts';
import { resolveDevelopmentScopeReview } from './development-scope-review.ts';
import { freezeOriginal as freeze } from './development-original-contracts.ts';
import { registerReviewReadSession, withReviewReadSession } from './review-read-session.ts';

const fail = () => new Error('Final save review is unavailable; nothing was saved or confirmed.');
/** Read-only final review. No original/operation allocation, profile or authorship
 * inference, confirmation, dispatch, retry or provider write capability. */
export function createCandidateSaveReviewer(configuration: unknown, deps: {
  drafts: IntentDraftService; sources: IntentDevelopmentReviewReader; scopeReview?: IntentScopeReader;
  authorizeReview(input: Readonly<Parameters<CandidateSaveReviewer['review']>[0]>): Promise<void>;
}) {
  const config = freeze(draftRecordsConfigurationSchema.parse(configuration));
  const { organizationId, subject, productId, repository, branch, configurationRevision } = config;
  const scope = freeze({ organizationId, subject, productId, repository, branch, configurationRevision });
  if ([deps.drafts?.read, deps.sources?.review, deps.authorizeReview].some(v => typeof v !== 'function')) throw fail();
  const lifetime = new AbortController(); let active = 0;
  async function review(raw: unknown, revalidate: () => Promise<void>, sharedSources?: (current: () => Promise<void>) => Promise<unknown>) {
      const input = freeze(candidateSaveReviewInputSchema.parse(raw));
      if (active >= 4 || lifetime.signal.aborted || typeof revalidate !== 'function') throw fail();
      active++; let pending = 0, finished = false, released = false;
      const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(60000)]);
      const release = () => { if (finished && pending === 0 && !released) { released = true; active--; } };
      const guard = () => {
        signal.throwIfAborted(); if (finished || (['organizationId', 'productId', 'repository', 'configurationRevision'] as const).some(k => input[k] !== scope[k])
          || (['organizationId', 'subject', 'productId', 'repository'] as const).some(k => deps.drafts.scope[k] !== scope[k] || deps.sources.scope[k] !== scope[k])
          || deps.sources.scope.configurationRevision !== configurationRevision) throw fail();
      };
      const bounded = async <T>(work: () => Promise<T>): Promise<T> => {
        guard(); pending++; let abort: () => void = () => {};
        const task = Promise.resolve().then(() => { guard(); return work(); });
        void task.finally(() => { pending--; release(); }).catch(() => {});
        try { return await Promise.race([task, new Promise<never>((_, reject) => {
          abort = () => reject(fail()); signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
        })]); } finally { signal.removeEventListener('abort', abort); }
      };
      const current = async () => { if (await bounded(revalidate) !== undefined) throw fail(); guard(); };
      const authorized = async () => { await current(); if (await bounded(() => deps.authorizeReview(input)) !== undefined) throw fail(); await current(); };
      const readDraft = async () => {
        await current();
        const draft = intentDraftReadOutputSchema.parse(await bounded(() => deps.drafts.read({ organizationId, productId, repository, draftId: input.draftId, revision: input.revision }, current)));
        await current();
        if (draft.latestRevision !== input.revision || (['draftId', 'revision', 'revisionDigest', 'scopeInputDigest'] as const).some(k => draft[k] !== input[k]) || !draft.content.documents) throw fail();
        const fingerprint = await fingerprintIntentScope({ organizationId, productId, repository, draftId: draft.draftId, sourceRevision: draft.sourceRevision,
          ...draft.content, documents: { brief: draft.content.documents.brief, spec: draft.content.documents.spec } });
        if (fingerprint.scopeInputDigest !== input.scopeInputDigest) throw fail(); return freeze(draft);
      };
      const sourceInput = intentDevelopmentReviewInputSchema.parse({ organizationId, productId, repository,
        draftId: input.draftId, revision: input.revision, revisionDigest: input.revisionDigest, scopeInputDigest: input.scopeInputDigest });
      const readState = async (readSource: (current: () => Promise<void>) => Promise<unknown>) => {
        const draft = await readDraft();
        const { output: sources } = await verifyDevelopmentReview(sourceInput, await bounded(() => readSource(current)));
        await current();
        if (sources.configurationRevision !== configurationRevision || sources.sourceSnapshotDigest !== input.sourceSnapshotDigest) throw fail();
        const binding = await bounded(() => resolveDevelopmentScopeReview(input.scopeReview, sources.evidence, { ...sourceInput, subject }, deps.scopeReview, current));
        const output = await describeCandidateSaveReview(input, subject, branch, draft.content.documents, sources.evidence, binding);
        await current(); return { draft, sources, binding, output };
      };
      try {
        let output: Awaited<ReturnType<typeof describeCandidateSaveReview>> | undefined;
        const run = async (readSource: (current: () => Promise<void>) => Promise<unknown>) => {
          await authorized(); const initial = await readState(readSource);
          await authorized(); const latest = await readState(readSource);
          if (JSON.stringify(initial) !== JSON.stringify(latest)) throw fail();
          await authorized(); if (JSON.stringify(await readDraft()) !== JSON.stringify(initial.draft)) throw fail();
          await current(); output = initial.output;
        };
        if (sharedSources) await run(sharedSources);
        else await withReviewReadSession(deps.sources, sourceInput, current, run, task => bounded(() => task), guard);
        await current(); if (!output) throw fail(); return output;
      } catch { throw fail(); }
      finally { finished = true; release(); }
  }
  const service = { scope, review: (raw, current) => review(raw, current), close() { lifetime.abort(); } } satisfies CandidateSaveReviewer & { close(): void };
  registerReviewReadSession(service.review, scope, async (raw, current, work) => {
    const input = freeze(candidateSaveReviewInputSchema.parse(raw));
    const sourceInput = intentDevelopmentReviewInputSchema.parse({ organizationId, productId, repository,
      draftId: input.draftId, revision: input.revision, revisionDigest: input.revisionDigest, scopeInputDigest: input.scopeInputDigest });
    await withReviewReadSession(deps.sources, sourceInput, current,
      async readSource => work(present => review(input, present, readSource)), pending => pending,
      () => { lifetime.signal.throwIfAborted(); });
  });
  return service;
}
