'use client';

import { useEffect, useRef, useState } from 'react';
import { briefPreviewInputSchema, type BriefPreview } from '@steer/tool-registry/brief-contracts';
import { authorDraft, authorFields, createBriefAuthorClient, emptyAuthorAnswers, type AuthorAnswers } from './brief-author-client';
import BriefMarkdown from './brief-markdown';
import BriefDestination from './brief-destination';

export default function BriefAuthor({ organizationId, subject, expiresAt }: { organizationId: string; subject: string; expiresAt: string }) {
  const [answers, setAnswers] = useState(emptyAuthorAnswers);
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState<BriefPreview | null>(null);
  const [busy, setBusy] = useState(false); const [enabled, setEnabled] = useState(false);
  const [notice, setNotice] = useState('Start with what you know. You can preview an incomplete draft.');
  const owner = useRef<ReturnType<typeof createBriefAuthorClient> | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const dispose = () => { const current = owner.current; owner.current = null; current?.close(); };
  const clear = (message: string) => { dispose(); setAnswers(emptyAuthorAnswers()); setStep(0); setPreview(null); setBusy(false); setNotice(message); };
  const change = (key: keyof AuthorAnswers, value: string) => {
    dispose(); setBusy(false); setPreview(null); setAnswers((current) => ({ ...current, [key]: value }));
    setNotice('Draft changed. Preview again to review the current content.');
  };
  const render = async () => {
    dispose(); setPreview(null);
    const draft = authorDraft(answers);
    if (!briefPreviewInputSchema.safeParse({ organizationId, draft }).success) {
      setBusy(false); setNotice('Please shorten this draft: at most 20 entries per list and 12,000 UTF-8 bytes in total. Invalid control characters are not accepted. Your facts have been kept.'); return;
    }
    if (document.hidden || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) {
      setEnabled(false); clear('Session display expired or hidden. Refresh access to continue.'); return;
    }
    const current = createBriefAuthorClient({ organizationId, subject }, window.location.origin); owner.current = current;
    setBusy(true); setNotice('Checking current access and preparing your draft…');
    try {
      const result = await current.preview(draft);
      if (owner.current !== current) return;
      if (document.hidden || Date.parse(expiresAt) <= Date.now()) { setEnabled(false); clear('Session display expired. Refresh access to continue.'); return; }
      setPreview(result); setNotice('Preview ready. Nothing has been saved, confirmed or signed.');
    } catch { if (owner.current === current) clear('Draft preview could not be verified. Unsaved content cleared. Refresh access and try again.'); }
    finally { if (owner.current === current) { dispose(); setBusy(false); } }
  };
  useEffect(() => {
    const remaining = Date.parse(expiresAt) - Date.now(); setEnabled(Number.isFinite(remaining) && remaining > 0);
    const expire = () => { setEnabled(false); clear('Session display expired. Unsaved content cleared. Refresh access to continue.'); };
    const hide = () => { if (document.hidden) clear('Unsaved content cleared while this page was hidden. Start a new draft when you return.'); };
    const leave = () => clear('Unsaved content cleared after navigation.');
    const restore = (event: PageTransitionEvent) => { if (event.persisted) leave(); };
    const timer = setTimeout(expire, Number.isFinite(remaining) ? Math.max(0, Math.min(remaining, 2147483647)) : 0);
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', leave); window.addEventListener('pageshow', restore);
    return () => { dispose(); clearTimeout(timer); document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', leave); window.removeEventListener('pageshow', restore); };
  }, [organizationId, subject, expiresAt]);
  useEffect(() => { if (preview) heading.current?.focus(); }, [preview]);
  const field = authorFields[step]!;
  useEffect(() => { if (enabled) document.getElementById(`author-${authorFields[step]!.key}`)?.focus(); }, [step]);
  return <section className="access-card brief-author" aria-labelledby="author-section-title">
    <div className="eyebrow">FRAME THE WORK</div><h2 id="author-section-title">Start with your intent.</h2>
    <p>Describe the facts in your own words. Review the draft, then correct anything that does not match your intent.</p>
    <p className="access-note" id="author-privacy">Guided draft preview, not a connected AI agent. Nothing is saved to GitHub or signed. Unsaved content clears on refresh, navigation, hiding this page or session expiry. No model is called.</p>
    <div className="author-grid">
      <form onSubmit={(event) => { event.preventDefault(); if (step < authorFields.length - 1) setStep(step + 1); else void render(); }} aria-describedby="author-privacy">
        <fieldset disabled={!enabled}><legend>Let’s frame your intent</legend>
          <ol className="author-conversation" aria-label="Your answers so far">{authorFields.filter((question) => answers[question.key].trim()).map((question) =>
            <li key={question.key}><strong>{question.label}</strong><p>{answers[question.key]}</p>
              <button className="author-correction" type="button" onClick={() => { setStep(authorFields.indexOf(question)); document.getElementById(`author-${question.key}`)?.focus(); }}>Correct: {question.label}</button></li>)}</ol>
          <p className="access-hint">Question {step + 1} of {authorFields.length}. Skip anything you do not know, or preview now.</p>
          <div className="author-field" key={field.key}>
            <label htmlFor={`author-${field.key}`}>{field.label}</label><p id={`author-help-${field.key}`}>{field.help}</p>
            {field.key === 'title' || field.key === 'successMeasure' ?
              <input id={`author-${field.key}`} aria-describedby={`author-help-${field.key}`} maxLength={field.max} value={answers[field.key]} autoComplete="off" onChange={(event) => change(field.key, event.target.value)} /> :
              <textarea id={`author-${field.key}`} aria-describedby={`author-help-${field.key}`} maxLength={field.max} rows={3} value={answers[field.key]} autoComplete="off" onChange={(event) => change(field.key, event.target.value)} />}
          </div>
          <div className="author-actions"><button className="access-secondary" type="button" disabled={step === 0} onClick={() => setStep(step - 1)}>Previous question</button>
            {step < authorFields.length - 1 && <button className="access-secondary" type="submit">Next question</button>}
            <button className="access-primary" type="button" disabled={busy} onClick={() => { void render(); }}>{busy ? 'Preparing preview…' : 'Preview Brief'}</button>
            <button className="access-secondary" type="button" onClick={() => clear('Draft cleared. Start again with what you know.')}>Clear draft</button></div>
        </fieldset>
      </form>
      <div className="author-preview" aria-busy={busy}>
        <h3 ref={heading} tabIndex={-1}>Your draft preview</h3>
        <p role="status" data-testid="author-status">{notice}</p>
        {preview ? <>
          <p className="author-state">Not saved · Not confirmed · Not signed</p>
          {preview.missing.length ? <div className="author-missing"><h4>Still to clarify</h4><ul>{preview.missing.map((field) => <li key={field}>{field}</li>)}</ul></div> :
            <p>Starting fields supplied. This is not a completeness, policy or gate approval.</p>}
          <BriefMarkdown content={preview.markdown} />
          <details className="brief-source"><summary>Exact content fingerprint</summary><p>SHA-256 identifies these draft bytes, not a Git revision or approval.</p><code data-testid="author-digest">{preview.contentDigest}</code></details>
          <button className="access-secondary" type="button" onClick={() => { setStep(1); document.getElementById('author-problem')?.focus(); }}>Correct the facts</button>
        </> : <p className="author-empty">Your rendered Brief will appear here. Unknown facts stay open for review.</p>}
        <p className="access-hint">GitHub saving and decision signing are not enabled in this authoring preview.</p>
        <BriefDestination key={`${organizationId}:${subject}:${expiresAt}`} organizationId={organizationId} expiresAt={expiresAt} />
      </div>
    </div>
  </section>;
}
