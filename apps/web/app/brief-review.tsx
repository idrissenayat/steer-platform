'use client';

import { useEffect, useRef, useState } from 'react';
import { briefSaveStatusInputSchema, type BriefPreview, type BriefDestination } from '@steer/tool-registry/brief-contracts';
import { briefReviewBinding, createBriefSaveStatusClient, saveStatusMessages, type SaveStatusState } from './brief-review-client';
import { briefReceiptFragment } from './brief-location';

function PreviousSaveStatus({ scope, subject, expiresAt }: {
  scope: { organizationId: string; repository: string; branch: string; path: string }; subject: string; expiresAt: string;
}) {
  const [operation, setOperation] = useState('');
  const [state, setState] = useState<SaveStatusState>({ kind: 'idle' });
  const [enabled, setEnabled] = useState(false);
  const owner = useRef<ReturnType<typeof createBriefSaveStatusClient> | null>(null);
  useEffect(() => {
    const current = createBriefSaveStatusClient(scope, subject, expiresAt, window.location.origin, setState); owner.current = current;
    setEnabled(!document.hidden && Date.parse(expiresAt) > Date.now());
    const clear = () => { current.close(); setEnabled(false); setOperation(''); setState({ kind: 'expired' }); };
    const hide = () => { if (document.hidden) clear(); };
    const timer = setTimeout(clear, Math.max(0, Date.parse(expiresAt) - Date.now()));
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', clear);
    return () => { current.close(); if (owner.current === current) owner.current = null; clearTimeout(timer);
      document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', clear); };
  }, [scope.organizationId, scope.repository, scope.branch, scope.path, subject, expiresAt]);
  const valid = briefSaveStatusInputSchema.safeParse({ ...scope, idempotencyKey: operation }).success;
  const result = state.kind === 'observed' ? state.value.result : null;
  const receiptLink = state.kind === 'observed' ? briefReceiptFragment(state.value) : null;
  return <details className="previous-save-status"><summary>Check a previous save operation</summary>
    <p>Use its original operation ID for the selected repository, branch and path. Checking is read-only; no new operation ID is generated.</p>
    <div className="author-field"><label htmlFor="brief-operation-id">Previous operation ID</label>
      <input id="brief-operation-id" value={operation} maxLength={36} autoComplete="off" spellCheck={false} disabled={!enabled}
        aria-describedby="brief-operation-help" onChange={event => { owner.current?.clear(); setOperation(event.target.value); }} />
      <p id="brief-operation-help">Enter the exact UUID from the original save request.</p></div>
    {valid && <p className="access-hint">Operation being checked: <code>{operation}</code></p>}
    <button type="button" className="access-secondary" disabled={!enabled || !valid || state.kind === 'loading'} onClick={() => {
      if (!document.hidden && Date.parse(expiresAt) > Date.now()) void owner.current?.check(operation);
    }}>Check save status</button>
    <p role="status" data-testid="save-operation-status">{saveStatusMessages[result ? result.outcome : state.kind as Exclude<SaveStatusState['kind'], 'observed'>]}</p>
    {result?.outcome === 'committed' && <dl className="save-receipt" data-testid="save-operation-receipt">
      <div><dt>Recorded Git revision</dt><dd><code>{result.revision}</code></dd></div>
      <div><dt>Recorded content SHA-256</dt><dd><code>{result.contentDigest}</code></dd></div>
      <div><dt>Original expected head</dt><dd><code>{result.expectedHead}</code></dd></div>
      <div><dt>Recorded Brief path</dt><dd><code>{result.path}</code></dd></div>
    </dl>}
    {receiptLink && <><a className="session-refresh" data-brief-receipt-link href={receiptLink} onClick={event => {
      if (!enabled || document.hidden || Date.parse(expiresAt) <= Date.now()) event.preventDefault();
    }}>Read the recorded Brief</a><p className="access-hint">Opens only that recorded revision if it is currently available in your permitted Brief library. This link does not grant access.</p></>}
  </details>;
}

/** Local confirmation only. Parent remounts for every preview/destination/session change. */
export default function BriefReview({ preview, destination, expiresAt }: { preview: BriefPreview; destination: BriefDestination; expiresAt: string }) {
  const [path, setPath] = useState(''), [accepted, setAccepted] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const displayUntil = new Date(Math.min(Date.parse(expiresAt), Date.parse(destination.observedAt) + 15000)).toISOString();
  useEffect(() => {
    setEnabled(!document.hidden && Date.parse(displayUntil) > Date.now());
    const clear = () => { setEnabled(false); setPath(''); setAccepted(null); };
    const hide = () => { if (document.hidden) clear(); };
    const timer = setTimeout(clear, Math.max(0, Date.parse(displayUntil) - Date.now()));
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', clear);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', clear); };
  }, [displayUntil]);
  let binding: ReturnType<typeof briefReviewBinding> | null = null;
  try { binding = briefReviewBinding(preview, destination, path, expiresAt, Date.now()); } catch { /* No current display binding. */ }
  const confirmed = binding !== null && accepted === JSON.stringify(binding);
  return <section className="brief-review" aria-labelledby="brief-review-title">
    <h4 id="brief-review-title">Review this exact draft</h4>
    <p>Choose a configured path, then review the content above. This is local confirmation, not a save, permission or gate signature.</p>
    <fieldset disabled={!enabled}><legend>Draft destination and review</legend>
      <div className="author-field"><label htmlFor="brief-review-path">Brief path to review</label>
        <select id="brief-review-path" value={path} onChange={event => { setAccepted(null); setPath(event.target.value); }}>
          <option value="">Choose a path</option>{destination.paths.map(value => <option key={value} value={value}>{value}</option>)}
        </select></div>
      {binding && <><p className="access-hint">Selected path: <code data-testid="review-selected-path">{path}</code></p>
        <p className="access-hint">Review is bound to the repository, branch and observed revision above, this path, your session, and content SHA-256 <code>{preview.contentDigest}</code>. The path may already exist.</p>
        <label className="brief-review-check"><input type="checkbox" checked={confirmed} onChange={event => {
          setAccepted(null);
          if (event.target.checked && !document.hidden) {
            try { setAccepted(JSON.stringify(briefReviewBinding(preview, destination, path, expiresAt, Date.now()))); } catch { setEnabled(false); }
          }
        }} />I reviewed the displayed Brief for this destination.</label></>}
    </fieldset>
    <p role="status" className="author-state" data-testid="brief-review-status">{confirmed ? 'Reviewed locally · Not saved · Not signed' : 'Not reviewed for this destination · Not saved · Not signed'}</p>
    <button type="button" className="access-primary" disabled aria-describedby="brief-save-hold">Save Brief to GitHub — unavailable</button>
    <p id="brief-save-hold">Live saving is disabled. Governed evidence selection, verified review provenance and complete action-time authorization are still required. Local review does not clear those requirements.</p>
    <p className="access-hint">Review clears when the content, destination observation or session changes, or this page is hidden. Nothing is stored in this browser.</p>
    {binding && <PreviousSaveStatus key={path} scope={{ organizationId: binding.organizationId, repository: binding.repository, branch: binding.branch, path }} subject={binding.subject} expiresAt={displayUntil} />}
  </section>;
}
