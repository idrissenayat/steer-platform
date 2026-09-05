'use client';

import { useEffect, useRef, useState } from 'react';
import { createProjectionConsumer, type ProjectionConsumerView } from '@steer/tool-registry/projection-consumer';
import { createProjectionTransport } from './projection-transport';

type Connection = { consumer: ReturnType<typeof createProjectionConsumer>; transport: ReturnType<typeof createProjectionTransport> };
const messages: Record<ProjectionConsumerView['phase'], string> = {
  idle: 'Choose a repository to load its references.', loading: 'Checking current access and loading references…',
  ready: 'References loaded. Refresh to check for changes and recheck access.',
  'catching-up': 'More changes remain. Refresh to continue catching up.',
  'waiting-for-stream': 'No change stream yet. Refresh to take a new snapshot.',
  'reset-required': 'The checkpoint changed. Refresh to load a fresh snapshot.',
  failed: 'References could not be verified. Refresh access and try again.', closed: 'References cleared.',
};

/** Display-only client island. No credential props, browser storage, automatic polling or writes. */
export default function ProjectionPanel({ organizationId, expiresAt }: { organizationId: string; expiresAt: string }) {
  const owner = useRef<Connection | null>(null);
  const [repository, setRepository] = useState('');
  const [view, setView] = useState<ProjectionConsumerView | null>(null);
  const [notice, setNotice] = useState('Choose a repository to load its references.');
  const [enabled, setEnabled] = useState(false);
  const [page, setPage] = useState(0);
  const dispose = () => {
    const current = owner.current; owner.current = null;
    current?.transport.close(); void current?.consumer.close();
  };
  const clear = (message: string) => { dispose(); setView(null); setPage(0); setNotice(message); };
  useEffect(() => {
    const remaining = Date.parse(expiresAt) - Date.now();
    setEnabled(remaining > 0);
    const expire = () => { setEnabled(false); clear('Session display expired. Refresh access before loading references.'); };
    const hide = () => { if (document.hidden) clear('References cleared while this page was hidden. Load them again to recheck access.'); };
    const leave = () => clear('References cleared after navigation. Load them again to recheck access.');
    const restore = (event: PageTransitionEvent) => { if (event.persisted) leave(); };
    const timer = setTimeout(expire, Math.max(0, Math.min(remaining, 2147483647)));
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', leave);
    window.addEventListener('pageshow', restore);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', leave); window.removeEventListener('pageshow', restore); dispose(); };
  }, [organizationId, expiresAt]);
  const sync = async (current: Connection) => {
    setPage(0);
    const pending = current.consumer.sync(); setView(current.consumer.view());
    try {
      const next = await pending;
      if (owner.current === current) setView(next);
    } catch { if (owner.current === current) clear(messages.failed); }
  };
  const busy = view?.phase === 'loading';
  return <section className="access-card reference-panel" aria-labelledby="references-title">
    <span className="access-label">READ-ONLY DATA CONNECTION</span>
    <h2 id="references-title">Repository references</h2>
    <p>Inspect projected artifact keys and revision fingerprints for this organization. These are not intent statuses, approvals, or proof that Git is unchanged.</p>
    <form className="reference-form" onSubmit={(event) => {
      event.preventDefault();
      if (!enabled || busy || Date.parse(expiresAt) <= Date.now()) { clear('Refresh access before loading references.'); return; }
      clear(messages.idle);
      try {
        const transport = createProjectionTransport(window.location.origin);
        const consumer = createProjectionConsumer({ organizationId, repository: repository.trim() }, transport.port);
        const current = { transport, consumer }; owner.current = current; void sync(current);
      } catch { clear('Enter a valid repository scope ID and try again.'); }
    }}>
      <div><label htmlFor="reference-repository">Repository scope ID</label>
        <input id="reference-repository" value={repository} maxLength={200} required autoComplete="off" spellCheck={false}
          disabled={!enabled} aria-describedby="reference-scope-note" placeholder="github:repository-id"
          onChange={(event) => { clear(messages.idle); setRepository(event.target.value); }} /></div>
      <button className="access-primary" type="submit" disabled={!enabled || busy}>Load references</button>
    </form>
    <p id="reference-scope-note" className="access-hint">Organization: {organizationId}. Use the repository scope ID from your runtime configuration, not its URL. This never grants access. The server checks your current Git-backed permissions on every request.</p>
    <div className="reference-controls">
      <button className="access-secondary" type="button" disabled={!enabled || busy || !owner.current} onClick={() => {
        if (Date.parse(expiresAt) <= Date.now()) { clear('Refresh access before loading references.'); return; }
        const current = owner.current; if (current) void sync(current);
      }}>Refresh references</button>
      <button className="access-secondary" type="button" disabled={!owner.current} onClick={() => clear('References cleared. No data is saved in this browser.')}>Clear references</button>
    </div>
    <p role="status" data-testid="reference-status">{view ? messages[view.phase] : notice}</p>
    {view && view.records.length > 0 && <>
      <p className="access-hint">{view.records.length} references · showing {page * 20 + 1}–{Math.min((page + 1) * 20, view.records.length)}. Checkpoint {view.cursor?.position ?? 'not established'}.</p>
      <ul className="reference-list" data-testid="reference-list">{view.records.slice(page * 20, (page + 1) * 20).map((record) => <li key={record.recordKey}>
        <h3>{record.recordKey}</h3><dl><div><dt>Source revision</dt><dd><code>{record.sourceRevision}</code></dd></div>
          <div><dt>SHA-256</dt><dd><code>{record.contentDigest}</code></dd></div></dl></li>)}</ul>
      {view.records.length > 20 && <nav className="reference-controls" aria-label="Reference pages">
        <button className="access-secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous references</button>
        <button className="access-secondary" disabled={(page + 1) * 20 >= view.records.length} onClick={() => setPage(page + 1)}>Next references</button>
      </nav>}
    </>}
    {view && ['ready', 'waiting-for-stream'].includes(view.phase) && view.records.length === 0 && <p>No projected references were returned for this scope.</p>}
    <p className="access-hint">References stay in memory only and clear on error, scope edit, page hiding, or session-display expiry. No background polling or repository writes.</p>
  </section>;
}
