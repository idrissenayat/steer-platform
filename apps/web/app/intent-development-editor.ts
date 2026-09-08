import type { IntentDevelopmentReviewInput } from '@steer/tool-registry/intent-development-review-contracts';
import { intentDevelopmentPrepareInputSchema, type IntentDevelopmentPrepareInput } from '@steer/tool-registry/intent-development-prepare-contracts';
import { intentDevelopmentStartInputSchema, type IntentDevelopmentStartInput } from '@steer/tool-registry/intent-development-start-contracts';
import type { IntentDevelopmentReadOutput } from '@steer/tool-registry/intent-development-read-contracts';
import type { IntentScopeReadOutput } from '@steer/tool-registry/intent-scope-read-contracts';
import { bindRecordedIntentScope, verifyBoundIntentScope, intentScopeSelectionFor, type IntentScopeSelection } from '@steer/tool-registry/intent-scope-selection';
import type { IntentDispositionChoice } from '@steer/tool-registry/intent-overlap-contracts';
import type { IntentDraftContent } from '@steer/tool-registry/intent-draft-content';
import type { IntentDevelopmentTransport } from './intent-development-transport.ts';

export type DevelopmentEditorSource = { input: IntentDevelopmentReviewInput; content: IntentDraftContent };
export interface DevelopmentEditorView {
  status: 'idle' | 'reviewing' | 'reviewed' | 'preparing' | 'preparation-unknown' | 'starting' | 'start-unknown' | 'reading'
    | 'pending' | 'needs-clarification' | 'candidates-ready' | 'attention-required' | 'superseded' | 'expired' | 'unavailable' | 'closed';
  review: Awaited<ReturnType<IntentDevelopmentTransport['review']>> | null;
  source: DevelopmentEditorSource | null; operation: IntentDevelopmentStartInput | null;
  observation: IntentDevelopmentReadOutput | null; message: string; sourceInvalidated: boolean;
}
const initial = (): DevelopmentEditorView => ({ status: 'idle', review: null, source: null, operation: null, observation: null, message: '', sourceInvalidated: false });
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** Owns one source revision and exact recovery requests. Observations are staged;
 * they never silently overwrite human edits or authorize another paid dispatch. */
