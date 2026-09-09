'use client';

import { useEffect, useRef, useState } from 'react';
import type { IntentDevelopmentReviewOutput } from '@steer/tool-registry/intent-development-review-contracts';
import type { IntentScopeReadOutput } from '@steer/tool-registry/intent-scope-read-contracts';
import type { IntentScopeHistoryInput, IntentScopeHistoryOutput } from '@steer/tool-registry/intent-scope-history-contracts';
import { createIntentScopeEditor, type ScopeEditorSource, type ScopeEditorView } from './intent-scope-editor';
import { createIntentScopeTransport } from './intent-scope-transport';
import { briefFragment } from './brief-location';

const relations = { 'already-covered': 'Already covered', partial: 'Partially covered', 'related-distinct': 'Related but distinct',
  'no-match-in-assessed-scope': 'No match in assessed scope', 'insufficient-evidence': 'Insufficient evidence' };
export default function IntentScopePanel({ source, review, subject, identity, expiresAt, enabled, onLockChange, onAssessmentChange }: {
  source: boolean; review: IntentDevelopmentReviewOutput | null; subject: string; identity: string; expiresAt: string;
  enabled: boolean; onLockChange: (locked: boolean) => void;
  onAssessmentChange: (assessment: IntentScopeReadOutput | null) => void;
}) {
  const [view, setView] = useState<ScopeEditorView | null>(null), [paused, setPaused] = useState(false);
  const controller = useRef<ReturnType<typeof createIntentScopeEditor> | null>(null), context = useRef<ScopeEditorSource | null>(null);
  const heading = useRef<HTMLHeadingElement>(null), polls = useRef(0), began = useRef(0);
  context.current = source && review ? { subject, evidence: review.evidence, plan: review.scopeBatchPlan, input: {
    organizationId: review.organizationId, productId: review.productId, repository: review.repository, configurationRevision: review.configurationRevision,
    draftId: review.draftId, revision: review.revision, revisionDigest: review.revisionDigest, scopeInputDigest: review.scopeInputDigest,
    sourceSnapshotDigest: review.sourceSnapshotDigest,
  } } : null;
  const fingerprint = JSON.stringify(context.current);
  useEffect(() => {
    onAssessmentChange(source && view?.status === 'review-available' && !view.sourceInvalidated ? view.observation : null);
  }, [source, view, onAssessmentChange]);
  useEffect(() => { controller.current?.sourceChanged(); }, [fingerprint]);
  useEffect(() => {
    let closed = false, last = Date.now();
    const valid = () => { const now = Date.now(), expiry = Date.parse(expiresAt);
      const okay = !closed && Number.isFinite(expiry) && now >= last && now < expiry && !document.hidden; last = now; return okay; };
    const current = createIntentScopeEditor(createIntentScopeTransport(window.location.origin), () => valid() ? context.current : null,
      next => { if (valid()) { setView(next); onLockChange(next.locked); } else close(); });
    const close = () => { closed = true; current.close(); setView(current.snapshot()); onLockChange(false); onAssessmentChange(null); };
    controller.current = current; setView(current.snapshot()); onLockChange(false); polls.current = 0; began.current = Date.now(); setPaused(false);
    const check = () => { if (!valid()) close(); };
    const timer = setInterval(check, 1000); check(); document.addEventListener('visibilitychange', check); window.addEventListener('pagehide', close);
    return () => { closed = true; current.close(); if (controller.current === current) controller.current = null;
      clearInterval(timer); document.removeEventListener('visibilitychange', check); window.removeEventListener('pagehide', close); onLockChange(false); onAssessmentChange(null); };
  }, [identity, expiresAt, onLockChange, onAssessmentChange]);
  useEffect(() => {
    if (view?.status !== 'pending' || view.retryAvailable) return;
    if (polls.current >= 900 || Date.now() - began.current >= 30 * 60000) { setPaused(true); return; }
    const timer = setTimeout(() => { polls.current++; void controller.current?.read(); }, 2000);
    return () => clearTimeout(timer);
  }, [view]);
  useEffect(() => { if (['review-available', 'incomplete', 'no-sources', 'attention-required'].includes(view?.status ?? '')) heading.current?.focus(); }, [view?.status]);
  if (!view || view.status === 'closed' || (!review && view.status === 'idle')) return null;
  const busy = ['preparing', 'starting', 'reading'].includes(view.status) || view.discoveryStatus === 'loading', current = Boolean(context.current) && !view.sourceInvalidated;
  const result = view.observation?.review, shown = result && !['superseded', 'expired'].includes(view.status) && !view.sourceInvalidated ? result : null;
  const inventory = view.source?.evidence.inventory ?? [], snapshot = view.source?.evidence.head;
  const finished = view.observation?.batches?.filter(b => b.state === 'succeeded').length ?? 0;
  return <section className="intent-scope-workflow access-note" aria-labelledby="scope-workflow-title">
    <h4 id="scope-workflow-title" ref={heading} tabIndex={-1}>Check for existing or overlapping intent</h4>
    <p>STEER assesses the reviewed Brief and Spec sources, explains overlaps and shows the passages behind each finding. Your text and direction stay yours.</p>
    <button type="button" className="access-secondary" disabled={!enabled || !context.current || view.locked}
      onClick={() => { polls.current = 0; began.current = Date.now(); setPaused(false); void controller.current?.assess(); }}>Assess existing scope</button>
    {!enabled && <p>Assessment needs current model and budget permissions. Reading retained progress does not start a new model call.</p>}
    <button type="button" className="access-secondary" disabled={!context.current || busy || view.retryAvailable || Boolean(view.operation && !current)}
      onClick={() => { void controller.current?.discover(); }}>Find retained scope reviews</button>
    {view.discoveryStatus === 'loading' && <p role="status">Finding retained references for this exact saved draft… No model work is started.</p>}
    {view.discovery && !view.sourceInvalidated && <div className="intent-scope-discovery">
      <p>References for this saved revision only, in stable identifier order—not newest first. Different source snapshots may be present. Opening one reads and verifies it before any recovery start.</p>
      {view.discovery.entries.length === 0 && <p>No retained references were found on this page for this owner, records configuration and draft revision. This is not a duplicate verdict or proof that no earlier work exists.</p>}
      <ul>{view.discovery.entries.map(entry => <li key={entry.reviewId}><code>{entry.reviewId}</code>{' '}
        <button type="button" className="access-secondary" disabled={busy || !current || view.retryAvailable}
          onClick={() => { polls.current = 0; began.current = Date.now(); setPaused(false); void controller.current?.resume(entry); }}>Read retained review {entry.reviewId}</button></li>)}</ul>
      {view.discovery.nextCursor && <button type="button" className="access-secondary" disabled={busy || !current || view.retryAvailable}
        onClick={() => { void controller.current?.discover(view.discovery!.nextCursor); }}>More retained scope reviews</button>}
    </div>}
    <div role="status" aria-live="polite" aria-atomic="true">
      {view.status === 'preparing' && <p>Preserving this exact source review… No model call is started by preparation.</p>}
      {view.status === 'starting' && <p>Requesting assessment under current permissions…</p>}
      {view.status === 'pending' && <p>Assessment is in progress: {finished} of {view.observation?.batches?.length ?? view.preparation?.coverage?.batchCount ?? 0} batches captured. {paused ? 'Automatic checks paused; check this same review when ready.' : 'Progress checks do not repeat model work.'}</p>}
      {view.status === 'reading' && <p>Reading and verifying this review’s progress…</p>}
      {view.status === 'review-available' && <p>Findings are ready to review. Verified source citations are not a guarantee of semantic accuracy or a decision to create a new intent.</p>}
      {view.status === 'incomplete' && <p>Assessment is incomplete. Missing sources, pending work or insufficient evidence cannot establish that this intent is new.</p>}
      {view.status === 'attention-required' && <p>This assessment needs an operator decision. Uncertain or failed model work will not be automatically retried.</p>}
      {view.status === 'superseded' && <p>A newer saved revision exists. Review that revision; these earlier findings are not current.</p>}
      {view.status === 'expired' && <p>This review expired. Current-workflow findings are withheld. Historical inspection below does not renew its execution window.</p>}
      {view.sourceInvalidated && <p>Your scope changed. Earlier findings cannot approve the edited intent, and this request cannot be restarted from it.</p>}
      {view.message && <p>{view.message}</p>}
    </div>
    {view.retryAvailable && <button type="button" className="access-secondary" disabled={!enabled || busy || !current}
      onClick={() => { void controller.current?.retry(); }}>Recover the same scope request</button>}
    {view.operation && <><button type="button" className="access-secondary" disabled={busy}
      onClick={() => { void controller.current?.read(); }}>Check scope review progress</button>
      <p className="access-hint">Review reference: <code>{view.operation.reviewId}</code>. No documents saved to GitHub; no gate signed.</p></>}
    {view.operation && view.source && <ScopeHistory input={{ organizationId: view.source.input.organizationId,
      productId: view.source.input.productId, repository: view.source.input.repository,
      reviewId: view.operation.reviewId, preparationDigest: view.operation.preparationDigest }}
      subject={subject} identity={identity} expiresAt={expiresAt} contextKey={JSON.stringify([fingerprint, view.status, view.discoveryStatus, view.sourceInvalidated])}
      draftId={view.source.input.draftId} revision={view.source.input.revision} revisionDigest={view.source.input.revisionDigest} />}
    {view.preparation?.coverage && !view.preparation.coverage.plannedComplete && <p>Only {view.preparation.coverage.plannedCount} of {view.preparation.coverage.inventoryCount} sources were planned. Coverage is incomplete.</p>}
    {shown && <div className="intent-scope-findings">
      <p>Captured {shown.results.length} of {shown.results.length + shown.pendingBatchIds.length} batches for {shown.coverage.plannedCount} planned source documents at commit <code>{snapshot}</code>.</p>
      {!shown.structuralAssessmentComplete && <p>These are partial findings, not a complete duplicate review.</p>}
      {shown.coverage.accessGapCount > 0 && <p>Some sources were not accessible; their names are not disclosed.</p>}
      {shown.coverage.gaps.length > 0 && <p>{shown.coverage.gaps.length} inventory sources could not be assessed in full.</p>}
      <ul className="intent-scope-matches">{shown.results.flatMap(batch => batch.findings.map(finding => {
        const brief = inventory.find(s => s.targetId === finding.targetId && s.path.endsWith('/BRIEF.md'));
        let href: string | null = null;
        try { if (brief && snapshot) href = briefFragment({ organizationId: view.source!.input.organizationId,
          repository: view.source!.input.repository, path: brief.path, revision: snapshot, contentDigest: brief.contentDigest }); }
        catch { /* Proposed paths retain cited bytes without widening the existing reader's authority. */ }
        return <li key={`${batch.batchId}:${finding.targetId}`}>
          <h5>{finding.targetId} · {relations[finding.relation]}</h5>
          <p>{finding.overlapExplanation}</p><p>Missing or distinct scope: {finding.missingScopeExplanation}</p>
          {finding.citations.map((citation, index) => { const source = inventory.find(s => s.sourceId === citation.sourceId)!;
            return <details key={`${citation.sourceId}:${index}`}><summary>{source.path} · {source.status} · bytes {citation.startByte}–{citation.endByte}</summary>
              <blockquote>{citation.quote}</blockquote><p>Source digest: <code>{source.contentDigest}</code></p></details>; })}
          {href && <a href={href}>Open existing Brief at this revision</a>}
          {brief && !href && <p>This proposed Brief is available in the cited passages; direct opening is not yet supported.</p>}
        </li>;
      }))}</ul>
      <p>No automatic merge, new intent, document generation or save follows these findings. Confirm your direction separately after reviewing the evidence.</p>
    </div>}
  </section>;
}

