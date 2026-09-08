'use client';

import { useEffect, useRef, useState } from 'react';
import { intentDraftContentSchema, type IntentDraftContent } from '@steer/tool-registry/intent-draft-content';
import { createIntentDraftTransport } from './intent-draft-transport';
import { createIntentDraftEditor, type DraftEditorView } from './intent-draft-editor';
import BriefMarkdown from './brief-markdown';
import IntentDevelopmentPanel from './intent-development-panel';
import type { DevelopmentEditorSource } from './intent-development-editor';
import type { IntentDevelopmentReadOutput } from '@steer/tool-registry/intent-development-read-contracts';

export default function IntentDraftPanel({ organizationId, productId, repository, subject, expiresAt, content, locked, onRestore, enabled = false, onResult }: {
  organizationId: string; productId: string; repository: string; subject: string; expiresAt: string;
  content: IntentDraftContent; locked: boolean; onRestore: (content: IntentDraftContent) => void;
  enabled?: boolean; onResult?: (source: DevelopmentEditorSource, result: IntentDevelopmentReadOutput) => void;
}) {
  const [view, setView] = useState<DraftEditorView | null>(null), [draftId, setDraftId] = useState('');
  const [reviewRequest, setReviewRequest] = useState<{ sequence: number; revisionDigest: string } | null>(null);
  const editor = useRef<ReturnType<typeof createIntentDraftEditor> | null>(null);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const reviewButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (view?.status === 'restore-ready') previewHeading.current?.focus(); }, [view?.status]);
  useEffect(() => {
    let last = Date.now(), closed = false;
    const current = createIntentDraftEditor({ organizationId, productId, repository }, createIntentDraftTransport(window.location.origin), next => {
      const now = Date.now(), expiry = Date.parse(expiresAt);
      if (closed || !Number.isFinite(expiry) || now < last || now >= expiry || document.visibilityState === 'hidden') { close(); return; }
      last = now; setView(next);
    });
    editor.current = current; setView(current.snapshot()); setDraftId(''); setReviewRequest(null);
    const close = () => { closed = true; current.close(); setView(current.snapshot()); setDraftId(''); };
    const check = () => { const now = Date.now(), expiry = Date.parse(expiresAt); if (!Number.isFinite(expiry) || now < last || now >= expiry) close(); last = now; };
    const hide = () => { if (document.visibilityState === 'hidden') close(); };
    const timer = setInterval(() => { if (!closed) check(); }, 1000); check(); hide();
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', close);
    return () => { current.close(); if (editor.current === current) editor.current = null; clearInterval(timer);
      document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', close); };
  }, [organizationId, productId, repository, subject, expiresAt]);
  if (!view || view.status === 'closed') return null;
  const pending = view.status === 'saving' || view.status === 'reading';
  const matches = JSON.stringify(content) === JSON.stringify(view.preservedContent);
  const valid = intentDraftContentSchema.safeParse(content).success && Boolean(content.originalText.trim());
  const developmentSource: DevelopmentEditorSource | null = view.status === 'preserved' && matches && valid && view.draftId && view.revisionDigest && view.scopeInputDigest
    ? { input: { organizationId, productId, repository, draftId: view.draftId, revision: view.revision,
      revisionDigest: view.revisionDigest, scopeInputDigest: view.scopeInputDigest }, content } : null;
  return <section className="intent-draft-preservation access-note" aria-labelledby="draft-preservation-title">
    <h3 id="draft-preservation-title">Preserve your working draft</h3>
    <p>Keep an editable server draft separately from GitHub. This does not run agents, verify documents, or sign a gate. Current records-policy and account access are checked on every request.</p>
    <div role="status" aria-live="polite" aria-atomic="true">
      {view.revision > 0 ? <p>{matches ? `Draft revision ${view.revision} preserved.` : `Draft revision ${view.revision} preserved; your current edits are not preserved.`} Not saved to GitHub.</p>
        : <p>No content preservation acknowledged.</p>}
      {pending && <p>{view.status === 'saving' ? 'Preserving this revision… You can keep editing; newer edits need their own save.' : 'Reading the stored draft… Your current text will not be replaced automatically.'}</p>}
      {view.message && <p>{view.message}</p>}
    </div>
    {view.draftId && <p>Draft reference: <code>{view.draftId}</code>. Keep this reference to reopen the draft after signing in again. A reference alone does not confirm preserved content.</p>}
    <p className="access-hint">This page keeps no browser-storage copy. Hiding, refreshing, or losing this session clears unpreserved text and in-page recovery requests. An uncertain request may already have reached the server.</p>
    <div className="intent-document-buttons">
      {onResult && <button className="access-primary" type="button" disabled={locked || pending || !valid || view.retryAvailable || view.status === 'conflict' || view.status === 'restore-ready'}
        onClick={() => { const current = editor.current; if (!current) return; void (async () => {
          await current.save(content); if (editor.current !== current) return;
          const saved = current.snapshot();
          if (saved.status === 'preserved' && saved.revisionDigest && JSON.stringify(saved.preservedContent) === JSON.stringify(content))
            setReviewRequest(previous => ({ sequence: (previous?.sequence ?? 0) + 1, revisionDigest: saved.revisionDigest! }));
        })(); }}>Preserve and review my intent</button>}
      <button className="access-secondary" type="button" disabled={locked || pending || !valid || matches || view.retryAvailable || view.status === 'conflict' || view.status === 'restore-ready'}
        onClick={() => { void editor.current?.save(content); }}>Preserve draft</button>
      {view.retryAvailable && <button className="access-secondary" type="button" disabled={locked || pending}
        onClick={() => { void editor.current?.retry(); }}>Retry exact request</button>}
      {view.draftId && <button ref={reviewButton} className="access-secondary" type="button" disabled={locked || pending || view.retryAvailable}
        onClick={() => { void editor.current?.load(view.draftId!); }}>Review stored revision</button>}
    </div>
    <details><summary>Reopen a draft by reference</summary>
      <label htmlFor="intent-draft-reference">Draft reference</label>
      <input id="intent-draft-reference" type="text" autoComplete="off" maxLength={36} value={draftId} onChange={event => setDraftId(event.target.value)} />
      <button className="access-secondary" type="button" disabled={locked || pending || view.retryAvailable || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(draftId)}
        onClick={() => { void editor.current?.load(draftId); }}>Read stored draft</button>
    </details>
    {view.restored && <div className="intent-restored-preview"><h4 tabIndex={-1} ref={previewHeading}>Stored revision {view.restored.revision} — review before replacing</h4>
      <p>Snapshot at read time. Another edit can still cause a conflict on your next save. Stored text does not establish agent authorship or prior approval.</p>
      <details open><summary>Stored intent and clarification</summary><pre className="intent-draft-source">{view.restored.content.originalText}</pre>
        {view.restored.content.clarificationTurns.map((turn, index) => <pre className="intent-draft-source" key={index}>{turn}</pre>)}</details>
      {view.restored.content.documents && (['brief', 'spec', 'exam'] as const).map(name => <details key={name}><summary>Stored {name.toUpperCase()}.md</summary>
        <BriefMarkdown content={view.restored!.content.documents![name]} /></details>)}
      <button className="access-secondary" type="button" disabled={locked || pending} onClick={() => {
        const restored = editor.current?.acceptRestore(); if (restored) onRestore(restored);
      }}>Replace editor with this stored revision</button>
      <button className="access-secondary" type="button" disabled={locked || pending} onClick={() => {
        editor.current?.cancelRestore(); (reviewButton.current ?? document.getElementById('intent-draft-reference'))?.focus();
      }}>Keep my current text</button>
      <p>Replacing will remove all current editor text. Choose “Keep my current text” to close this preview without replacing anything; an existing conflict will remain unresolved.</p>
    </div>}
    {onResult && <IntentDevelopmentPanel source={developmentSource} enabled={enabled} identity={JSON.stringify([organizationId, productId, repository, subject])}
      expiresAt={expiresAt} onResult={onResult} reviewRequest={reviewRequest} />}
  </section>;
}
