'use client';

import { useEffect, useRef, useState } from 'react';
import type { CandidateBundleReadOutput } from '@steer/tool-registry/candidate-bundle-read-contracts';
import { createCandidateReader } from './candidate-reader';
import { readCandidateLocation } from './candidate-location';
import BriefMarkdown from './brief-markdown';

/** Mounted in the actual signed-in workspace. Links select bytes, never authority. */
export default function CandidateBundle({ organizationId, repository, expiresAt }: {
  organizationId: string; repository: string; expiresAt: string;
}) {
  const owner = useRef<ReturnType<typeof createCandidateReader> | null>(null), heading = useRef<HTMLHeadingElement>(null);
  const [value, setValue] = useState<CandidateBundleReadOutput | null>(null);
  const [visible, setVisible] = useState(false), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<'brief' | 'spec' | 'exam'>('brief'), [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true, location: string | null = null;
    const valid = () => Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) > Date.now() && !document.hidden;
    const clear = (message: string) => {
      const previous = owner.current; owner.current = null; previous?.close();
      if (active) { setValue(null); setBusy(false); setSelected('brief'); setNotice(message); }
    };
    const load = async () => {
      location = window.location.hash;
      const link = readCandidateLocation(location);
      clear(''); setVisible(link.kind !== 'none');
      if (link.kind === 'none') return;
      if (link.kind === 'invalid') { setNotice('This saved-candidate link is incomplete or invalid. No other revision was opened.'); return; }
      if (!valid()) { setNotice('Content cleared. Return to the visible page and refresh access before reopening.'); return; }
      const reader = createCandidateReader({ organizationId, repository }, window.location.origin); owner.current = reader;
      setBusy(true); setNotice('Checking current access and all three saved documents…');
      try {
        const result = await reader.read(link.reference);
        if (!active || owner.current !== reader) return;
        if (!valid()) { clear('Content cleared. Refresh access before reopening.'); return; }
        setValue(result); setNotice('Exact saved revision loaded. This is candidate content, not an accepted Spec, canonical Exam or gate approval.');
      } catch {
        if (active && owner.current === reader) clear('This saved candidate could not be verified. Refresh access and reopen the exact link.');
      } finally { if (active && owner.current === reader) setBusy(false); }
    };
    const navigate = () => { if (location !== window.location.hash) void load(); };
    const hide = () => { if (document.hidden) clear('Saved content cleared while this page was hidden. Reopen to recheck access.'); };
    const leave = () => clear('Saved content cleared after navigation. Reopen to recheck access.');
    const restore = (event: PageTransitionEvent) => { if (event.persisted) leave(); };
    const remaining = Date.parse(expiresAt) - Date.now();
    const timer = setTimeout(() => clear('Session display expired. Refresh access before reopening.'),
      Number.isFinite(remaining) ? Math.max(0, Math.min(remaining, 2147483647)) : 0);
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', leave); window.addEventListener('pageshow', restore);
    window.addEventListener('hashchange', navigate); window.addEventListener('popstate', navigate);
    void load();
    return () => {
      active = false; clearTimeout(timer); clear('');
      document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', leave); window.removeEventListener('pageshow', restore);
      window.removeEventListener('hashchange', navigate); window.removeEventListener('popstate', navigate);
    };
  }, [organizationId, repository, expiresAt, refresh]);
  useEffect(() => { if (value) heading.current?.focus(); }, [value]);
  if (!visible) return null;
  return <section className="access-card candidate-bundle" aria-labelledby="candidate-title">
    <span className="access-label">SAVED CANDIDATE · READ ONLY</span>
    <h2 id="candidate-title" tabIndex={-1} ref={heading}>Saved intent bundle</h2>
    <p role="status">{notice}</p>
    <div className="intent-document-buttons">
      <button className="access-secondary" type="button" disabled={busy} onClick={() => setRefresh(count => count + 1)}>Reopen exact saved revision</button>
      <button className="access-secondary" type="button" onClick={() => {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
        window.dispatchEvent(new window.HashChangeEvent('hashchange'));
      }}>Close saved bundle</button>
    </div>
    {value && <>
      <dl className="candidate-metadata"><dt>Intent</dt><dd>{value.reference.itemId}</dd>
        <dt>Saved commit</dt><dd><code>{value.reference.revision}</code></dd>
        <dt>Bundle purpose</dt><dd>{value.manifest.purpose}</dd>
        <dt>Spec conformance</dt><dd>{value.manifest.specConformance.state}</dd>
        <dt>Exam review</dt><dd>{value.manifest.examReview.state}</dd></dl>
      <p className="access-hint">Reading this bundle does not replace your current draft, verify its claims, grant execution, or prove it is the latest repository state.</p>
      <div className="intent-document-buttons" role="group" aria-label="Saved candidate documents">
        {(['brief', 'spec', 'exam'] as const).map(name => <button className="access-secondary" type="button" key={name}
          aria-pressed={selected === name} onClick={() => setSelected(name)}>{name.toUpperCase()}</button>)}
      </div>
      <article aria-label={`Saved ${selected.toUpperCase()}`}><BriefMarkdown content={value.documents[selected]} /></article>
      <details><summary>Exact source and verification details</summary>
        <dl className="candidate-metadata"><dt>Document path</dt><dd>{value.sources.documents[selected].path}</dd>
          <dt>Document SHA-256</dt><dd><code>{value.sources.documents[selected].contentDigest}</code></dd>
          <dt>Manifest SHA-256</dt><dd><code>{value.reference.manifestDigest}</code></dd></dl>
        <pre className="intent-draft-source">{value.documents[selected]}</pre>
      </details>
    </>}
  </section>;
}
