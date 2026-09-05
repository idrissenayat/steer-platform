'use client';

import { useEffect, useRef, useState } from 'react';
import type { BriefProjection } from '@steer/tool-registry/brief-contracts';
import { createBriefReader, type BriefReference } from './brief-reader';
import BriefMarkdown from './brief-markdown';
import { briefFragment, readBriefLocation } from './brief-location';

type Reader = ReturnType<typeof createBriefReader>;
const failed = 'Brief access could not be verified. Refresh access and try again.';
const label = (path: string) => path === 'BRIEF.md' ? 'Workspace Brief' : `Intent ${path.split('/')[1]}`;

/** Read-only view; source text never establishes status, authorship, provenance or approval. */
export default function BriefLibrary({ organizationId, repository, expiresAt }: {
  organizationId: string; repository: string; expiresAt: string;
}) {
  const owner = useRef<Reader | null>(null); const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const lastLocation = useRef<string | null>(null);
  const [records, setRecords] = useState<BriefReference[]>([]);
  const [detail, setDetail] = useState<BriefProjection | null>(null);
  const [busy, setBusy] = useState(false); const [enabled, setEnabled] = useState(false);
  const [notice, setNotice] = useState('Checking current access and discovering Briefs…');
  const [page, setPage] = useState(0);
  const closeDetail = () => { dialog.current?.close(); setDetail(null); trigger.current?.focus(); };
  const dismiss = () => {
    closeDetail();
    if (window.location.hash.startsWith('#brief=')) window.history.replaceState(null, '', '/');
    lastLocation.current = window.location.hash;
  };
  const dispose = () => { const current = owner.current; owner.current = null; current?.close(); };
  const clear = (message: string) => { dispose(); closeDetail(); setRecords([]); setBusy(false); setPage(0); setNotice(message); };
  const load = async () => {
    const location = readBriefLocation(window.location.hash); lastLocation.current = window.location.hash;
    clear('Checking current access and discovering Briefs…');
    if (document.hidden) { setNotice('Briefs cleared while this page was hidden. Refresh Briefs to recheck access.'); return; }
    if (Date.parse(expiresAt) <= Date.now()) { setEnabled(false); setNotice('Session display expired. Refresh access to continue.'); return; }
    const current = createBriefReader({ organizationId, repository }, window.location.origin); owner.current = current; setBusy(true);
    try {
      const next = await current.catalog();
      if (owner.current !== current) return;
      if (Date.parse(expiresAt) <= Date.now()) { clear('Session display expired. Refresh access to continue.'); return; }
      setRecords(next); setNotice(next.length ? 'Choose a Brief to read its selected revision.' : 'No permitted projected Briefs were returned. This does not mean the repository has no Briefs.');
      if (location.kind === 'invalid') { setNotice('This Brief link is invalid. Choose a permitted Brief from the library.'); return; }
      if (location.kind === 'brief') {
        const selected = location.selection;
        const index = selected.organizationId === organizationId && selected.repository === repository ?
          next.findIndex((item) => item.path === selected.path && item.revision === selected.revision && item.contentDigest === selected.contentDigest) : -1;
        if (index < 0) { setNotice('This linked revision is not available in this workspace. Choose a permitted Brief; no different revision has been opened.'); return; }
        setPage(Math.floor(index / 20)); setNotice('Checking current access and reading the linked revision…');
        const linked = await current.read(next[index]!);
        if (owner.current !== current) return;
        if (Date.parse(expiresAt) <= Date.now()) { clear('Session display expired. Refresh access to continue.'); return; }
        if (!linked) { clear('This Brief revision is no longer available. Refresh Briefs to discover the current projection.'); return; }
        trigger.current = [...document.querySelectorAll<HTMLButtonElement>('[data-brief-path]')].find((button) => button.dataset.briefPath === linked.path) ?? null;
        setDetail(linked); setNotice('Linked revision loaded. Access was checked again; this link does not grant permission.');
      }
    } catch { if (owner.current === current) clear(failed); }
    finally { if (owner.current === current) setBusy(false); }
  };
  const open = async (reference: BriefReference) => {
    const current = owner.current;
    if (!current || busy || Date.parse(expiresAt) <= Date.now()) { clear('Refresh access before opening a Brief.'); return; }
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeDetail(); setBusy(true); setNotice('Checking current access and reading the selected Brief…');
    try {
      const next = await current.read(reference);
      if (owner.current !== current) return;
      if (Date.parse(expiresAt) <= Date.now()) { clear('Session display expired. Refresh access to continue.'); return; }
      if (!next) { clear('This Brief revision is no longer available. Refresh Briefs to discover the current projection.'); return; }
      const fragment = briefFragment({ organizationId, repository, ...reference });
      if (window.location.hash !== fragment) window.history.pushState(null, '', `/${fragment}`);
      lastLocation.current = fragment;
      setDetail(next); setNotice('Selected revision loaded. Refresh Briefs to recheck access and discover changes.');
    } catch { if (owner.current === current) clear(failed); }
    finally { if (owner.current === current) setBusy(false); }
  };
  useEffect(() => {
    const remaining = Date.parse(expiresAt) - Date.now(); setEnabled(remaining > 0);
    void load();
    const expire = () => { setEnabled(false); clear('Session display expired. Refresh access to continue.'); };
    const hide = () => { if (document.hidden) clear('Briefs cleared while this page was hidden. Refresh Briefs to recheck access.'); };
    const leave = () => clear('Briefs cleared after navigation. Refresh Briefs to recheck access.');
    const restore = (event: PageTransitionEvent) => { if (event.persisted) leave(); };
    const navigate = () => { if (window.location.hash !== lastLocation.current) void load(); };
    const timer = setTimeout(expire, Math.max(0, Math.min(remaining, 2147483647)));
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', leave); window.addEventListener('pageshow', restore);
    window.addEventListener('popstate', navigate); window.addEventListener('hashchange', navigate);
    return () => { clearTimeout(timer); dispose(); document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', leave); window.removeEventListener('pageshow', restore);
      window.removeEventListener('popstate', navigate); window.removeEventListener('hashchange', navigate); };
  }, [organizationId, repository, expiresAt]);
  useEffect(() => {
    if (!detail) return;
    dialog.current?.showModal(); closeButton.current?.focus();
    document.documentElement.classList.add('brief-is-open');
    return () => document.documentElement.classList.remove('brief-is-open');
  }, [detail]);
  return <section className="access-card brief-library" aria-labelledby="briefs-title">
    <div className="brief-library-heading"><div><span className="access-label">READ THE INTENT</span><h2 id="briefs-title">Brief library</h2></div>
      <button type="button" className="access-secondary" disabled={!enabled || busy} onClick={() => void load()}>Refresh Briefs</button></div>
    <p>Your permitted Briefs, discovered from the configured workspace. No paths or fingerprints to enter.</p>
    <p role="status" data-testid="brief-status">{notice}</p>
    <ul className="brief-cards" data-testid="brief-catalog">{records.slice(page * 20, (page + 1) * 20).map((reference) => <li key={reference.path}>
      <span className="access-label">BRIEF</span><h3>{label(reference.path)}</h3><p>Read the source’s problem, outcome, constraints, and open questions.</p>
      <button type="button" className="access-secondary" data-brief-path={reference.path} disabled={!enabled || busy} onClick={() => void open(reference)}>Read {label(reference.path)}</button>
    </li>)}</ul>
    {records.length > 20 && <nav className="reference-controls" aria-label="Brief pages">
      <button className="access-secondary" disabled={page === 0 || busy} onClick={() => setPage(page - 1)}>Previous Briefs</button>
      <span>Page {page + 1} of {Math.ceil(records.length / 20)}</span>
      <button className="access-secondary" disabled={(page + 1) * 20 >= records.length || busy} onClick={() => setPage(page + 1)}>Next Briefs</button>
    </nav>}
    <p className="access-hint">Read-only foundation preview. No intent status, gate decision or current-Git guarantee is implied. Content clears on failed access, page hiding, or session-display expiry; no background polling or browser storage.</p>
    <dialog ref={dialog} className="brief-dialog" aria-labelledby="brief-detail-title" onCancel={(event) => { event.preventDefault(); dismiss(); }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const elements = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), summary, [href], [tabindex]:not([tabindex="-1"])')]
          .filter((element) => element.getClientRects().length > 0);
        const first = elements[0]; const last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      onClick={(event) => { if (event.target === dialog.current) { const rect = dialog.current.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dismiss(); } }}>
      {detail && <><header className="brief-detail-header"><div><span className="access-label">SELECTED REVISION · READ ONLY</span><h2 id="brief-detail-title">{detail.document.title ?? label(detail.path)}</h2></div>
        <button ref={closeButton} className="access-secondary" type="button" onClick={dismiss}>Close Brief</button></header>
        <div className="brief-detail-body">
          <p className="access-hint">Source statements below are not verified approval, provenance, or lifecycle facts.</p>
          <BriefMarkdown content={detail.content} />
          {detail.document.issues.length > 0 && <aside className="access-note" aria-label="Document structure notes"><strong>Structure needs review</strong>
            <ul>{detail.document.issues.map((issue, index) => <li key={index}>{issue.code.replaceAll('-', ' ')}{issue.section ? `: ${issue.section}` : ''}{issue.line ? ` (line ${issue.line})` : ''}</li>)}</ul></aside>}
          <details className="brief-source"><summary>Source revision details</summary><dl><dt>Source path</dt><dd>{detail.path}</dd>
            <dt>Committed revision selected</dt><dd><code>{detail.revision}</code></dd><dt>Content fingerprint (SHA-256)</dt><dd><code>{detail.contentDigest}</code></dd></dl>
            <p>Projection checked when opened. Refresh Briefs to discover changes. This is not proof that Git has stayed unchanged.</p></details>
          <p className="access-hint">The address bar links to this exact revision. It contains repository and revision metadata, never permission or source content. Anyone opening it must have current access.</p>
        </div><footer className="brief-detail-footer">Pull, decline, merge, questions and gate decisions are not connected in this read-only increment.</footer></>}
    </dialog>
  </section>;
}
