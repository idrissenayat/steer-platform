import { useEffect, useMemo, useRef, useState } from "react";
import { kitVersion, learnManifest, learnSources } from "../data/learn-corpus";
import { buildLearnCorpus, resolveLearnLocation, searchLearnCorpus, slugifyLearn, type HubEvent, type LearnBlock, type LearnPage } from "@steer/domain/learn";
import type { Role } from "@steer/domain/types";
import { CloseIcon } from "./Icons";

const glossaryTerms = ["greenfield indicator", "outcome contract", "organization", "stack pack", "work item", "default-closed", "default-open", "intent", "pull", "exam", "gate", "band", "hat"];

function scrollLearnIntoView(id: string) {
  const element = document.getElementById(id);
  if (element && typeof element.scrollIntoView === "function") element.scrollIntoView({ block: "start" });
}

function renderBlockText(block: LearnBlock): string[] {
  if (block.kind === "paragraph") return [block.text];
  if (block.kind === "list") return block.items;
  return [block.headers.join(" "), ...block.rows.map((row) => row.join(" "))];
}

export function GlossaryPeek({ onClose, term }: { onClose: () => void; term: string }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const glossary = useMemo(() => buildLearnCorpus(learnManifest, learnSources).find((page) => page.id === "glossary")!, []);
  const entry = glossary.sections.find((section) => section.id === slugifyLearn(term));

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previous?.focus();
  }, []);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return <div aria-label={`${term} glossary entry`} aria-modal="true" className="review-backdrop learn-peek-backdrop" onKeyDown={handleKeyDown} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }} role="dialog">
    <section className="review-panel learn-peek" ref={panelRef}>
      <button aria-label="Close glossary entry" className="drawer-close icon-button" onClick={onClose} ref={closeRef} type="button"><CloseIcon /></button>
      <header className="review-panel__header learn-peek__header"><div><p className="eyebrow">STEER glossary · {kitVersion.tag}</p><h2>{entry?.title ?? term}</h2><p>Operational definition from the same corpus loaded by the agent fleet.</p></div></header>
      <div className="review-panel__section learn-peek__body">{entry?.blocks.map((block, index) => <LearnBlockView block={block} key={`${block.kind}-${index}`} />) ?? <p>This term is not present in the current glossary.</p>}</div>
      <footer className="review-panel__footer"><p>Dismiss this peek to return to the exact term that opened it.</p><button className="secondary-button" onClick={onClose} type="button">Return to Learn</button></footer>
    </section>
  </div>;
}

function LearnBlockView({ allowedTerms, block, onTerm }: { allowedTerms?: Set<string>; block: LearnBlock; onTerm?: (term: string) => void }) {
  const linkedInBlock = new Set<string>();
  const linkText = (text: string) => {
    if (!allowedTerms || !onTerm) return text;
    const matcher = new RegExp(`\\b(${glossaryTerms.map((term) => term.replace("-", "\\-")).join("|")})\\b`, "gi");
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    for (const match of text.matchAll(matcher)) {
      const start = match.index ?? 0;
      const normalized = match[0].toLowerCase();
      nodes.push(text.slice(cursor, start));
      if (allowedTerms.has(normalized) && !linkedInBlock.has(normalized)) {
        linkedInBlock.add(normalized);
        nodes.push(<button className="glossary-term" key={`${normalized}-${start}`} onClick={() => onTerm(normalized)} type="button">{match[0]}<span className="sr-only"> · open glossary definition</span></button>);
      } else nodes.push(match[0]);
      cursor = start + match[0].length;
    }
    nodes.push(text.slice(cursor));
    return nodes;
  };

  if (block.kind === "paragraph") return <p>{linkText(block.text)}</p>;
  if (block.kind === "list") {
    const Tag = block.ordered ? "ol" : "ul";
    return <Tag>{block.items.map((item) => <li key={item}>{linkText(item)}</li>)}</Tag>;
  }
  return <div className="learn-table-wrap"><table><thead><tr>{block.headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={`${row[0]}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${cellIndex}-${cell}`}>{linkText(cell)}</td>)}</tr>)}</tbody></table></div>;
}

function LearnPageView({ onSuggestChange, onTerm, page, selectedSection }: { onSuggestChange: (page: LearnPage, section: string) => void; onTerm: (term: string) => void; page: LearnPage; selectedSection: string }) {
  return <article className="learn-reader__page">
    <header className="learn-page-header"><div><p className="eyebrow">{page.kind} · operational canon</p><h2>{page.title}</h2><p>{page.summary}</p></div><span className="learn-version">Framework {kitVersion.tag}</span></header>
    {page.sections.map((section) => {
      const firstBlockForTerm = new Map<string, number>();
      section.blocks.forEach((block, blockIndex) => {
        const text = renderBlockText(block).join(" ").toLowerCase();
        glossaryTerms.forEach((term) => { if (!firstBlockForTerm.has(term) && text.includes(term)) firstBlockForTerm.set(term, blockIndex); });
      });
      return <section className={section.id === selectedSection ? "learn-copy learn-copy--selected" : "learn-copy"} id={`learn-${page.id}-${section.id}`} key={section.id}>
        <header><h3>{section.title}</h3><button aria-label={`Suggest a change to ${page.title}, ${section.title}`} onClick={() => onSuggestChange(page, section.id)} type="button">Suggest a change</button></header>
        {section.blocks.map((block, index) => <LearnBlockView allowedTerms={new Set([...firstBlockForTerm.entries()].filter(([, blockIndex]) => blockIndex === index).map(([term]) => term))} block={block} key={`${block.kind}-${index}`} onTerm={onTerm} />)}
      </section>;
    })}
  </article>;
}

