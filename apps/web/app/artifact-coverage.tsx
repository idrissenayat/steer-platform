'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { BriefProjection } from '@steer/tool-registry/brief-contracts';
import { createArtifactCoverageReader } from './artifact-coverage-reader';

type Reader = ReturnType<typeof createArtifactCoverageReader>;
const messages = {
  idle: 'Check the Spec, Exam and Plan at this Brief’s exact revision.',
  loading: 'Checking access and supporting document projections…',
  ready: 'Source check complete. Document availability does not verify approval or lifecycle stage.',
  unavailable: 'This exact Brief is no longer available. Refresh the Brief list; no newer revision was substituted.',
  failed: 'Supporting documents could not be checked. Refresh access and try again.',
  expired: 'Refresh access before checking supporting documents.',
  closed: 'Supporting document check closed.',
};
const labels = { spec: 'Spec', exam: 'Exam', plan: 'Plan' };
const statuses = { projected: 'Available in projection', 'not-projected': 'No projection at this revision', 'not-configured': 'Outside configured sources' };

export default function ArtifactCoverage({ brief, expiresAt }: { brief: BriefProjection; expiresAt: string }) {
  const owner = useRef<Reader | null>(null), trigger = useRef<HTMLButtonElement>(null), heading = useId();
  const [view, setView] = useState<ReturnType<Reader['view']> | null>(null);
  const [restoreFocus, setRestoreFocus] = useState(false);
  const { organizationId, repository, path, revision, contentDigest } = brief;
  useEffect(() => {
    const reader = createArtifactCoverageReader({ organizationId, repository, path, revision, contentDigest }, window.location.origin, expiresAt);
    owner.current = reader; setView(reader.view());
    const clear = () => { setView(reader.clear()); };
    const hide = () => { if (document.hidden) clear(); };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) clear(); };
    const timer = setTimeout(() => setView(reader.view()), Math.max(0, Math.min(Date.parse(expiresAt) - Date.now(), 2147483647)));
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', clear); window.addEventListener('pageshow', restore);
    return () => { reader.close(); if (owner.current === reader) owner.current = null; clearTimeout(timer);
      document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', clear); window.removeEventListener('pageshow', restore); };
  }, [organizationId, repository, path, revision, contentDigest, expiresAt]);
  useEffect(() => { if (restoreFocus && view?.phase !== 'loading') { trigger.current?.focus(); setRestoreFocus(false); } }, [restoreFocus, view?.phase]);
  const read = async () => {
    const reader = owner.current; if (!reader) return;
    if (document.hidden) { setView(reader.clear()); return; }
    const pending = reader.read(); setView(reader.view());
    const next = await pending; if (owner.current === reader) setView(next);
  };
  const busy = view?.phase === 'loading';
  return <section className="artifact-coverage" aria-labelledby={heading}>
    <div className="brief-library-heading"><h3 id={heading}>Supporting documents</h3>
      <button ref={trigger} type="button" className="access-secondary" disabled={!view || busy || ['expired', 'closed'].includes(view.phase)}
        onClick={() => void read()}>Check supporting documents</button></div>
    <p role="status" data-testid="artifact-coverage-status">{view ? messages[view.phase] : 'Preparing source check…'}</p>
    {view?.result && <>
      <p>Checked at <code>{view.result.brief.revision}</code>. This is not a check of Git’s current head.</p>
      <ul className="artifact-coverage-list" aria-label="Supporting document source coverage">{view.result.artifacts.map(artifact =>
        <li key={artifact.kind}><h4>{labels[artifact.kind]}</h4><p className="artifact-coverage-status">{statuses[artifact.status]}</p>
          <p><code>{artifact.path}</code></p>
          {artifact.fingerprint && <details><summary>Source fingerprints</summary><dl>
            <dt>SHA-256</dt><dd><code>{artifact.fingerprint.contentDigest}</code></dd>
            <dt>Git blob</dt><dd><code>{artifact.fingerprint.blobSha}</code></dd>
          </dl></details>}
        </li>)}</ul>
      <p className="access-hint">A missing projection does not mean a file is missing in Git. Unconfigured sources were not read. No gate or stage is approved by this check.</p>
    </>}
    {(busy || view?.result) && <button type="button" className="access-secondary" onClick={() => { if (owner.current) { setView(owner.current.clear()); setRestoreFocus(true); } }}>
      {busy ? 'Cancel document check' : 'Clear document check'}</button>}
  </section>;
}
