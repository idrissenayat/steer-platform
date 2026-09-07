'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { searchLearn, type LearnCorpus, type LearnBlock } from './learn-reader';

function Block({ block }: { block: LearnBlock }) {
  if (block.kind === 'paragraph') return <p>{block.text}</p>;
  if (block.kind === 'list') {
    const List = block.ordered ? 'ol' : 'ul';
    return <List>{block.items.map((item, index) => <li key={index}>{item}</li>)}</List>;
  }
  return <div className="learn-table" tabIndex={0} role="region" aria-label="Reference table"><table><thead><tr>{block.headers.map((cell, index) => <th scope="col" key={index}>{cell}</th>)}</tr></thead>
    <tbody>{block.rows.map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

export default function LearnHub({ corpus, expiresAt }: { corpus: LearnCorpus; expiresAt: string }) {
  return <GuideReader corpus={corpus} access={{ kind: 'session', expiresAt }} />;
}

/** Public operational kit only. No session, workspace data or runtime access is accepted. */
export function LocalLearnHub({ corpus }: { corpus: LearnCorpus }) {
  return <GuideReader corpus={corpus} access={{ kind: 'local-kit' }} />;
}

function GuideReader({ corpus, access }: { corpus: LearnCorpus; access: { kind: 'session'; expiresAt: string } | { kind: 'local-kit' } }) {
  const id = useId(), button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false), [pageId, setPageId] = useState(corpus.pages[0]?.id ?? ''), [query, setQuery] = useState('');
  const [expired, setExpired] = useState(false);
  const [focusTarget, setFocusTarget] = useState<{ page: string; section?: string } | null>(null);
  const localKit = access.kind === 'local-kit';
  const deadline = access.kind === 'session' ? Date.parse(access.expiresAt) : Number.NaN;
  const unavailable = () => !localKit && (expired || !Number.isFinite(Date.now()) || !Number.isFinite(deadline) || Date.now() >= deadline);
  const page = corpus.pages.find(value => value.id === pageId);
  const hits = searchLearn(corpus.pages, query);
  const clear = () => { setOpen(false); setQuery(''); setPageId(corpus.pages[0]?.id ?? ''); setFocusTarget(null); };
  useEffect(() => {
    if (!focusTarget || !open || expired) return;
    const target = document.getElementById(focusTarget.section ? `${id}-${focusTarget.page}-${focusTarget.section}` : `${id}-document`);
    target?.focus(); target?.scrollIntoView({ block: 'start' });
    setFocusTarget(null);
  }, [focusTarget, open, expired, id]);
  useEffect(() => {
    let previous = Date.now();
    const check = () => { if (localKit) return; const now = Date.now(); if (!Number.isFinite(now) || !Number.isFinite(deadline) || now >= deadline || now < previous) { setExpired(true); clear(); } previous = now; };
    const hidden = () => { if (document.visibilityState === 'hidden') clear(); check(); };
    const restored = (event: PageTransitionEvent) => { if (event.persisted) clear(); check(); };
    check(); const timer = localKit ? undefined : window.setInterval(check, 1000);
    document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', clear); window.addEventListener('pageshow', restored);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', clear); window.removeEventListener('pageshow', restored); };
  }, [deadline, localKit]);
  function select(nextPage: string, section?: string) {
    if (unavailable()) { setExpired(true); clear(); return; }
    setPageId(nextPage);
    setFocusTarget(section === undefined ? { page: nextPage } : { page: nextPage, section });
  }
  return <section id="learn" className="access-card learn-hub" aria-labelledby={`${id}-title`}>
    <div className="learn-heading"><div><span className="access-label">THE OPERATING GUIDE</span><h2 id={`${id}-title`}>Learn STEER</h2><p>Methodology, framework, operating model, and practical guidance.</p></div>
      <span className="hat-label">Kit {corpus.tag}</span></div>
    <p className="access-hint">Built from this checkout’s operational canon. This version label is not a release certification or a gate approval.</p>
    {localKit && <p className="access-hint">Local reference only. Reading does not sign in, save a draft, run an agent or authorize work. Your current draft stays in the preview while you consult this guide.</p>}
    <button ref={button} className="access-secondary" type="button" disabled={expired} aria-expanded={open} aria-controls={`${id}-reader`}
      onClick={() => { if (unavailable()) { setExpired(true); clear(); } else { if (open) clear(); else setOpen(true); } }}>{open ? 'Close guide' : 'Open guide'}</button>
    {expired && <p role="status">Refresh access to reopen the guide.</p>}
    {open && page && <div id={`${id}-reader`} className="learn-reader">
      <label className="learn-search">Search the guide<input type="search" value={query} maxLength={200} onChange={event => setQuery(event.target.value)} /></label>
      {query.trim() && <div className="learn-results"><p role="status">{hits.length ? `${hits.length} matching sections (up to 12 shown).` : 'No matching sections. Try a different term.'}</p>
        <ul>{hits.map(hit => <li key={`${hit.pageId}-${hit.sectionId}`}><button type="button" onClick={() => select(hit.pageId, hit.sectionId)}>{hit.pageTitle} · {hit.title}</button><p>{hit.excerpt}</p></li>)}</ul></div>}
      <div className="learn-layout"><aside className="learn-navigation"><nav aria-label="Guide documents"><ul>{corpus.pages.map(doc => <li key={doc.id}><button type="button" aria-current={doc.id === pageId ? 'page' : undefined} onClick={() => select(doc.id)}>{doc.title}</button></li>)}</ul></nav>
        <nav aria-label="On this guide page"><h3>On this page</h3><ul>{page.sections.map(section => <li key={section.id}><a href={`#${id}-${page.id}-${section.id}`} onClick={event => { event.preventDefault(); select(page.id, section.id); }}>{section.title}</a></li>)}</ul></nav></aside>
        <article className="learn-document" aria-labelledby={`${id}-document`}><h3 id={`${id}-document`} tabIndex={-1}>{page.title}</h3><p>{page.summary}</p>
          <details className="learn-provenance"><summary>Version and exact source</summary><dl><dt>Kit version</dt><dd>{corpus.tag}</dd><dt>Canonical path</dt><dd><code>{page.path}</code></dd><dt>Original source</dt><dd>{page.sourcePath}</dd><dt>Source SHA-256</dt><dd><code>{page.contentDigest}</code></dd></dl><pre>{page.raw}</pre></details>
          {page.sections.map(section => <section key={`${page.id}-${section.id}`} aria-labelledby={`${id}-${page.id}-${section.id}`}><h4 id={`${id}-${page.id}-${section.id}`} tabIndex={-1}>{section.title}</h4>{section.blocks.map((block, index) => <Block key={index} block={block} />)}</section>)}
          <p className="access-note">Need to correct the guide? Propose an intent referencing this canonical path and source fingerprint. This reader cannot edit the canon or submit an intent.</p>
          <button className="access-secondary" type="button" onClick={() => { clear(); button.current?.focus(); }}>Close guide and return</button>
        </article></div></div>}
  </section>;
}
