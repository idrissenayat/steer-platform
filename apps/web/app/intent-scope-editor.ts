import { intentScopePrepareInputSchema, type IntentScopePrepareInput, type IntentScopePrepareOutput } from '@steer/tool-registry/intent-scope-prepare-contracts';
import type { IntentScopeStartInput } from '@steer/tool-registry/intent-scope-start-contracts';
import type { IntentScopeReadOutput } from '@steer/tool-registry/intent-scope-read-contracts';
import { intentScopeDiscoveryInputSchema, intentScopeDiscoveryOutputSchema, type IntentScopeDiscoveryOutput, type IntentScopeDiscoveryEntry } from '@steer/tool-registry/intent-scope-discovery-contracts';
import type { IntentDevelopmentReviewOutput } from '@steer/tool-registry/intent-development-review-contracts';
import { validateIntentScopeBatchResults } from '@steer/tool-registry/intent-scope-batches';
import type { IntentScopeTransport } from './intent-scope-transport.ts';

export interface ScopeEditorSource {
  input: IntentScopePrepareInput; subject: string;
  evidence: IntentDevelopmentReviewOutput['evidence']; plan: IntentDevelopmentReviewOutput['scopeBatchPlan'];
}
export interface ScopeEditorView {
  status: 'idle' | 'preparing' | 'preparation-unknown' | 'starting' | 'start-unknown' | 'reading' | 'pending'
    | 'review-available' | 'incomplete' | 'attention-required' | 'superseded' | 'expired' | 'no-sources' | 'conflict' | 'unavailable' | 'closed';
  source: ScopeEditorSource | null; operation: IntentScopeStartInput | null;
  preparation: IntentScopePrepareOutput | null; observation: IntentScopeReadOutput | null;
  sourceInvalidated: boolean; locked: boolean; retryAvailable: boolean; message: string;
  discovery: IntentScopeDiscoveryOutput | null; discoveryStatus: 'idle' | 'loading' | 'available' | 'unavailable';
}
const initial = (): ScopeEditorView => ({ status: 'idle', source: null, operation: null, preparation: null,
  observation: null, sourceInvalidated: false, locked: false, retryAvailable: false, message: '', discovery: null, discoveryStatus: 'idle' });
const terminal = new Set(['review-available', 'incomplete', 'superseded', 'expired', 'no-sources', 'conflict']);
const canonical = (value: unknown) => JSON.stringify(value, (_key, part) => part && typeof part === 'object' && !Array.isArray(part)
  ? Object.fromEntries(Object.entries(part).sort(([a], [b]) => a.localeCompare(b))) : part);
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);
/** Holds exact in-memory recovery references, never replaces human text and never
 * interprets workflow status or partial/no-match findings as permission. */