export function createIntentDevelopmentEditor(transport: IntentDevelopmentTransport,
  currentSource: () => DevelopmentEditorSource | null, changed: (view: DevelopmentEditorView) => void) {
  let view = initial(), busy = false, closed = false, preparation: IntentDevelopmentPrepareInput | null = null;
  let retry: 'prepare' | 'start' | null = null;
  const publish = (next: Partial<DevelopmentEditorView>) => { if (!closed) { view = { ...view, ...next }; changed(structuredClone(view)); } };
  const sourceChanged = () => { if (view.source && !same(view.source, currentSource()) && !view.sourceInvalidated) publish({ sourceInvalidated: true }); };
  const matches = () => { sourceChanged(); return view.source !== null && !view.sourceInvalidated; };
  const unresolved = () => retry !== null || Boolean(view.operation && !['needs-clarification', 'candidates-ready', 'superseded', 'expired'].includes(view.status));
  async function read() {
    if (closed || busy || !view.operation) return;
    const { organizationId, productId, repository, operationId, inputDigest } = view.operation;
    busy = true; publish({ status: 'reading', message: '' });
    try {
      const output = await transport.read({ organizationId, productId, repository, operationId, inputDigest });
      if (closed) return;
      const input = view.source!.input;
      if ((['draftId', 'revision', 'revisionDigest', 'scopeInputDigest'] as const).some(k => output.source[k] !== input[k])) throw new Error();
      // Verified terminal records can recover the outcome without a scheduler
      // acknowledgement or another start. This grants no dispatch/retry authority.
      if (['needs-clarification', 'candidates-ready', 'superseded', 'expired'].includes(output.status)) { retry = null; preparation = null; }
      publish({ status: output.status, observation: output, message: '' });
    } catch { publish({ status: 'unavailable', observation: null,
      message: 'Progress could not be verified. Check the same run again after access is restored; do not start a replacement run.' }); }
    finally { busy = false; }
  }
  async function execute() {
    if (closed || busy || !retry || (retry === 'prepare' ? !preparation : !view.operation)) return;
    // Edits/undo never create authority to replay stale source. Read-only recovery
    // remains available for a known operation, even when the editor has changed.
    if (!matches()) { publish({ message: 'Your draft changed. This earlier request cannot be started or replayed from the current editor.' }); return; }
    busy = true; let readAfter = false;
    try {
      if (retry === 'prepare') {
        publish({ status: 'preparing', message: '' });
        const output = await transport.prepare(preparation!); if (closed) return;
        if (output.outcome !== 'prepared') {
          if (output.outcome === 'scope-incomplete' || output.outcome === 'conflict') {
            retry = null; preparation = null;
            publish({ status: 'idle', review: null, message: 'Sources or draft scope changed or coverage is incomplete. Review current evidence again; nothing was started.' });
          } else publish({ status: 'preparation-unknown', message: 'Preparation is not confirmed. Retry only this exact reviewed request; a record may already exist.' });
          return;
        }
        const { choice: _choice, sourceSnapshotDigest: _snapshot, configurationRevision: _configuration, scopeInputDigest: _scope, scopeReview: _assessment, ...source } = preparation!;
        publish({ operation: { ...source, ...output.reference! } }); retry = 'start';
      }
      if (!matches()) { publish({ status: 'start-unknown', message: 'The source was preserved, but your editor changed before start. No start request was sent.' }); return; }
      publish({ status: 'starting', message: '' });
      const output = await transport.start(view.operation!); if (closed) return;
      if (output.receipt.outcome !== 'acknowledged') { publish({ status: 'start-unknown', message: 'Start is not confirmed. Recover this same run; do not create a replacement.' }); return; }
      retry = null; publish({ status: 'pending', message: 'The recorded run was acknowledged. Checking captured results…' }); readAfter = true;
    } catch {
      publish({ status: retry === 'prepare' ? 'preparation-unknown' : 'start-unknown',
        message: 'The response was lost or access changed. Recover only the same request; no replacement run has been sent.' });
    } finally { busy = false; }
    if (readAfter) await read();
  }
  return {
    snapshot: () => structuredClone(view),
    sourceChanged,
    retryAvailable: () => retry !== null,
    async resume(raw: IntentDevelopmentStartInput) {
      const source = currentSource(), parsed = intentDevelopmentStartInputSchema.safeParse(raw);
      if (closed || busy || unresolved() || !source || !parsed.success) return;
      const operation = parsed.data;
      if ((['organizationId', 'productId', 'repository', 'draftId', 'revision', 'revisionDigest'] as const).some(k => source.input[k] !== operation[k])) return;
      preparation = null; retry = 'start';
      publish({ ...initial(), source: structuredClone(source), operation, status: 'pending' });
      // Discovery supplies a pointer, not execution authority. Read first. Only
      // explicit recovery can later request start under current server checks.
      await read();
    },
    async review() {
      const source = currentSource(); if (closed || busy || !source || unresolved()) return;
      busy = true; preparation = null; retry = null;
      publish({ ...initial(), status: 'reviewing', source: structuredClone(source) });
      try {
        const result = await transport.review(source.input); if (closed) return;
        if (!matches()) { publish({ status: 'idle', review: null, message: 'Your editor changed during source review. Preserve and review the current revision.' }); return; }
        publish({ status: 'reviewed', review: result, message: '' });
      } catch { publish({ status: 'idle', message: 'Current sources could not be reviewed. Your text is unchanged. This does not mean the intent is new.' }); }
      finally { busy = false; }
    },
    async develop(choice: IntentDispositionChoice, assessment?: IntentScopeReadOutput | null, subject?: string) {
      if (closed || busy || retry || view.status !== 'reviewed' || !matches() || !view.review?.envelope.coverage.complete) return;
      const { output, envelope } = view.review;
      let scopeReview: IntentScopeSelection | undefined;
      // Current UI always supplies this argument. Omission preserves the legacy
      // controller contract, but the assessed server factory rejects omission.
      if (assessment !== undefined) {
        busy = true;
        try {
          const selected = assessment?.review ? { kind: 'recorded' as const, reviewId: assessment.reviewId,
            preparationDigest: assessment.preparationDigest, resultsDigest: assessment.review.resultsDigest } : null;
          const bound = selected ? await bindRecordedIntentScope(selected, assessment, output.evidence, { ...view.source!.input, subject: subject ?? '' })
            : await verifyBoundIntentScope({ kind: 'empty-corpus', planDigest: output.scopeBatchPlan.planDigest }, output.evidence);
          if (closed || !matches() || view.review?.output !== output) return;
          scopeReview = intentScopeSelectionFor(bound);
        } catch { publish({ message: 'The assessment is incomplete, unavailable or changed. Read the current review before confirming direction.' }); return; }
        finally { busy = false; }
      }
      if ('target' in choice && !envelope.evidence.some(s => s.path === choice.target.path && s.contentDigest === choice.target.contentDigest
        && envelope.snapshot.head === choice.target.revision && s.path.endsWith('/BRIEF.md'))) return;
      const parsed = intentDevelopmentPrepareInputSchema.safeParse({ ...view.source!.input, configurationRevision: output.configurationRevision,
        sourceSnapshotDigest: output.sourceSnapshotDigest, choice, ...(scopeReview ? { scopeReview } : {}) });
      if (!parsed.success) return;
      preparation = parsed.data; retry = 'prepare'; await execute();
    },
    retry: execute, read,
    takeResult(): IntentDevelopmentReadOutput | null {
      if (closed || busy || retry || !matches() || !view.observation || !['needs-clarification', 'candidates-ready'].includes(view.status)) return null;
      return structuredClone(view.observation);
    },
    close() { closed = true; transport.close(); preparation = null; retry = null; view = { ...initial(), status: 'closed' }; },
  };
}