export function LearnHub({ onEvent, onSuggestChange, role }: { onEvent: (event: HubEvent) => void; onSuggestChange: (page: LearnPage, section: string) => void; role: Role }) {
  const corpus = useMemo(() => buildLearnCorpus(learnManifest, learnSources), []);
  const [pageId, setPageId] = useState("guidebook");
  const [sectionId, setSectionId] = useState("overview");
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [peekTerm, setPeekTerm] = useState<string | null>(null);
  const openedAt = useRef(Date.now());
  const page = corpus.find((candidate) => candidate.id === pageId) ?? corpus[0];
  const hits = useMemo(() => searchLearnCorpus(corpus, query), [corpus, query]);
  const orientation = learnManifest.orientationPaths[role] ?? [];

  function openPage(nextPageId: string, nextSectionId?: string, eventType: HubEvent["type"] = "page-open") {
    const resolved = resolveLearnLocation(corpus, nextPageId, nextSectionId);
    if (!resolved) { setNotice("That page is not part of the current framework version."); return; }
    setPageId(resolved.page.id);
    setSectionId(resolved.sectionId);
    setNotice(resolved.notice ?? null);
    const hash = `#learn/${resolved.page.id}/${resolved.sectionId}`;
    window.history.replaceState(null, "", hash);
    onEvent({ at: new Date().toISOString(), durationMs: Math.max(0, Date.now() - openedAt.current), page: resolved.page.id, section: resolved.sectionId, type: eventType });
    requestAnimationFrame(() => scrollLearnIntoView(`learn-${resolved.page.id}-${resolved.sectionId}`));
  }

  useEffect(() => {
    function syncHash() {
      const match = window.location.hash.match(/^#learn\/([^/?#]+)(?:\/([^/?#]+))?/);
      if (!match) return;
      const resolved = resolveLearnLocation(corpus, decodeURIComponent(match[1]), match[2] ? decodeURIComponent(match[2]) : undefined);
      if (!resolved) { setNotice("That page is not part of the current framework version."); return; }
      setPageId(resolved.page.id);
      setSectionId(resolved.sectionId);
      setNotice(resolved.notice ?? null);
      requestAnimationFrame(() => scrollLearnIntoView(`learn-${resolved.page.id}-${resolved.sectionId}`));
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [corpus]);

  return <section className="learn-hub" id="learn">
    <header className="learn-hero"><div><p className="eyebrow">One canon · humans and agents</p><h2>Learn STEER</h2><p>Understand why STEER exists, how it works, and what to do in your first hour—without leaving the platform.</p></div><div className="learn-hero__version"><span>Corpus aligned</span><strong>{kitVersion.tag}</strong><small>Build-guarded against the kit</small></div></header>

    <div className="learn-search-area">
      <label className="learn-search"><span>Search the operational canon</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Try “exam invariant” or “intent vs work item”" type="search" value={query} /></label>
      {query.trim() ? <div aria-live="polite" className="learn-search-results">{hits.length ? hits.map((hit) => <button key={`${hit.pageId}-${hit.sectionId}`} onClick={() => openPage(hit.pageId, hit.sectionId, "search-open")} type="button"><span>{hit.pageTitle}</span><strong>{hit.sectionTitle}</strong><small>{hit.excerpt}</small></button>) : <p>No Learn sections match “{query}”. Try a framework term or accountability.</p>}</div> : null}
    </div>

    <div className="learn-orientation">
      <div><p className="eyebrow">Your first hour</p><h3>{role.replaceAll("-", " ")} orientation</h3><p>Five stateless steps ending in a real action. Nothing here records reading progress.</p></div>
      {orientation.length ? <ol>{orientation.map((step, index) => <li key={`${step.label}-${index}`}><span>{index + 1}</span>{step.pageId ? <button onClick={() => openPage(step.pageId!, step.section)} type="button">{step.label}</button> : <a href={step.actionHash} onClick={() => onEvent({ at: new Date().toISOString(), durationMs: Math.max(0, Date.now() - openedAt.current), page: page.id, section: sectionId, type: "first-action" })}>{step.label} →</a>}</li>)}</ol> : <p className="learn-orientation__empty">Use the Glossary and Framework as the specialist orientation starting point.</p>}
    </div>

    {notice ? <div className="learn-notice" role="status">{notice}</div> : null}
    <div className="learn-workspace">
      <nav aria-label="Learn documents" className="learn-library"><p>Operational canon</p>{corpus.map((candidate) => <button aria-current={candidate.id === page.id ? "page" : undefined} key={candidate.id} onClick={() => openPage(candidate.id)} type="button"><span>{candidate.kind}</span><strong>{candidate.title}</strong><small>{candidate.summary}</small></button>)}</nav>
      <aside className="learn-outline"><p>On this page</p>{page.sections.map((section) => <button aria-current={section.id === sectionId ? "location" : undefined} key={section.id} onClick={() => openPage(page.id, section.id)} type="button">{section.title}</button>)}</aside>
      <LearnPageView onSuggestChange={onSuggestChange} onTerm={setPeekTerm} page={page} selectedSection={sectionId} />
    </div>
    {peekTerm ? <GlossaryPeek onClose={() => setPeekTerm(null)} term={peekTerm} /> : null}
  </section>;
}

export const learnRenderedText = (page: LearnPage) => [page.title, ...page.sections.flatMap((section) => [section.title, ...section.blocks.flatMap(renderBlockText)])].join("\n");