export function createIntentScopeEditor(transport: IntentScopeTransport,
  currentSource: () => ScopeEditorSource | null, changed: (view: ScopeEditorView) => void) {
  let view = initial(), closed = false, busy = false, retry: 'prepare' | 'start' | null = null, recovered = false;
  const publish = (patch: Partial<ScopeEditorView>) => {
    if (closed) return;
    view = { ...view, ...patch }; view.retryAvailable = retry !== null;
    view.locked = busy || retry !== null || Boolean(view.operation && !terminal.has(view.status));
    changed(structuredClone(view));
  };
  const sourceChanged = () => { if (view.source && !same(view.source, currentSource()) && !view.sourceInvalidated) publish({ sourceInvalidated: true }); };
  const matches = () => { sourceChanged(); return view.source !== null && !view.sourceInvalidated; };
  async function read() {
    if (closed || busy || !view.operation || !view.source) return;
    const { organizationId, productId, repository, reviewId, preparationDigest } = view.operation;
    busy = true; publish({ status: 'reading', message: '' });
    try {
      const result = await transport.read({ organizationId, productId, repository, reviewId, preparationDigest });
      if (closed) return;
      const source = view.source;
      if (result.subject !== source.subject || (['draftId', 'revision', 'revisionDigest', 'scopeInputDigest'] as const).some(k => result.source[k] !== source.input[k])) throw new Error();
      if (result.review) {
        const receipts = result.review.results.map(r => ({ planDigest: result.review!.planDigest, batchId: r.batchId,
          assessment: { assessmentInputDigest: r.assessmentInputDigest, configurationRevision: r.configurationRevision, findings: r.findings } }));
        const verified = await validateIntentScopeBatchResults(source.evidence, receipts, result.review.configurationRevision);
        if (closed) return;
        if (verified.planDigest !== source.plan.planDigest || !same(verified, result.review)) throw new Error();
      }
      sourceChanged();
      if (terminal.has(result.status) || result.status === 'attention-required') retry = null;
      if (recovered && result.status === 'pending' && matches()) retry = 'start';
      publish({ status: result.status, observation: result, message: recovered && result.status === 'pending'
        ? 'Retained progress was read first. You may keep checking it, or explicitly recover this exact workflow under current start permissions.' : '' });
    } catch { publish({ status: 'unavailable', observation: null,
      message: 'Review progress could not be verified. Check this same review after access is restored; this is not a no-match result.' }); }
    finally { busy = false; publish({}); }
  }
  async function execute() {
    if (closed || busy || !retry || !view.source) return;
    if (!matches()) { publish({ message: 'Your scope changed. Do not restart this earlier request from the current editor. Known review progress can still be checked.' }); return; }
    busy = true; let readAfter = false;
    try {
      if (retry === 'prepare') {
        publish({ status: 'preparing', message: '' });
        const output = await transport.prepare(view.source.input); if (closed) return;
        publish({ preparation: output });
        if (output.outcome !== 'prepared') {
          if (['no-sources', 'scope-incomplete', 'conflict'].includes(output.outcome)) {
            retry = null;
            publish({ status: output.outcome === 'scope-incomplete' ? 'incomplete' : output.outcome as 'no-sources' | 'conflict',
              message: output.outcome === 'no-sources' ? 'No reviewable sources were found in this inventory. No model was started; this does not establish global uniqueness.'
                : 'The source snapshot changed or no complete target can be assessed. Review current sources again; nothing was started.' });
          } else publish({ status: 'preparation-unknown', message: 'Preparation is not confirmed. Recover only this exact request; retained records may already exist.' });
          return;
        }
        const { configurationRevision: _configuration, sourceSnapshotDigest: _snapshot, scopeInputDigest: _scope, ...input } = view.source.input;
        publish({ operation: { ...input, ...output.reference! } }); retry = 'start';
      }
      if (!matches()) { publish({ status: 'start-unknown', message: 'The source was preserved, but your editor changed before start. No start request was sent.' }); return; }
      publish({ status: 'starting', message: '' });
      const output = await transport.start(view.operation!); if (closed) return;
      if (output.receipt.outcome !== 'acknowledged') { publish({ status: 'start-unknown', message: 'Start is not confirmed. Read progress or recover this same review; do not create a replacement.' }); return; }
      recovered = false; retry = null; publish({ status: 'pending', message: 'Review workflow acknowledged. Checking verified findings…' }); readAfter = true;
    } catch { publish({ status: retry === 'prepare' ? 'preparation-unknown' : 'start-unknown',
      message: 'The response was lost or access changed. Recover the same scope request; no replacement was sent.' }); }
    finally { busy = false; publish({}); }
    if (readAfter) await read();
  }
  return {
    snapshot: () => structuredClone(view), sourceChanged, read, retry: execute,
    async discover(cursor: string | null = null) {
      const source = currentSource(); if (closed || busy || retry || !source || (view.operation && !matches())) return;
      const { configurationRevision: _config, sourceSnapshotDigest: _snapshot, ...ref } = source.input;
      const input = intentScopeDiscoveryInputSchema.parse({ ...ref, cursor });
      if (cursor && (!view.discovery || view.discovery.nextCursor !== cursor || !matches())) return;
      busy = true;
      if (!view.operation) publish({ ...initial(), source: structuredClone(source) });
      publish({ discovery: null, discoveryStatus: 'loading', message: '' });
      try {
        const output = intentScopeDiscoveryOutputSchema.parse(await transport.discover(input)); if (closed) return;
        if ((Object.keys(input) as Array<keyof typeof input>).some(k => output[k] !== input[k]) || Date.parse(output.useUntil) <= Date.now()) throw new Error();
        sourceChanged(); if (!matches()) throw new Error();
        publish({ discovery: output, discoveryStatus: 'available' });
      } catch { publish({ discovery: null, discoveryStatus: 'unavailable', observation: null,
        message: 'Retained review discovery could not be verified. This is not an empty search or permission to create replacement work.' }); }
      finally { busy = false; publish({}); }
    },
    async resume(entry: IntentScopeDiscoveryEntry) {
      if (closed || busy || retry || !matches() || !view.discovery || Date.parse(view.discovery.useUntil) <= Date.now()
        || !view.discovery.entries.some(e => same(e, entry))) return;
      const { configurationRevision: _config, sourceSnapshotDigest: _snapshot, scopeInputDigest: _scope, ...source } = view.source!.input;
      recovered = true; publish({ operation: { ...source, ...entry }, preparation: null, observation: null, status: 'reading', message: '' });
      await read();
    },
    async assess() {
      const source = currentSource(); if (closed || busy || view.locked || !source) return;
      const input = intentScopePrepareInputSchema.parse(source.input);
      recovered = false; retry = 'prepare'; publish({ ...initial(), source: structuredClone({ ...source, input }) }); await execute();
    },
    close() { closed = true; transport.close(); retry = null; view = { ...initial(), status: 'closed' }; },
  };
}
