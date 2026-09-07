'use client';

import { useEffect, useRef, useState } from 'react';
import type { IntentOverlapOutput, IntentDispositionChoice, IntentDispositionProposal } from '@steer/tool-registry/intent-overlap-contracts';
import { bindIntentDisposition, createIntentScopeReader } from './intent-scope-reader';
import { briefFragment } from './brief-location';

/** Read-only comparison inside the real conversation. Never a duplicate verdict or save grant. */
export default function IntentScopeReview({ organizationId, repository, intent, expiresAt, onProposalChange, locked = false, reviewVersion = 0 }: {
  organizationId: string; repository: string | null; intent: string; expiresAt: string;
  locked?: boolean;
  reviewVersion?: number;
  onProposalChange?: (value: IntentDispositionProposal | null) => void;
}) {
  const owner = useRef<ReturnType<typeof createIntentScopeReader> | null>(null);
  const [result, setResult] = useState<{ intent: string; value: IntentOverlapOutput } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [expired, setExpired] = useState(false);
  const [action, setAction] = useState<IntentDispositionChoice['action'] | ''>('');
  const [targetPath, setTargetPath] = useState(''); const [reason, setReason] = useState('');
  const [proposal, setProposal] = useState<IntentDispositionProposal | null>(null);
  useEffect(() => { onProposalChange?.(proposal); }, [proposal, onProposalChange]);
  const heading = useRef<HTMLHeadingElement>(null);
  const review = result?.intent === intent && result.value.organizationId === organizationId && result.value.repository === repository ? result.value : null;
  useEffect(() => { setAction(''); setTargetPath(''); setReason(''); }, [organizationId, repository]);
  useEffect(() => {
    owner.current?.close(); owner.current = null; setResult(null); setError(''); setBusy(false); setProposal(null);
    let last = Date.now();
    const clear = () => { owner.current?.close(); owner.current = null; setResult(null); setProposal(null); setAction(''); setTargetPath(''); setReason(''); setBusy(false); setError(''); setExpired(true); };
    const check = () => { const now = Date.now(), expiry = Date.parse(expiresAt); if (!Number.isFinite(expiry) || now < last || now >= expiry || document.hidden) clear(); last = now; };
    check(); const timer = setInterval(check, 1000); document.addEventListener('visibilitychange', check);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', check); owner.current?.close(); owner.current = null; };
  }, [organizationId, repository, intent, expiresAt, reviewVersion]);
  useEffect(() => { if (review) heading.current?.focus(); }, [review]);
  async function checkScope(choice?: IntentDispositionChoice) {
    if (locked || !repository || !intent.trim() || owner.current || expired || document.hidden || Date.now() >= Date.parse(expiresAt)) return;
    const current = createIntentScopeReader({ organizationId, repository }, window.location.origin); owner.current = current;
    const previous = review;
    setBusy(true); setError(''); setProposal(null); if (!choice) setResult(null);
    try {
      const value = await current.check(intent);
      if (owner.current !== current || document.hidden || Date.now() >= Date.parse(expiresAt)) return;
      setResult({ intent, value });
      if (choice && previous) {
        try { setProposal(bindIntentDisposition(previous, value, choice)); }
        catch { setError('Scope changed or the selected Brief is no longer available. Review these sources and confirm your direction again. Your explanation is still here.'); }
      }
    } catch { if (owner.current === current) setError('Existing scope could not be checked. Refresh access or try again. This does not mean your intent is new.'); }
    finally { current.close(); if (owner.current === current) { owner.current = null; setBusy(false); } }
  }
  function propose() {
    if (!review || !action || !reason.trim()) return;
    if (action === 'new-distinct') { void checkScope({ action, reason }); return; }
    const target = review.candidates.find(candidate => candidate.briefPath === targetPath);
    if (target) void checkScope({ action, reason, target: { path: target.briefPath, revision: target.revision, contentDigest: target.briefContentDigest } });
  }
  return <section className="intent-scope-review" aria-labelledby="scope-review-title">
    <h3 id="scope-review-title">Does this work already exist?</h3>
    <p>Check permitted Briefs and Specs for matching scope before starting another intent.</p>
    {!repository && <p className="access-note">Repository search is not configured for this workspace yet.</p>}
    {expired ? <p role="status">Scope results cleared. Refresh access to check again.</p> : <>
      <button type="button" className="access-secondary" disabled={locked || !repository || !intent.trim() || busy} onClick={() => { void checkScope(); }}>
        {busy ? 'Checking existing scope…' : review ? 'Check scope again' : 'Check existing scope'}</button>
      {busy && <p role="status">Checking permitted source documents. No intent is being created or changed.</p>}
      {error && <p role="alert">{error}</p>}
      {review && <div className="intent-scope-results">
        <h4 ref={heading} tabIndex={-1}>{review.candidates.length ? 'Possible matches to review' : 'No word matches found in the checked sources'}</h4>
        <p>Checked {review.coverage.inspectedDocuments} documents across {review.coverage.inspectedIntents} of {review.coverage.catalogCount} listed intents.</p>
        <p className="access-note">Word matching can miss rephrased intent or find text that is explicitly out of scope. This is not a decision that your intent is already covered or new.</p>
        {(review.coverage.scanLimited || review.coverage.gaps.length > 0) && <p role="status">Search coverage is incomplete. Some sources were unavailable or outside the scan limit.</p>}
        {review.coverage.resultsTruncated && <p>Showing {review.candidates.length} of {review.coverage.candidateCount} candidate passages.</p>}
        <ul className="intent-scope-matches">{review.candidates.map(candidate => <li key={`${candidate.path}:${candidate.revision}`}>
          <h5>{candidate.briefPath === 'BRIEF.md' ? 'Workspace intent' : candidate.briefPath.split('/')[1]} · {candidate.document}</h5>
          <p>{candidate.signal === 'matching-text' ? 'Matching text' : 'Shared terms'}: {candidate.matchedTerms.join(', ') || 'literal source passage'}</p>
          <blockquote>{candidate.excerpt}</blockquote>
          <p className="access-hint">Source: <code>{candidate.path}</code> · revision <code>{candidate.revision.slice(0, 12)}</code></p>
          <a data-brief-revision-link href={briefFragment({ organizationId, repository, path: candidate.briefPath,
            revision: candidate.revision, contentDigest: candidate.briefContentDigest })}>Open existing Brief at this revision</a>
        </li>)}</ul>
        {review.coverage.gaps.length > 0 && <details><summary>Unavailable sources ({review.coverage.gaps.length})</summary><ul>
          {review.coverage.gaps.map(gap => <li key={gap.path}><code>{gap.path}</code>: {gap.reason === 'not-configured' ? 'not configured for reading' : 'not available in the projection'}</li>)}
        </ul></details>}
        <fieldset disabled={busy || locked} className="intent-scope-choice">
          <legend>How should this intent proceed?</legend>
          <p>Choose a proposed direction. This does not create, merge, update or save anything.</p>
          <label htmlFor="scope-direction">Your direction</label>
          <select id="scope-direction" value={action} onChange={event => { setAction(event.target.value as typeof action); setProposal(null); }}>
            <option value="">Choose a direction</option>
            <option value="extend-existing" disabled={!review.candidates.length}>Propose adding missing scope to an existing intent</option>
            <option value="new-linked" disabled={!review.candidates.length}>Propose a separate intent linked to existing work</option>
            <option value="new-distinct">Propose a distinct new intent</option>
          </select>
          {(action === 'extend-existing' || action === 'new-linked') && <>
            <label htmlFor="scope-target">Existing intent</label>
            <select id="scope-target" value={targetPath} onChange={event => { setTargetPath(event.target.value); setProposal(null); }}>
              <option value="">Choose an existing intent</option>
              {review.candidates.filter((candidate, index, all) => all.findIndex(other => other.briefPath === candidate.briefPath) === index)
                .map(candidate => <option key={candidate.briefPath} value={candidate.briefPath}>{candidate.briefPath}</option>)}
            </select>
          </>}
          {action && <><label htmlFor="scope-reason">{action === 'extend-existing' ? 'What is missing from the existing scope?' : 'What makes this intent distinct?'}</label>
            <textarea id="scope-reason" rows={3} maxLength={3000} value={reason} onChange={event => { setReason(event.target.value); setProposal(null); }} />
            <button type="button" className="access-secondary" disabled={!reason.trim() || (action !== 'new-distinct' && !review.candidates.some(candidate => candidate.briefPath === targetPath))}
              onClick={propose}>Recheck scope and confirm direction</button></>}
        </fieldset>
        {proposal && <p role="status">Direction checked against the reviewed source revisions. The agent will use your direction and explanation after checking these sources again. Nothing is saved; semantic duplicate review is still needed.</p>}
      </div>}
    </>}
  </section>;
}
