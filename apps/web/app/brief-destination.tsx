'use client';

import { useEffect, useRef, useState } from 'react';
import { createDestinationController, destinationMessages, type DestinationState } from './brief-destination-client';

export default function BriefDestination({ organizationId, expiresAt }: { organizationId: string; expiresAt: string }) {
  const [state, setState] = useState<DestinationState>({ kind: 'idle' });
  const [enabled, setEnabled] = useState(false);
  const owner = useRef<ReturnType<typeof createDestinationController> | null>(null);
  useEffect(() => {
    const current = createDestinationController({ organizationId }, expiresAt, window.location.origin, setState);
    owner.current = current; setState({ kind: 'idle' });
    const remaining = Date.parse(expiresAt) - Date.now();
    setEnabled(Number.isFinite(remaining) && remaining > 0 && !document.hidden);
    const expire = () => { setEnabled(false); current.expire(); };
    const hide = () => {
      if (document.hidden) { setEnabled(false); current.invalidate(); }
      else setEnabled(Date.parse(expiresAt) > Date.now());
    };
    const leave = () => { setEnabled(false); current.invalidate(); };
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) { current.invalidate(); setEnabled(!document.hidden && Date.parse(expiresAt) > Date.now()); }
    };
    const timer = setTimeout(expire, Number.isFinite(remaining) ? Math.max(0, Math.min(remaining, 2147483647)) : 0);
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', leave); window.addEventListener('pageshow', restore);
    return () => {
      current.close(); if (owner.current === current) owner.current = null; clearTimeout(timer);
      document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', leave); window.removeEventListener('pageshow', restore);
    };
  }, [organizationId, expiresAt]);
  const check = () => {
    if (document.hidden) { owner.current?.invalidate(); return; }
    if (Date.parse(expiresAt) <= Date.now()) { setEnabled(false); owner.current?.expire(); return; }
    void owner.current?.load();
  };
  const result = state.kind === 'observed' ? state.destination : null;
  return <section className="author-destination" aria-labelledby="destination-title" aria-busy={state.kind === 'loading'}>
    <h4 id="destination-title">Where this Brief could go</h4>
    <p role="status" data-testid="destination-status">{destinationMessages[state.kind]}</p>
    {result && <div className="destination-details">
      <dl><div><dt>Repository ID</dt><dd>{result.repository}</dd></div>
        <div><dt>Branch</dt><dd>{result.branch}</dd></div>
        <div><dt>Revision observed</dt><dd><code>{result.observedHead}</code></dd></div>
        <div><dt>Checked at (UTC)</dt><dd><time dateTime={result.observedAt}>{result.observedAt.replace('T', ' ').replace('Z', ' UTC')}</time></dd></div></dl>
      <details><summary>Configured Brief paths ({result.paths.length})</summary>
        <ul>{result.paths.map((path) => <li key={path}><code>{path}</code></li>)}</ul></details>
      <p>These paths may already exist. No path is selected, and this check does not grant permission to save.</p>
    </div>}
    <button className="access-secondary" type="button" disabled={!enabled || state.kind === 'loading'} onClick={check}>
      {state.kind === 'loading' ? 'Checking destination…' : 'Check destination'}</button>
    <p className="access-hint">Saving is not enabled. Observations expire after 15 seconds; details clear on expiry or when this page is hidden. Checking does not change your draft.</p>
  </section>;
}