/** Separate, explicit read-only view. It never calls onAssessmentChange, adopts
 * findings, polls, or sends a prepare/start request. Its inventory is the retained
 * assessment inventory, never the current editor's source list. */
export function ScopeHistory({ input, subject, identity, expiresAt, contextKey, draftId, revision, revisionDigest }: {
  input: IntentScopeHistoryInput; subject: string; identity: string; expiresAt: string; contextKey: string;
  draftId: string; revision: number; revisionDigest: string;
}) {
  const [result, setResult] = useState<IntentScopeHistoryOutput | null>(null), [state, setState] = useState('idle');
  const owner = useRef<ReturnType<typeof createIntentScopeTransport> | null>(null), heading = useRef<HTMLHeadingElement>(null);
  const inputKey = JSON.stringify(input), selectionKey = JSON.stringify([inputKey, subject, identity, expiresAt, contextKey, draftId, revision, revisionDigest]);
  const activeKey = useRef(selectionKey); activeKey.current = selectionKey;
  const [resultKey, setResultKey] = useState('');
  useEffect(() => {
    const transport = createIntentScopeTransport(window.location.origin); owner.current = transport;
    let closed = false, last = Date.now();
    const clear = () => { closed = true; transport.close(); if (owner.current === transport) owner.current = null;
      setResult(null); setResultKey(''); setState('closed'); };
    const check = () => { const now = Date.now(), expiry = Date.parse(expiresAt);
      if (!closed && (document.hidden || !Number.isFinite(expiry) || now < last || now >= expiry)) clear(); last = now; };
    setResult(null); setResultKey(''); setState('idle'); check();
    const timer = setInterval(check, 1000); document.addEventListener('visibilitychange', check); window.addEventListener('pagehide', clear);
    return () => { closed = true; transport.close(); if (owner.current === transport) owner.current = null;
      clearInterval(timer); document.removeEventListener('visibilitychange', check); window.removeEventListener('pagehide', clear); };
  }, [selectionKey, expiresAt]);
  useEffect(() => { if (state === 'ready') heading.current?.focus(); }, [state]);
  const read = async () => {
    const transport = owner.current, key = selectionKey, startedAt = Date.now();
    if (!transport || state === 'reading') return;
    const current = () => owner.current === transport && activeKey.current === key && !document.hidden
      && Date.now() >= startedAt && Date.now() < Date.parse(expiresAt);
    setResult(null); setResultKey(''); setState('reading');
    try {
      const value = await transport.history(input);
      if (!current()) return;
      if (value.subject !== subject || value.source.draftId !== draftId || value.source.revision !== revision
        || value.source.revisionDigest !== revisionDigest) throw new Error('Historical source mismatch');
      setResult(value); setResultKey(key); setState('ready');
    } catch { if (current()) { setResult(null); setResultKey(''); setState('unavailable'); } }
  };
  const shown = resultKey === selectionKey ? result : null;
  return <section className="intent-scope-history" aria-label="Historical scope inspection">
    <button type="button" className="access-secondary" disabled={state === 'closed' || state === 'reading'} onClick={() => { void read(); }}>Read historical findings</button>
    <p>This reads retained evidence only. It cannot approve current scope, regenerate documents, retry an agent or save to GitHub.</p>
    <div role="status" aria-live="polite">{state === 'reading' && <p>Verifying retained assessment evidence…</p>}
      {state === 'unavailable' && <p>Historical findings are unavailable under current permissions. Your draft is unchanged.</p>}</div>
    {shown && <div>
      <h5 tabIndex={-1} ref={heading}>Historical findings — not current clearance</h5>
      <p>Assessed draft revision {shown.source.revision}; latest preserved revision {shown.source.latestRevision}.
        {shown.reviewExpired ? ' The execution window has expired.' : ' Historical viewing grants no execution permission.'}</p>
      <p>Retained source commit: <code>{shown.head}</code>. Verified batches: {shown.review.results.length} of {shown.batches.length}.</p>
      {!shown.review.structuralAssessmentComplete && <p>This historical assessment is incomplete. Missing or unresolved batches cannot establish uniqueness.</p>}
      {shown.review.coverage.accessGapCount > 0 && <p>Some sources were inaccessible; their names are not disclosed.</p>}
      <ul>{shown.review.results.flatMap(batch => batch.findings.map(finding => <li key={`${batch.batchId}:${finding.targetId}`}>
        <p>{finding.targetId} · {relations[finding.relation]}</p><p>{finding.overlapExplanation}</p>
        <p>Missing or distinct scope: {finding.missingScopeExplanation}</p>
        {finding.citations.map((citation, index) => { const source = shown.inventory.find(s => s.sourceId === citation.sourceId)!;
          return <details key={`${citation.sourceId}:${index}`}><summary>{source.path} · {source.status} · bytes {citation.startByte}–{citation.endByte}</summary>
            <blockquote>{citation.quote}</blockquote><p>Source digest: <code>{source.contentDigest}</code></p></details>; })}
      </li>))}</ul>
    </div>}
  </section>;
}
