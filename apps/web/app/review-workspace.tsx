'use client';

import { useEffect, useRef, useState } from 'react';
import { createReviewWorkspaceReader } from './review-workspace-reader';
import BriefDecisionRecords from './brief-decisions';
import ArtifactCoverage from './artifact-coverage';
import { briefFragment } from './brief-location';

type Reader = ReturnType<typeof createReviewWorkspaceReader>;
const label = (path: string) => path === 'BRIEF.md' ? 'Workspace Brief' : `Intent ${path.split('/')[1]}`;

export default function ReviewWorkspace({ organizationId, repository, expiresAt }: {
  organizationId: string; repository: string; expiresAt: string;
}) {
  const owner = useRef<Reader | null>(null), selection = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ReturnType<Reader['view']> | null>(null); const [page, setPage] = useState(0);
  const clear = () => { if (owner.current) setView(owner.current.clear()); setPage(0); };
  useEffect(() => {
    const reader = createReviewWorkspaceReader({ organizationId, repository }, window.location.origin, expiresAt); owner.current = reader; setView(reader.view());
    const hide = () => { if (document.hidden) clear(); };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) clear(); };
    const timer = setTimeout(() => setView(reader.view()), Math.max(0, Math.min(Date.parse(expiresAt) - Date.now(), 2147483647)));
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', clear); window.addEventListener('pageshow', restore);
    return () => { reader.close(); if (owner.current === reader) owner.current = null; clearTimeout(timer);
      document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', clear); window.removeEventListener('pageshow', restore); };
  }, [organizationId, repository, expiresAt]);
  useEffect(() => { if (view?.selected) selection.current?.focus(); }, [view?.selected?.path, view?.selected?.revision, view?.selected?.contentDigest]);
  const run = async (reference?: NonNullable<typeof view>['records'][number]) => {
    const reader = owner.current; if (!reader) return;
    if (document.hidden) { clear(); return; }
    const pending = reference ? reader.open(reference) : reader.refresh(); setView(reader.view()); if (!reference) setPage(0);
    const next = await pending; if (owner.current === reader) setView(next);
  };
  const disabled = !view || ['loading', 'expired', 'closed'].includes(view.phase), records = view?.records ?? [];
  return <section className="access-card review-workspace" aria-labelledby="review-workspace-title">
    <div className="brief-library-heading"><div><span className="access-label">REVIEW SOURCES · READ ONLY</span><h2 id="review-workspace-title">Review records</h2></div>
      <button className="access-secondary" disabled={disabled} onClick={() => void run()}>Refresh review list</button></div>
    <p>Inspect the decisions and evidence recorded for a Brief, without opening its full document first. This is not an assigned decision inbox or verified approval queue.</p>
    <p role="status" data-testid="review-workspace-status">{view?.message ?? 'Preparing review access…'}</p>
    <ul className="brief-work-list" aria-label="Briefs available for record inspection">{records.slice(page * 20, (page + 1) * 20).map(reference =>
      <li key={reference.path}><div><h3>{label(reference.path)}</h3><p className="brief-work-path">{reference.path}</p></div>
        <div className="brief-work-revision"><span className="access-label">EXACT SOURCE REVISION</span><code>{reference.revision}</code></div>
        <button className="access-secondary" disabled={disabled} aria-expanded={view?.selected?.path === reference.path}
          onClick={() => void run(reference)}>Inspect records for {label(reference.path)}</button></li>)}</ul>
    {records.length > 20 && <nav className="reference-controls" aria-label="Review list pages">
      <button className="access-secondary" disabled={disabled || page === 0} onClick={() => setPage(page - 1)}>Previous review page</button>
      <span>Page {page + 1} of {Math.ceil(records.length / 20)}</span>
      <button className="access-secondary" disabled={disabled || (page + 1) * 20 >= records.length} onClick={() => setPage(page + 1)}>Next review page</button>
    </nav>}
    {view?.selected && <div ref={selection} tabIndex={-1} className="review-selection" role="region" aria-label="Selected review source">
      <h3>{view.selected.document.title ?? label(view.selected.path)}</h3><p><code>{view.selected.path}</code> at <code>{view.selected.revision}</code></p>
      <a href={briefFragment({ organizationId, repository, path: view.selected.path, revision: view.selected.revision, contentDigest: view.selected.contentDigest })}>Read this exact Brief</a>
      <ArtifactCoverage key={`coverage:${view.selected.path}:${view.selected.revision}:${view.selected.contentDigest}`} brief={view.selected} expiresAt={expiresAt} />
      <BriefDecisionRecords key={`${view.selected.path}:${view.selected.revision}:${view.selected.contentDigest}`} brief={view.selected} expiresAt={expiresAt} />
    </div>}
    <button className="access-secondary" disabled={!records.length && !view?.selected && view?.phase !== 'loading'} onClick={clear}>Clear review records</button>
    <p className="access-hint">No background collection or browser storage. Sources clear on access failure, session-display expiry, page hiding or navigation. Review actions and gate signing remain unavailable.</p>
  </section>;
}
