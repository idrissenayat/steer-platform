import { z } from 'zod';
import { candidateSavePreviewInputSchema, candidateSaveDestinationSchema, describeCandidateSavePreview,
  type CandidateSavePreviewInput, type CandidateSavePreviewer } from '@steer/tool-registry/candidate-save-preview-contracts';
import { describeCandidateSaveDocuments, verifyCandidateSaveReview, type CandidateSaveReviewer,
  type CandidateSaveReviewOutput } from '@steer/tool-registry/candidate-save-review-contracts';
import { intentDraftReadOutputSchema, type IntentDraftService } from '@steer/tool-registry/intent-draft-contracts';
import { verifyIntentDevelopmentHistoryOutput, type IntentDevelopmentHistoryReader } from '@steer/tool-registry/intent-development-history-contracts';
import { createDevelopmentOriginalStore } from './development-originals.ts';
import { draftRecordsConfigurationSchema } from './draft-revisions.ts';
import { describeDevelopmentOriginal, developmentOriginalHash as hash, freezeOriginal as freeze } from './development-original-contracts.ts';
import { withReviewReadSession } from './review-read-session.ts';
import { readReviewDraft, type ReviewDraftRead } from './review-draft-read.ts';
import type { HistoricalOriginalSnapshot } from './historical-original-read-window.ts';

export type CandidateGenerationReadPair = Readonly<{ retained: HistoricalOriginalSnapshot;
  history: Awaited<ReturnType<typeof verifyIntentDevelopmentHistoryOutput>> }>;
/** Trusted server-only read phase. The provider owns final record/key/source
 * verification and actual drain AFTER work, and forbids escaped/parallel reads.
 * No action, public tool or execution authority is represented by this port. */
export interface CandidateGenerationReadSession {
  readonly configuration: unknown;
  readonly historyRead: IntentDevelopmentHistoryReader['read'];
  withRead<T>(input: Parameters<IntentDevelopmentHistoryReader['read']>[0], current: () => Promise<void>,
    work: (read: () => Promise<CandidateGenerationReadPair>) => Promise<T>): Promise<T>;
}

const configurationSchema = draftRecordsConfigurationSchema.extend({ serviceCommitter: z.string().min(1).max(200) });
const fail = () => new Error('Candidate package preview is unavailable; nothing was confirmed or saved.');
/** Read-only pre-confirmation composition. Reconstructs exact bytes and retained
 * SDK lineage under current records authority. No model, operation admission,
 * original payload write, consent acceptance or provider write port exists here. */
