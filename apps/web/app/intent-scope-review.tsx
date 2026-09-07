'use client';

import { useEffect, useRef, useState } from 'react';
import type { IntentOverlapOutput } from '@steer/tool-registry/intent-overlap-contracts';
import { createIntentScopeReader } from './intent-scope-reader';
import { briefFragment } from './brief-location';

/** Read-only comparison inside the real conversation. Never a duplicate verdict or save grant. */
export default function IntentScopeReview({ organizationId, repository, intent, expiresAt }: {
  organizationId: string; repository: string | null; intent: string; expiresAt: string;
}) {
  const owner = useRef<ReturnType<typeof createIntentScopeReader> | null>(null);
  const [result, setResult] = useState<{ intent: string; value: IntentOverlapOutput } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [expired, setExpired] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const review = result?.intent === intent && result.value.organizationId === organizationId && result.value.repository === repository ? result.value : null;
  useEffect(() => {
    owner.current?.close(); owner.current = null; setResult(null); setError(''); setBusy(false);
    let last = Date.now();
    const clear = () => { owner.current?.close(); owner.current = null; setResult(null); setBusy(false); setError(''); setExpired(true); };
    const check = () => { const now = Date.now(), expiry = Date.parse(expiresAt); if (!Number.isFinite(expiry) || now < last || now >= expiry || document.hidden) clear(); last = now; };
    check(); const timer = setInterval(check, 1000); document.addEventListener('visibilitychange', check);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', check); owner.current?.close(); owner.current = null; };
  }, [organizationId, repository, intent, expiresAt]);
  useEffect(() => { if (review) heading.current?.focus(); }, [review]);
  async function checkScope() {
    if (!repository || !intent.trim() || owner.current || expired || document.hidden || Date.now() >= Date.parse(expiresAt)) return;
    const current = createIntentScopeReader({ organizationId, repository }, window.location.origin); owner.current = current;
    setBusy(true); setError(''); setResult(null);
    try {
      const value = await current.check(intent);
      if (owner.current !== current || document.hidden || Date.now() >= Date.parse(expiresAt)) return;
      setResult({ intent, value });
    } catch { if (owner.current === current) setError('Existing scope could not be checked. Refresh access or try again. This does not mean your intent is new.'); }
    finally { current.close(); if (owner.current === current) { owner.current = null; setBusy(false); } }
  }
  return <section className="intent-scope-review" aria-labelledby="scope-review-title">
    <h3 id="scope-review-title">Does this work already exist?</h3>
    <p>Check permitted Briefs and Specs for matching scope before starting another intent.</p>
    {!repository && <p className="access-note">Repository search is not configured for this workspace yet.</p>}
    {expired ? <p role="status">Scope results cleared. Refresh access to check again.</p> : <>
      <button type="button" className="access-secondary" disabled={!repository || !intent.trim() || busy} onClick={() => { void checkScope(); }}>
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
      </div>}
    </>}
  </section>;
}
