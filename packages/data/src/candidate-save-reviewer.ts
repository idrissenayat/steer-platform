import { candidateSaveReviewInputSchema, describeCandidateSaveReview, type CandidateSaveReviewer } from '@steer/tool-registry/candidate-save-review-contracts';
import { intentDraftReadOutputSchema, type IntentDraftService } from '@steer/tool-registry/intent-draft-contracts';
import { intentDevelopmentReviewInputSchema, verifyDevelopmentReview, type IntentDevelopmentReviewReader } from '@steer/tool-registry/intent-development-review-contracts';
import { fingerprintIntentScope } from '@steer/tool-registry/intent-revision-contracts';
import type { IntentScopeReader, IntentScopeReadInput } from '@steer/tool-registry/intent-scope-read-contracts';
import { draftRecordsConfigurationSchema } from './draft-revisions.ts';
import { resolveDevelopmentScopeReview } from './development-scope-review.ts';
import { freezeOriginal as freeze } from './development-original-contracts.ts';
import { registerCallerBracketedReviewReadSession, withReviewReadSession } from './review-read-session.ts';
import { readReviewDraft, type ReviewDraftRead } from './review-draft-read.ts';

const fail = () => new Error('Final save review is unavailable; nothing was saved or confirmed.');
/** Read-only final review. No original/operation allocation, profile or authorship
 * inference, confirmation, dispatch, retry or provider write capability. */
