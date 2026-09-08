'use client';

import { useEffect, useRef, useState } from 'react';
import type { AgentOutput } from '@steer/tool-registry/agent-contracts';
import { agentScopeText } from '@steer/tool-registry/agent-contracts';
import type { IntentDispositionProposal } from '@steer/tool-registry/intent-overlap-contracts';
import { intentDocumentChanges, invalidateIntentReviews, type IntentReviewDependency } from '@steer/tool-registry/intent-revision-contracts';
import { AgentScopeChangedError, createAgentTransport } from './agent-transport';
import BriefMarkdown from './brief-markdown';
import IntentScopeReview from './intent-scope-review';

export default function IntentConversation({ organizationId, subject, expiresAt, enabled, repository = null }: {
  organizationId: string; subject: string; expiresAt: string; enabled: boolean; repository?: string | null;
}) {
  const [intent, setIntent] = useState(''); const [clarification, setClarification] = useState('');
  const [result, setResult] = useState<AgentOutput | null>(null); const [error, setError] = useState('');
  const [busy, setBusy] = useState(false); const [expired, setExpired] = useState(false);
  const [disposition, setDisposition] = useState<IntentDispositionProposal | null>(null);
  const [scopeReviewVersion, setScopeReviewVersion] = useState(0);
  const [selected, setSelected] = useState<'brief' | 'spec' | 'exam'>('brief');
  const [editedDocuments, setEditedDocuments] = useState<NonNullable<AgentOutput['documents']> | null>(null);
  const [invalidatedReviews, setInvalidatedReviews] = useState<IntentReviewDependency[]>([]);
  const [documentRevision, setDocumentRevision] = useState(1);
  const [documentMode, setDocumentMode] = useState<'preview' | 'edit' | 'original'>('preview');
  const transport = useRef<ReturnType<typeof createAgentTransport> | null>(null);
  const live = useRef(true); const pending = useRef(false);
  useEffect(() => {
    live.current = true; let last = Date.now();
    pending.current = false; setBusy(false); setExpired(false);
    setIntent(''); setClarification(''); setResult(null); setEditedDocuments(null); setDisposition(null); setError('');
    setInvalidatedReviews([]); setDocumentRevision(1);
    transport.current = createAgentTransport(window.location.origin);
    const expire = () => {
      live.current = false; transport.current?.close(); setExpired(true); setBusy(false);
      setIntent(''); setClarification(''); setResult(null); setEditedDocuments(null); setDisposition(null); setError('');
      setInvalidatedReviews([]); setDocumentRevision(1);
    };
    const check = () => { const now = Date.now(), expiry = Date.parse(expiresAt); if (!Number.isFinite(expiry) || now < last || now >= expiry) expire(); last = now; };
    const timer = setInterval(check, 1000); check();
    const hide = () => { if (document.visibilityState === 'hidden') expire(); };
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', expire);
    return () => { live.current = false; clearInterval(timer); transport.current?.close(); document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', expire); };
  }, [expiresAt, organizationId, subject, repository]);
  async function send() {
    if (pending.current || !live.current || !enabled || !intent.trim() || !disposition || result?.documents) return;
    const current = transport.current; if (!current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const output = await current.develop({ organizationId, intent, clarification, disposition });
      if (!live.current || transport.current !== current) return;
      if (output.organizationId !== organizationId || output.subject !== subject || Date.now() >= Date.parse(expiresAt)) throw new Error('Workspace access changed. Refresh access before continuing.');
      setResult(output); setSelected('brief'); setDocumentMode('preview');
      setEditedDocuments(output.documents ? { ...output.documents } : null);
      // The initial lexical/interview review never clears newly generated scope.
      setInvalidatedReviews(output.documents ? invalidateIntentReviews(['brief']) : []);
      setDocumentRevision(1);
    } catch (cause) { if (live.current && transport.current === current && cause instanceof AgentScopeChangedError) { setDisposition(null); setScopeReviewVersion(version => version + 1); } if (live.current && transport.current === current) setError(cause instanceof Error && cause.message.length < 300 && !cause.message.startsWith('[')
      ? cause.message : 'The agent could not finish. Your text is still here. Nothing was saved.'); }
    finally { if (transport.current === current) { pending.current = false; if (live.current) setBusy(false); } }
  }
  function editDocument(content: string) {
    if (!editedDocuments || !live.current || content === editedDocuments[selected]) return;
    const next = { ...editedDocuments, [selected]: content };
    const changes = intentDocumentChanges(editedDocuments, next);
    setEditedDocuments(next); setDocumentRevision(revision => revision + 1);
    setInvalidatedReviews(previous => invalidateIntentReviews(changes, previous));
    if (changes.includes('brief') || changes.includes('spec')) setDisposition(null);
  }
  return <section className="intent-conversation access-card" aria-labelledby="intent-conversation-title">
    <div className="eyebrow">Start with intent</div><h2 id="intent-conversation-title">What would you like to change?</h2>
    <p>Describe the problem, idea, or outcome in your own words. The agent will review it, ask only what’s needed, then draft your Brief, Spec, and Exam.</p>
    {!enabled && <p className="access-note" role="status">Live agent setup is pending. Model usage needs an approved budget and an enabled connection before you can send your intent.</p>}
    {expired ? <p role="alert">This conversation was cleared when the session expired or the page was hidden. <a href="/">Refresh access</a> to continue.</p> : <>
      <form onSubmit={event => { event.preventDefault(); void send(); }}>
        <label htmlFor="agent-intent">Your intent</label>
        <textarea id="agent-intent" rows={7} maxLength={10000} value={intent} disabled={busy || Boolean(result?.documents)}
          placeholder="I want to…" onChange={event => { if (result?.documents) return; setIntent(event.target.value); setResult(null); setClarification(''); }} />
        <IntentScopeReview organizationId={organizationId} repository={repository} intent={agentScopeText({ intent, clarification })} expiresAt={expiresAt} onProposalChange={setDisposition} locked={busy || Boolean(result?.documents)} historical={Boolean(result?.documents)} reviewVersion={scopeReviewVersion} />
        {result && <div className="intent-agent-reply"><h3>STEER agent</h3><p>{result.message}</p>
          {result.questions.length > 0 && <><ul>{result.questions.map((question, index) => <li key={index}>{question}</li>)}</ul>
            <label htmlFor="agent-clarification">Add details in your own words</label>
            <textarea id="agent-clarification" rows={4} maxLength={3000} value={clarification} disabled={busy} onChange={event => setClarification(event.target.value)} /></>}
        </div>}
        <p className="access-hint">Not saved. Hiding or refreshing the page clears this conversation. Sending uses the configured model provider.</p>
        {!disposition && !result?.documents && <p className="access-hint">Check existing scope and confirm your direction before sending. Added clarification needs a fresh scope review.</p>}
        <button className="access-primary" type="submit" disabled={!enabled || busy || !intent.trim() || !disposition || Boolean(result?.documents) || Boolean(result?.questions.length && !clarification.trim())}>
          {busy ? 'Agent is working…' : result?.questions.length ? 'Continue with these details' : 'Review my intent'}</button>
      </form>
      {busy && <p role="status">Reviewing your intent and preparing the next response. This can take up to 90 seconds. Please keep this page open.</p>}
      {error && <p role="alert" className="access-note">{error}</p>}
      {result?.documents && editedDocuments && <div className="intent-documents"><h3>Your draft documents</h3>
        <p>Generated candidates · not saved to GitHub · no gate signed · tests not run</p>
        <p className="access-note">Your edits are not saved yet. Refreshing, hiding this page or losing access clears them. Source text is locked while you review this bundle so edits cannot silently replace it.</p>
        <div className="access-note" role="status" aria-live="polite" aria-atomic="true" data-intent-review-state="needs-scope-review">
          <strong>Scope review needed</strong>
          <p>{documentRevision === 1
            ? 'The generated Brief and Spec need their own scope review. The earlier check covered your message, not these documents.'
            : 'Your current draft still needs scope review. Brief or Spec edits invalidate the earlier scope check and direction confirmation. Exam-only edits require renewed Exam review.'}</p>
          <p>Reviewing corrected scope is not connected yet. Your edits do not start model calls; saving remains unavailable.</p>
        </div>
        <p className="access-hint">Draft revision {documentRevision} · {invalidatedReviews.includes('exam-review') ? 'Independent Exam review required' : 'Exam review unchanged'} · save confirmation required</p>
        <details><summary>Original source and generation reference</summary>
          <h4>Your intent</h4><pre className="intent-draft-source">{intent}</pre>
          {clarification && <><h4>Your clarification</h4><pre className="intent-draft-source">{clarification}</pre></>}
          <p className="access-hint">Generation reference: <code>{result.sourceDigest}</code>. This identifies the generated source context, not your edited documents or an approval.</p>
        </details>
        <div className="intent-document-buttons" aria-label="Choose a draft document">{(['brief', 'spec', 'exam'] as const).map(name =>
          <button key={name} type="button" className="access-secondary" aria-pressed={selected === name} onClick={() => setSelected(name)}>{name.toUpperCase()}.md</button>)}</div>
        <div className="intent-document-buttons" aria-label="Document viewing mode">{(['preview', 'edit', 'original'] as const).map(mode =>
          <button key={mode} type="button" className="access-secondary" aria-pressed={documentMode === mode} onClick={() => setDocumentMode(mode)}>
            {mode === 'preview' ? 'Read your draft' : mode === 'edit' ? 'Edit draft' : 'View generated original'}</button>)}</div>
        <p role="status">{selected.toUpperCase()}.md · {editedDocuments[selected] === result.documents[selected] ? 'No edits yet' : 'Edited by you · unsaved'}</p>
        {documentMode === 'edit' ? <><label htmlFor="intent-document-editor">Edit {selected.toUpperCase()}.md</label>
          <textarea id="intent-document-editor" rows={18} maxLength={30000} value={editedDocuments[selected]}
            onChange={event => editDocument(event.target.value)} />
          {!editedDocuments[selected].trim() && <p role="alert">This draft is empty. Add content before it can be submitted for review or saving.</p>}
        </> : <BriefMarkdown content={documentMode === 'original' ? result.documents[selected] : editedDocuments[selected]} />}
        {documentMode === 'original' && <p className="access-hint">Generated original · your edits remain unchanged in your draft.</p>}
        {(['brief', 'spec', 'exam'] as const).some(name => editedDocuments[name] !== result.documents![name]) &&
          <p className="access-note">Your corrections have not been checked by the Test Agent. Changes to the Brief or Spec may require an updated Exam; no tests have been rerun.</p>}
        <p className="access-hint">The Exam was drafted in a separate Test Agent context. These documents still need review and authorized repository saving.</p>
      </div>}
    </>}
  </section>;
}