export function createCandidateSavePreviewer(pools: Parameters<typeof createDevelopmentOriginalStore>[0], raw: unknown, deps: {
  drafts: IntentDraftService;
  review: CandidateSaveReviewer;
  history: IntentDevelopmentHistoryReader;
  originals: Parameters<typeof createDevelopmentOriginalStore>[2];
  generationRead?: CandidateGenerationReadSession;
  destination: {
    readonly scope: CandidateSaveReviewer['scope'];
    resolve(input: CandidateSavePreviewInput, review: CandidateSaveReviewOutput, current: () => Promise<void>): Promise<unknown>;
  };
  authorizePreview(input: CandidateSavePreviewInput): Promise<void>;
}) {
  const config = freeze(configurationSchema.parse(raw)), { serviceCommitter, ...recordsConfig } = config;
  const { recordsPolicyDigest: _policy, ...scope } = recordsConfig;
  if ([deps.drafts?.read, deps.review?.review, deps.history?.read, deps.destination?.resolve, deps.authorizePreview,
    deps.originals?.authorizeHistoricalRead].some(v => typeof v !== 'function')) throw fail();
  const generationRead = deps.generationRead, historyRead = deps.history.read, generationMethod = generationRead?.withRead;
  const generationPinned = () => {
    if (deps.generationRead !== generationRead || (generationRead !== undefined && (!generationRead
      || generationRead.withRead !== generationMethod || typeof generationMethod !== 'function'
      || generationRead.historyRead !== historyRead || deps.history.read !== historyRead
      || hash(generationRead.configuration) !== hash(recordsConfig)))) throw fail();
  };
  generationPinned();
  let active = 0; const lifetime = new AbortController();
  return { scope: freeze(scope),
    async preview(rawInput, revalidate) {
      const input = freeze(candidateSavePreviewInputSchema.parse(rawInput));
      if (active >= 4 || lifetime.signal.aborted || typeof revalidate !== 'function') throw fail();
      active++; let pending = 0, finished = false, released = false;
      const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(60000)]);
      const release = () => { if (finished && !pending && !released) { released = true; active--; } };
      const guard = () => {
        generationPinned();
        signal.throwIfAborted();
        if (finished || (['organizationId', 'productId', 'repository', 'configurationRevision'] as const).some(k => input[k] !== scope[k])) throw fail();
        for (const port of [deps.drafts, deps.review, deps.history, deps.destination])
          if ((['organizationId', 'subject', 'productId', 'repository'] as const).some(k => port.scope[k] !== scope[k])) throw fail();
        for (const port of [deps.review, deps.destination])
          if (port.scope.branch !== scope.branch || port.scope.configurationRevision !== scope.configurationRevision) throw fail();
      };
      const bounded = async <T>(work: () => Promise<T>): Promise<T> => {
        guard(); pending++; let abort = () => {};
        const task = Promise.resolve().then(() => { guard(); return work(); });
        void task.finally(() => { pending--; release(); }).catch(() => {});
        try { return await Promise.race([task, new Promise<never>((_, reject) => {
          abort = () => reject(fail()); signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
        })]); } finally { signal.removeEventListener('abort', abort); }
      };
      const current = async () => { if (await bounded(revalidate) !== undefined) throw fail(); guard(); };
      const authorize = async () => { await current(); if (await bounded(() => deps.authorizePreview(input)) !== undefined) throw fail(); await current(); };
      let originals: ReturnType<typeof createDevelopmentOriginalStore> | undefined;
      const { reviewDigest: _reviewDigest, generation: target, itemId: _item, proposalId: _proposal, ...reviewInput } = input;
      let draftRead: ReviewDraftRead | undefined;
      const readDraft = async () => {
        await current();
        const selected = { organizationId: scope.organizationId, productId: scope.productId, repository: scope.repository, draftId: input.draftId, revision: input.revision };
        const draft = intentDraftReadOutputSchema.parse(await bounded(() => readReviewDraft(draftRead, deps.drafts, selected, () => deps.drafts.read(selected, current))));
        if (draft.latestRevision !== input.revision || !draft.content.documents
          || (['draftId', 'revision', 'revisionDigest', 'scopeInputDigest'] as const).some(k => draft[k] !== input[k])) throw fail();
        await current(); return freeze(draft);
      };
      try {
        let output: Awaited<ReturnType<typeof describeCandidateSavePreview>>['output'] | undefined;
        await withReviewReadSession(deps.review, reviewInput, current, async (readReviewed, borrowedDraft) => {
        draftRead = borrowedDraft;
        await authorize();
        if (!generationRead) originals = createDevelopmentOriginalStore(pools, recordsConfig, deps.originals);
        const draft = await readDraft();
        const readReview = async () => verifyCandidateSaveReview(reviewInput, await bounded(() => readReviewed(current)), draft.content.documents);
        const review = await readReview();
        if (review.subject !== scope.subject || review.branch !== scope.branch || review.reviewDigest !== input.reviewDigest) throw fail();
        const build = async (readPair?: () => Promise<CandidateGenerationReadPair>) => {
        const readOriginal = () => bounded(async () => readPair ? (await readPair()).retained : originals!.readHistorical(target));
        const retained = await readOriginal();
        const described = await describeDevelopmentOriginal(retained.original), original = described.original;
        if (described.inputDigest !== target.inputDigest || retained.latestDraftRevision !== input.revision
          || (Object.keys(recordsConfig) as Array<keyof typeof recordsConfig>).some(k => original.configuration[k] !== recordsConfig[k])) throw fail();
        const readHistory = async () => verifyIntentDevelopmentHistoryOutput(await bounded(async () => readPair ? (await readPair()).history
          : deps.history.read({ organizationId: scope.organizationId, productId: scope.productId, repository: scope.repository, ...target }, current)));
        const history = await readHistory();
        if (history.status !== 'complete' || history.operationId !== target.operationId || history.inputDigest !== target.inputDigest
          || (['organizationId', 'productId', 'repository'] as const).some(k => history[k] !== scope[k])
          || history.operationExpired !== retained.operationExpired || history.source.latestRevision !== retained.latestDraftRevision
          || (['draftId', 'revision', 'revisionDigest', 'scopeInputDigest'] as const).some(k => history.source[k] !== original.source[k])) throw fail();
        const architect = history.results[0]!, exam = history.results[1]!;
        if (architect.result.role !== 'architect' || exam.result.role !== 'test-agent') throw fail();
        const role = (r: typeof architect, configurationRevision: string) => ({ configurationRevision, resultRef: r.resultRef,
          resultDigest: r.resultDigest, outputDigest: r.outputDigest });
        const lineage = { ...target, source: history.source, architect: role(architect, original.profiles.architect.configurationRevision),
          testAgent: role(exam, original.profiles.testAgent.configurationRevision),
          originalDocuments: await describeCandidateSaveDocuments({ brief: architect.result.output.brief, spec: architect.result.output.spec, exam: exam.result.output.exam }) };
        const readDestination = async () => candidateSaveDestinationSchema.parse(await bounded(() => deps.destination.resolve(input, review, current)));
        const destination = await readDestination();
        const prepared = await describeCandidateSavePreview(input, review, draft.content.documents, lineage, destination, serviceCommitter);
        // A human edit, head/lifecycle move or loss of retained records authority
        // during verification invalidates the whole proposal, not only one field.
        await authorize();
        const { operationExpired: _initialExpiry, ...initialHistory } = history;
        const { operationExpired: _finalExpiry, ...finalHistory } = await readHistory();
        if (JSON.stringify(initialHistory) !== JSON.stringify(finalHistory)) throw fail();
        const finalOriginal = await readOriginal();
        if (JSON.stringify(finalOriginal.original) !== JSON.stringify(original) || finalOriginal.latestDraftRevision !== input.revision
          || JSON.stringify(await readReview()) !== JSON.stringify(review) || JSON.stringify(await readDestination()) !== JSON.stringify(destination)
          || JSON.stringify(await readDraft()) !== JSON.stringify(draft)) throw fail();
        await authorize(); output = prepared.output;
        };
        if (generationRead) await bounded(() => generationRead.withRead({ organizationId: scope.organizationId,
          productId: scope.productId, repository: scope.repository, ...target }, current, build));
        else await build();
        }, task => bounded(() => task), guard);
        await current(); if (!output) throw fail(); return output;
      } catch { throw fail(); }
      finally { finished = true; originals?.close(); release(); }
    },
    close() { lifetime.abort(); },
  } satisfies CandidateSavePreviewer & { close(): void };
}
