import { intentDraftScopeSchema, type IntentDraftCreateInput, type IntentDraftAppendInput,
  type IntentDraftReadOutput } from '@steer/tool-registry/intent-draft-contracts';
import { intentDraftContentSchema, type IntentDraftContent } from '@steer/tool-registry/intent-draft-content';
import type { IntentDraftTransport } from './intent-draft-transport.ts';

type Pending = { kind: 'create'; input: IntentDraftCreateInput; content: IntentDraftContent }
  | { kind: 'append'; input: IntentDraftAppendInput };
export interface DraftEditorView {
  status: 'idle' | 'saving' | 'preserved' | 'unknown' | 'conflict' | 'reading' | 'restore-ready' | 'closed';
  draftId: string | null; revision: number; latestRevision: number;
  preservedContent: IntentDraftContent | null; restored: IntentDraftReadOutput | null;
  message: string; retryAvailable: boolean;
}
const initial = (): DraftEditorView => ({ status: 'idle', draftId: null, revision: 0, latestRevision: 0,
  preservedContent: null, restored: null, message: '', retryAvailable: false });

/** One verified session/scope, memory only. No automatic retries or implicit replacement. */
export function createIntentDraftEditor(rawScope: unknown, transport: IntentDraftTransport,
  changed: (view: DraftEditorView) => void, uuid: () => string = () => crypto.randomUUID()) {
  const scope = intentDraftScopeSchema.parse(rawScope);
  let view = initial(), pending: Pending | null = null, digest: string | null = null, busy = false, closed = false;
  let restoreStatus: DraftEditorView['status'] = 'idle';
  const publish = (next: Partial<DraftEditorView>) => { if (!closed) { view = { ...view, ...next }; changed(structuredClone(view)); } };
  async function execute() {
    if (closed || busy || !pending) return;
    busy = true; publish({ status: 'saving', restored: null, retryAvailable: false, message: '' });
    try {
      if (pending.kind === 'create') {
        const request = pending;
        const output = await transport.create(request.input);
        if (closed) return;
        if (output.outcome !== 'created') { publish({ status: 'unknown', retryAvailable: true,
          message: 'The draft reference is not confirmed. Retry this exact request; no content preservation has been acknowledged.' }); return; }
        publish({ draftId: output.draftId });
        pending = { kind: 'append', input: { ...scope, draftId: output.draftId, mutationId: uuid(), expectedRevision: 0,
          expectedDigest: null, content: request.content } };
      }
      const request = pending.input;
      const output = await transport.append(request);
      if (closed) return;
      if (output.outcome === 'acknowledged') {
        digest = output.revisionDigest; pending = null;
        publish({ status: output.latestRevision > output.revision ? 'conflict' : 'preserved', revision: output.revision,
          latestRevision: output.latestRevision, preservedContent: request.content, retryAvailable: false,
          message: output.latestRevision > output.revision ? 'Your earlier revision was preserved, but a newer revision exists. Review it before saving again.' : '' });
      } else if (output.outcome === 'conflict') {
        pending = null; publish({ status: 'conflict', retryAvailable: false,
          message: 'Another revision is already present. Your current text is unchanged. Review the stored draft before continuing.' });
      } else publish({ status: 'unknown', retryAvailable: true,
        message: 'Preservation is not confirmed. The server may have stored this revision. Retry the exact request before sending newer edits.' });
    } catch {
      if (!closed) publish({ status: 'unknown', retryAvailable: true,
        message: 'Preservation is not confirmed. Access or the connection may have changed. Retry the exact request after access is restored; do not start a replacement save.' });
    } finally { busy = false; }
  }
  return {
    snapshot: () => structuredClone(view),
    async save(raw: IntentDraftContent) {
      if (closed || busy || pending || view.status === 'conflict' || view.status === 'restore-ready') return;
      const parsed = intentDraftContentSchema.safeParse(raw);
      if (!parsed.success) { publish({ message: 'This draft contains invalid text. Correct it before preserving it; no request was sent.' }); return; }
      const content = parsed.data;
      if (JSON.stringify(content) === JSON.stringify(view.preservedContent)) return;
      const placeholder = '00000000-0000-4000-8000-000000000000';
      if (new TextEncoder().encode(JSON.stringify({ ...scope, draftId: view.draftId ?? placeholder, mutationId: placeholder,
        expectedRevision: view.revision, expectedDigest: digest, content })).length > 262144) {
        publish({ message: 'This draft exceeds the request size limit. Shorten it before preserving it; no request was sent.' }); return;
      }
      if (view.revision >= 1000) { publish({ message: 'This draft reached its revision limit. Your text remains here; no new request was sent.' }); return; }
      pending = view.draftId ? { kind: 'append', input: { ...scope, draftId: view.draftId, mutationId: uuid(),
        expectedRevision: view.revision, expectedDigest: digest, content } }
        : { kind: 'create', input: { ...scope, requestId: uuid() }, content };
      await execute();
    },
    retry: execute,
    async load(draftId: string) {
      if (closed || busy || pending) return;
      busy = true; const priorStatus = view.status === 'restore-ready' ? restoreStatus : view.status;
      publish({ status: 'reading', restored: null, message: '' });
      try {
        const result = await transport.read({ ...scope, draftId, revision: 'latest' });
        if (closed) return;
        if (result.revision !== result.latestRevision) {
          publish({ status: priorStatus, message: 'The stored draft changed during the read. Read it again; your current text is unchanged.' }); return;
        }
        restoreStatus = priorStatus;
        publish({ status: 'restore-ready', restored: result,
          message: 'Review the stored content below. Loading it will replace the current editor text and require fresh scope and document review.' });
      } catch { publish({ status: priorStatus,
        message: 'The stored draft could not be read with current access. Your current text is unchanged.' }); }
      finally { busy = false; }
    },
    cancelRestore() {
      if (closed || busy || !view.restored) return;
      publish({ status: restoreStatus, restored: null, message: restoreStatus === 'conflict'
        ? 'Stored preview closed. Your current text is unchanged; the revision conflict still needs resolution.'
        : 'Stored preview closed. Your current text is unchanged.' });
    },
    acceptRestore(): IntentDraftContent | null {
      if (closed || busy || !view.restored) return null;
      const restored = view.restored;
      digest = restored.revisionDigest;
      publish({ status: 'preserved', draftId: restored.draftId, revision: restored.revision, latestRevision: restored.latestRevision,
        preservedContent: restored.content, restored: null, message: 'Stored draft loaded. Scope, authorship and approvals have not been restored.' });
      return structuredClone(restored.content);
    },
    close() { closed = true; transport.close(); pending = null; digest = null; view = { ...initial(), status: 'closed' }; },
  };
}
