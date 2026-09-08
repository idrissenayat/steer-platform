'use client';

import { useEffect, useRef, useState } from 'react';
import type { IntentDispositionChoice } from '@steer/tool-registry/intent-overlap-contracts';
import type { IntentDevelopmentReadOutput } from '@steer/tool-registry/intent-development-read-contracts';
import type { IntentDraftDiscoveryEntry } from '@steer/tool-registry/intent-draft-discovery-contracts';
import { createIntentDevelopmentEditor, type DevelopmentEditorSource, type DevelopmentEditorView } from './intent-development-editor';
import { createIntentDevelopmentTransport } from './intent-development-transport';
import BriefMarkdown from './brief-markdown';

export default function IntentDevelopmentPanel({ source, enabled, identity, expiresAt, onResult, reviewRequest = null, discoveredDraft = null }: {
  source: DevelopmentEditorSource | null; enabled: boolean; identity: string; expiresAt: string;
  onResult: (source: DevelopmentEditorSource, result: IntentDevelopmentReadOutput) => void;
  reviewRequest?: { sequence: number; revisionDigest: string } | null;
  discoveredDraft?: IntentDraftDiscoveryEntry | null;
}) {
  const [view, setView] = useState<DevelopmentEditorView | null>(null);
  const [action, setAction] = useState<IntentDispositionChoice['action'] | ''>(''), [reason, setReason] = useState(''), [path, setPath] = useState('');
  const [paused, setPaused] = useState(false);
  const sourceRef = useRef(source), controller = useRef<ReturnType<typeof createIntentDevelopmentEditor> | null>(null);
  const heading = useRef<HTMLHeadingElement>(null), polls = useRef(0), startedAt = useRef(0);
  const handledReview = useRef(0);
  sourceRef.current = source;
  useEffect(() => { controller.current?.sourceChanged(); }, [source]);
  useEffect(() => {
    let closed = false, last = Date.now();
    const valid = () => { const now = Date.now(), expiry = Date.parse(expiresAt);
      const okay = !closed && Number.isFinite(expiry) && now >= last && now < expiry && !document.hidden; last = now; return okay; };
    const current = createIntentDevelopmentEditor(createIntentDevelopmentTransport(window.location.origin),
      () => valid() ? sourceRef.current : null, next => { if (valid()) setView(next); else close(); });
    const close = () => { closed = true; current.close(); setView(current.snapshot()); setReason(''); setPath(''); setAction(''); };
    controller.current = current; setView(current.snapshot()); polls.current = 0; startedAt.current = Date.now(); setPaused(false);
    setReason(''); setPath(''); setAction('');
    handledReview.current = 0;
    const check = () => { if (!valid()) close(); };
    const timer = setInterval(check, 1000); check(); document.addEventListener('visibilitychange', check); window.addEventListener('pagehide', close);
    return () => { closed = true; current.close(); if (controller.current === current) controller.current = null; clearInterval(timer);
      document.removeEventListener('visibilitychange', check); window.removeEventListener('pagehide', close); };
  }, [identity, expiresAt]);
  useEffect(() => {
    if (!reviewRequest || reviewRequest.sequence === handledReview.current) return;
    handledReview.current = reviewRequest.sequence;
    if (source?.input.revisionDigest === reviewRequest.revisionDigest) {
      setAction(''); setReason(''); setPath(''); void controller.current?.review();
    }
  }, [reviewRequest, source]);
  useEffect(() => {
    if (view?.status !== 'pending' || controller.current?.retryAvailable()) return;
    if (polls.current >= 240 || Date.now() - startedAt.current >= 8 * 60000) { setPaused(true); return; }
    const timer = setTimeout(() => { polls.current++; void controller.current?.read(); }, 2000);
    return () => clearTimeout(timer);
  }, [view]);
  useEffect(() => { if (['reviewed', 'needs-clarification', 'candidates-ready'].includes(view?.status ?? '')) heading.current?.focus(); }, [view?.status]);
  if (!view || view.status === 'closed') return null;
  const matches = !view.sourceInvalidated && source !== null && JSON.stringify(source) === JSON.stringify(view.source);
  const busy = ['reviewing', 'preparing', 'starting', 'reading'].includes(view.status);
  const recovering = controller.current?.retryAvailable() ?? false;
  const terminal = ['needs-clarification', 'candidates-ready', 'superseded', 'expired'].includes(view.status);
  const canReview = !busy && !recovering && (!view.operation || terminal);
  const resumable = source && discoveredDraft?.run && discoveredDraft.latest && source.input.draftId === discoveredDraft.draftId
    && source.input.revision === discoveredDraft.latest.revision && source.input.revisionDigest === discoveredDraft.latest.revisionDigest
    && source.input.scopeInputDigest === discoveredDraft.latest.scopeInputDigest;
  const review = view.review?.envelope, architect = view.observation?.results.find(r => r.result.role === 'architect')?.result;
  const exam = view.observation?.results.find(r => r.result.role === 'test-agent')?.result;
  const candidates = architect?.role === 'architect' && architect.output.brief !== null && architect.output.spec !== null && exam?.role === 'test-agent'
    ? { brief: architect.output.brief, spec: architect.output.spec, exam: exam.output.exam } : null;
  function develop() {
    if (!enabled || !action || !reason.trim() || !review) return;
    const target = review.evidence.find(s => s.path === path && s.path.endsWith('/BRIEF.md'));
    const choice: IntentDispositionChoice | null = action === 'new-distinct' ? { action, reason }
      : target ? { action, reason, target: { path: target.path, revision: review.snapshot.head, contentDigest: target.contentDigest } } : null;
    if (choice) { polls.current = 0; startedAt.current = Date.now(); setPaused(false); void controller.current?.develop(choice); }
  }
  function useResult() {
    const result = controller.current?.takeResult();
    if (result && view?.source) onResult(view.source, result);
  }
  return <section className="intent-development-panel" aria-labelledby="development-title">
    <h3 id="development-title" ref={heading} tabIndex={-1}>Develop this intent with STEER</h3>
    <p>Review existing source documents, confirm your direction, then let the Architect and separate Test Agent develop this exact draft.</p>
    {!source && <p>Preserve your current text first. Only an acknowledged, current draft revision can enter the recorded workflow.</p>}
    {resumable && <div className="access-note"><p>A retained agent run was found for this exact revision. Read its progress before requesting any new generation.</p>
      <button className="access-secondary" type="button" disabled={!canReview} onClick={() => {
        if (!source || !discoveredDraft?.run) return;
        const { scopeInputDigest: _scope, ...input } = source.input;
        void controller.current?.resume({ ...input, ...discoveredDraft.run });
      }}>Resume this recorded run</button></div>}
    <button className="access-secondary" type="button" disabled={!source || !canReview} onClick={() => {
      setAction(''); setReason(''); setPath(''); void controller.current?.review();
    }}>{view.status === 'reviewing' ? 'Reviewing current sources…' : 'Review existing work for this draft'}</button>
    {view.source && !matches && <p role="status">Your editor differs from this reviewed revision. Earlier results will not replace your text. Preserve and review the current revision before continuing.</p>}
    {review && <div className="intent-development-sources">
      <p>Checked {review.coverage.includedCount} of {review.coverage.inventoryCount} source documents at commit <code>{review.snapshot.head.slice(0, 12)}</code>.</p>
      <p className="access-note">These are source documents, not a semantic duplicate verdict. Rephrased or partially overlapping work still needs assessment. A complete source inventory alone does not establish that an intent is new.</p>
      {!review.coverage.complete && <p role="alert">Coverage is incomplete. Agent development is blocked until missing or inaccessible sources are resolved. No new-intent conclusion has been made.</p>}
      {review.evidence.map(item => <details key={item.sourceId}><summary>{item.path} · {item.status}</summary>
        <p>Exact source at <code>{review.snapshot.head}</code> · content <code>{item.contentDigest}</code></p>
        <BriefMarkdown content={item.content} /></details>)}
      {review.coverage.gaps.length > 0 && <p>{review.coverage.gaps.length} listed sources could not be included in full.</p>}
      {review.coverage.accessGapCount > 0 && <p>Some source access is unavailable. Restricted item names are not exposed.</p>}
      <fieldset className="intent-scope-choice" disabled={busy || !matches || view.status !== 'reviewed' || !review.coverage.complete}>
        <legend>How should this intent proceed?</legend>
        <label htmlFor="development-direction">Your direction</label>
        <select id="development-direction" value={action} onChange={event => setAction(event.target.value as typeof action)}>
          <option value="">Choose a direction</option>
          <option value="extend-existing">Propose adding missing scope to existing work</option>
          <option value="new-linked">Propose a distinct intent linked to existing work</option>
          <option value="new-distinct">Propose a distinct new intent</option>
        </select>
        {action && action !== 'new-distinct' && <><label htmlFor="development-target">Existing intent</label>
          <select id="development-target" value={path} onChange={event => setPath(event.target.value)}><option value="">Choose a reviewed Brief</option>
            {review.evidence.filter(s => s.path.endsWith('/BRIEF.md')).map(s => <option key={s.sourceId} value={s.path}>{s.path}</option>)}</select></>}
        {action && <><label htmlFor="development-reason">What is missing or distinct?</label>
          <textarea id="development-reason" rows={3} maxLength={3000} value={reason} onChange={event => setReason(event.target.value)} /></>}
        <button className="access-primary" type="button" disabled={!enabled || !action || !reason.trim() || (action !== 'new-distinct' && !review.evidence.some(s => s.path === path && s.path.endsWith('/BRIEF.md')))}
          onClick={develop}>Confirm direction and develop this draft</button>
      </fieldset>
    </div>}
    <div role="status" aria-live="polite" aria-atomic="true">
      {view.status === 'preparing' && <p>Preserving the exact reviewed source for this run… No model has been dispatched by preparation.</p>}
      {view.status === 'starting' && <p>Requesting the recorded workflow under current model and budget permissions…</p>}
      {view.status === 'pending' && <p>The agent workflow is in progress. {paused ? 'Automatic checks paused; check the same run when ready.' : 'Progress is checked automatically without repeating generation.'}</p>}
      {view.status === 'reading' && <p>Reading verified progress from the same recorded run…</p>}
      {view.status === 'attention-required' && <p>This run needs recovery or an operator decision. An uncertain model outcome must not be retried as a new paid request.</p>}
      {view.status === 'superseded' && <p>A newer stored revision exists. These results cannot be applied to the current draft.</p>}
      {view.status === 'expired' && <p>This run has expired. No retained document content is released.</p>}
      {view.message && <p>{view.message}</p>}
    </div>
    {view.operation && <p className="access-hint">Recorded operation: <code>{view.operation.operationId}</code>. Not saved to GitHub; no gate signed.</p>}
    {recovering && <button type="button" className="access-secondary" disabled={!enabled || busy || !matches}
      onClick={() => { void controller.current?.retry(); }}>Recover the same request</button>}
    {view.operation && <button type="button" className="access-secondary" disabled={busy}
      onClick={() => { void controller.current?.read(); }}>Check this run’s progress</button>}
    {architect?.role === 'architect' && !['expired', 'superseded'].includes(view.status) && <div className="intent-agent-reply">
      <h4>STEER agent</h4><p>{architect.output.message}</p>
      {architect.output.questions.length > 0 && <><ul>{architect.output.questions.map((q, index) => <li key={index}>{q}</li>)}</ul>
        <button className="access-secondary" type="button" disabled={!matches || !terminal || recovering || busy} onClick={useResult}>Answer these questions</button></>}
      {candidates && <><p>Three generated candidates are ready to inspect. Using them will replace the document fields only after your explicit choice.</p>
        {(['brief', 'spec', 'exam'] as const).map(name => <details key={name}><summary>Generated {name.toUpperCase()}.md</summary><BriefMarkdown content={candidates[name]} /></details>)}
        <button className="access-primary" type="button" disabled={!matches || view.status !== 'candidates-ready' || recovering || busy} onClick={useResult}>Use these generated documents</button>
        <p>Candidate documents are not acceptance evidence. No tests have been run and no gate has been signed.</p></>}
    </div>}
  </section>;
}
