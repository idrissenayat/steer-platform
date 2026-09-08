'use client';

import { useEffect, useRef, useState } from 'react';
import type { CandidateSaveStatusOutput } from '@steer/tool-registry/candidate-save-status-contracts';
import { candidateSaveStatusMessage, createCandidateSaveStatusClient, readCandidateSaveStatusLocation } from './candidate-save-status-client';
import { candidateFragment } from './candidate-location';

/** Read-only recovery. A pending or missing receipt can never show a submit action. */
export default function CandidateSaveStatus({ organizationId, repository, expiresAt }: { organizationId: string; repository: string; expiresAt: string }) {
  const owner = useRef<ReturnType<typeof createCandidateSaveStatusClient> | null>(null), heading = useRef<HTMLHeadingElement>(null);
  const [result, setResult] = useState<CandidateSaveStatusOutput | null>(null), [visible, setVisible] = useState(false);
  const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true, location: string | null = null;
    const valid = () => Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) > Date.now() && !document.hidden;
    const clear = (message: string) => {
      const prior = owner.current; owner.current = null; prior?.close();
      if (active) { setResult(null); setBusy(false); setNotice(message); }
    };
    const load = async () => {
      location = window.location.hash; const link = readCandidateSaveStatusLocation(location);
      clear(''); setVisible(link.kind !== 'none');
      if (link.kind === 'none') return;
      if (link.kind === 'invalid') { setNotice('This save-status link is incomplete or invalid. No other operation was selected.'); return; }
      if (!valid()) { setNotice('Status cleared. Refresh access on the visible page before rechecking.'); return; }
      const client = createCandidateSaveStatusClient({ organizationId, repository }, window.location.origin); owner.current = client;
      setBusy(true); setNotice('Checking the original save operation and its Git receipt…');
      try {
        const value = await client.read(link.reference);
        if (!active || owner.current !== client) return;
        if (!valid()) { clear('Status cleared. Refresh access before rechecking.'); return; }
        setResult(value); setNotice(candidateSaveStatusMessage(value.outcome));
      } catch { if (active && owner.current === client) clear('Save status could not be verified. Refresh access and recheck the same operation.'); }
      finally { if (active && owner.current === client) setBusy(false); }
    };
    const navigate = () => { if (location !== window.location.hash) void load(); };
    const hide = () => { if (document.hidden) clear('Status cleared while hidden. Recheck the same operation when you return.'); };
    const leave = () => clear('Status cleared after navigation. Recheck the same operation.');
    const restore = (event: PageTransitionEvent) => { if (event.persisted) leave(); };
    const remaining = Date.parse(expiresAt) - Date.now(), timer = setTimeout(() => clear('Session display expired. Refresh access before rechecking.'),
      Number.isFinite(remaining) ? Math.max(0, Math.min(remaining, 2147483647)) : 0);
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', leave); window.addEventListener('pageshow', restore);
    window.addEventListener('hashchange', navigate); window.addEventListener('popstate', navigate); void load();
    return () => {
      active = false; clearTimeout(timer); clear('');
      document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', leave); window.removeEventListener('pageshow', restore);
      window.removeEventListener('hashchange', navigate); window.removeEventListener('popstate', navigate);
    };
  }, [organizationId, repository, expiresAt, refresh]);
  useEffect(() => { if (result) heading.current?.focus(); }, [result]);
  if (!visible) return null;
  return <section className="access-card candidate-save-status" aria-labelledby="candidate-save-status-title">
    <span className="access-label">ORIGINAL SAVE · READ-ONLY RECOVERY</span>
    <h2 id="candidate-save-status-title" ref={heading} tabIndex={-1}>Check a candidate save</h2>
    <p role="status">{notice}</p>
    <div className="intent-document-buttons"><button type="button" className="access-secondary" disabled={busy} onClick={() => setRefresh(n => n + 1)}>Recheck original save</button>
      <button type="button" className="access-secondary" onClick={() => {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`); window.dispatchEvent(new window.HashChangeEvent('hashchange'));
      }}>Close save status</button></div>
    {result && <>
      <dl className="candidate-metadata"><dt>Original operation</dt><dd><code>{result.operationId}</code></dd>
        <dt>Preserved draft revision</dt><dd>{result.draftRevision}</dd></dl>
      {result.outcome === 'committed' && <p><a href={candidateFragment(result.reference)} onClick={event => {
        if (document.hidden || Date.parse(expiresAt) <= Date.now()) { event.preventDefault(); owner.current?.close(); owner.current = null; setResult(null); setNotice('Refresh access before reopening.'); }
      }}>Open exact saved bundle</a></p>}
      <p className="access-hint">This read cannot retry a save, change your draft, clear quarantine, sign a gate or grant execution. Opening a saved bundle checks its read permission separately.</p>
    </>}
  </section>;
}