export function createCandidateSaveReviewer(configuration: unknown, deps: {
  drafts: IntentDraftService; sources: IntentDevelopmentReviewReader; scopeReview?: IntentScopeReader;
  authorizeReview(input: Readonly<Parameters<CandidateSaveReviewer['review']>[0]>): Promise<void>;
  // Trusted read-only current projection. The producer owns full final native
  // records/key validation and drainage after work; no effects belong inside it.
  withScopeRead?(input: IntentScopeReadInput, current: () => Promise<void>, work: (reader: IntentScopeReader) => Promise<void>): Promise<void>;
}) {
  const config = freeze(draftRecordsConfigurationSchema.parse(configuration));
  const { organizationId, subject, productId, repository, branch, configurationRevision } = config;
  const scope = freeze({ organizationId, subject, productId, repository, branch, configurationRevision });
  if ([deps.drafts?.read, deps.sources?.review, deps.authorizeReview].some(v => typeof v !== 'function')) throw fail();
  if (deps.withScopeRead !== undefined && typeof deps.withScopeRead !== 'function') throw fail();
  const lifetime = new AbortController(); let active = 0;
  async function review(raw: unknown, revalidate: () => Promise<void>,
    readWork?: (read: (present: () => Promise<void>) => Promise<Awaited<ReturnType<typeof describeCandidateSaveReview>>>, draft?: ReviewDraftRead) => Promise<void>) {
      const input = freeze(candidateSaveReviewInputSchema.parse(raw));
      if (active >= 4 || lifetime.signal.aborted || typeof revalidate !== 'function') throw fail();
      active++; let pending = 0, finished = false, released = false;
      const tasks = new Set<Promise<unknown>>();
      const withScopeRead = deps.withScopeRead;
      let scopeReader = deps.scopeReview;
      const ports = [deps.drafts, deps.drafts.read, deps.sources, deps.sources.review, deps.scopeReview, deps.scopeReview?.read, deps.authorizeReview, withScopeRead];
      const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(60000)]);
      const release = () => { if (finished && pending === 0 && !released) { released = true; active--; } };
      const guard = () => {
        if ([deps.drafts, deps.drafts.read, deps.sources, deps.sources.review, deps.scopeReview, deps.scopeReview?.read, deps.authorizeReview, deps.withScopeRead]
          .some((port, index) => port !== ports[index])) throw fail();
        signal.throwIfAborted(); if (finished || (['organizationId', 'productId', 'repository', 'configurationRevision'] as const).some(k => input[k] !== scope[k])
          || (['organizationId', 'subject', 'productId', 'repository'] as const).some(k => deps.drafts.scope[k] !== scope[k] || deps.sources.scope[k] !== scope[k])
          || deps.sources.scope.configurationRevision !== configurationRevision) throw fail();
      };
      const bounded = async <T>(work: () => Promise<T>): Promise<T> => {
        guard(); pending++; let abort: () => void = () => {};
        const task = Promise.resolve().then(() => { guard(); return work(); });
        tasks.add(task); void task.finally(() => { tasks.delete(task); pending--; release(); }).catch(() => {});
        try { return await Promise.race([task, new Promise<never>((_, reject) => {
          abort = () => reject(fail()); signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
        })]); } finally { signal.removeEventListener('abort', abort); }
      };
      const current = async () => { if (await bounded(revalidate) !== undefined) throw fail(); guard(); };
      const authorized = async () => { await current(); if (await bounded(() => deps.authorizeReview(input)) !== undefined) throw fail(); await current(); };
      const readDraft = async (draftRead?: ReviewDraftRead) => {
        await current();
        const selected = { organizationId, productId, repository, draftId: input.draftId, revision: input.revision };
        const draft = intentDraftReadOutputSchema.parse(await bounded(() => readReviewDraft(draftRead, deps.drafts, selected, () => deps.drafts.read(selected, current))));
        await current();
        if (draft.latestRevision !== input.revision || (['draftId', 'revision', 'revisionDigest', 'scopeInputDigest'] as const).some(k => draft[k] !== input[k]) || !draft.content.documents) throw fail();
        const fingerprint = await fingerprintIntentScope({ organizationId, productId, repository, draftId: draft.draftId, sourceRevision: draft.sourceRevision,
          ...draft.content, documents: { brief: draft.content.documents.brief, spec: draft.content.documents.spec } });
        if (fingerprint.scopeInputDigest !== input.scopeInputDigest) throw fail(); return freeze(draft);
      };
      const sourceInput = intentDevelopmentReviewInputSchema.parse({ organizationId, productId, repository,
        draftId: input.draftId, revision: input.revision, revisionDigest: input.revisionDigest, scopeInputDigest: input.scopeInputDigest });
      const readState = async (readSource: (current: () => Promise<void>) => Promise<unknown>, draftRead?: ReviewDraftRead) => {
        const draft = await readDraft(draftRead);
        const { output: sources } = await verifyDevelopmentReview(sourceInput, await bounded(() => readSource(current)));
        await current();
        if (sources.configurationRevision !== configurationRevision || sources.sourceSnapshotDigest !== input.sourceSnapshotDigest) throw fail();
        const binding = await bounded(() => resolveDevelopmentScopeReview(input.scopeReview, sources.evidence, { ...sourceInput, subject }, scopeReader, current));
        const output = await describeCandidateSaveReview(input, subject, branch, draft.content.documents, sources.evidence, binding);
        await current(); return { draft, sources, binding, output };
      };
      try {
        let output: Awaited<ReturnType<typeof describeCandidateSaveReview>> | undefined;
        const run = async (readSource: (current: () => Promise<void>) => Promise<unknown>, draftRead?: ReviewDraftRead) => {
          let initial: Awaited<ReturnType<typeof readState>> | undefined;
          const validate = async () => {
          if (readWork) {
            let reading = false, consumed = false, ended = false, invalid = false;
            const read = async (present: () => Promise<void>) => {
              guard(); if (reading || ended || invalid || typeof present !== 'function') { invalid = true; throw fail(); }
              reading = true;
              // Own the entire consumption, including caller callbacks. A lost
              // await must not let this phase return before the actual work drains.
              return bounded(async () => {
                try {
                  if (await present() !== undefined) throw fail();
                  guard(); await authorized(); initial ??= freeze(await readState(readSource, draftRead));
                  await authorized();
                  if (await present() !== undefined) throw fail();
                  guard(); consumed = true; return initial.output;
                } catch { invalid = true; throw fail(); }
                finally { reading = false; }
              });
            };
            try {
              if (await bounded(() => readWork(read, draftRead)) !== undefined || reading || invalid || !consumed) throw fail();
            } finally { ended = true; }
          } else { await authorized(); initial = await readState(readSource, draftRead); }
          if (!initial) throw fail();
          await authorized(); const latest = await readState(readSource, draftRead);
          if (JSON.stringify(initial) !== JSON.stringify(latest)) throw fail();
          };
          if (withScopeRead && input.scopeReview.kind === 'recorded') {
            const selected = input.scopeReview;
            let invoked = false, completed = false, invalid = false;
            await authorized();
            await bounded(async () => {
              const returned = await withScopeRead({ organizationId, productId, repository, reviewId: selected.reviewId,
                preparationDigest: selected.preparationDigest }, current, async reader => {
                guard(); if (invoked || invalid || !reader || typeof reader.read !== 'function') { invalid = true; throw fail(); }
                invoked = true; scopeReader = reader;
                try { await validate(); completed = true; } finally { scopeReader = deps.scopeReview; }
              });
              guard(); if (returned !== undefined || !invoked || !completed || invalid) throw fail();
            });
          } else await validate();
          if (!initial) throw fail();
          // Full scope records/keys have now rechecked. Ordinary readers reopen
          // here; loans compare the exact snapshot with fresh read permission.
          // Their owner performs full native draft validation after source closure.
          await authorized(); if (JSON.stringify(await readDraft(draftRead)) !== JSON.stringify(initial.draft)) throw fail();
          await current(); output = initial.output;
        };
        await withReviewReadSession(deps.sources, sourceInput, current, run, task => bounded(() => task), guard);
        await current(); if (!output) throw fail(); return output;
      } catch { throw fail(); }
      finally {
        finished = true;
        // A private composition cannot finish while its dependent preview or
        // policy work is still running, even if a public timeout has fired.
        if (readWork) await Promise.allSettled([...tasks]);
        release();
      }
  }
  const service = { scope, review: (raw, current) => review(raw, current), close() { lifetime.abort(); } } satisfies CandidateSaveReviewer & { close(): void };
  registerCallerBracketedReviewReadSession(service.review, scope, async (raw, current, work) => {
    await review(raw, current, work);
  });
  return service;
}
