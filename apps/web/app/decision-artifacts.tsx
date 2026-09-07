import { useEffect, useId, useRef, useState } from 'react';
import type { BriefDecisions, DecisionEvidence } from '@steer/tool-registry/decision-contracts';
import { createDecisionEvidenceReader } from './decision-evidence-reader';
import { briefFragment } from './brief-location';

/** Evidence is shown as inert original text, never executed or promoted to approval. */
export default function DecisionArtifacts({ brief, record, expiresAt, active, onSelect }: {
  brief: BriefDecisions['brief']; record: BriefDecisions['records'][number]; expiresAt: string;
  active: boolean; onSelect: () => void;
}) {
  const owner = useRef<ReturnType<typeof createDecisionEvidenceReader> | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null); const panel = useRef<HTMLDivElement>(null);
  const heading = useId(); const [detail, setDetail] = useState<DecisionEvidence | null>(null);
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  const [restoreFocus, setRestoreFocus] = useState(false);
  const dispose = () => { owner.current?.close(); owner.current = null; };
  useEffect(() => () => dispose(), [record]);
  useEffect(() => { if (!active) { dispose(); setDetail(null); setBusy(false); setNotice(''); setRestoreFocus(false); } }, [active]);
  useEffect(() => { if (detail) panel.current?.focus(); }, [detail]);
  useEffect(() => { if (restoreFocus && !busy) { trigger.current?.focus(); setRestoreFocus(false); } }, [restoreFocus, busy]);
  const clear = () => { dispose(); setDetail(null); setBusy(false); setNotice('Evidence source cleared.'); setRestoreFocus(true); };
  const read = async (evidence: { path: string; revision: string }, button: HTMLButtonElement) => {
    dispose(); setDetail(null); setBusy(false); trigger.current = button;
    if (document.hidden || Date.parse(expiresAt) <= Date.now()) { setNotice('Refresh access before inspecting evidence.'); return; }
    onSelect();
    const current = createDecisionEvidenceReader({ ...brief, decision: { path: record.path, revision: record.revision, contentDigest: record.contentDigest }, evidence }, window.location.origin);
    owner.current = current; setBusy(true); setNotice('Checking the selected decision, current access and exact evidence source…');
    try {
      const next = await current.read();
      if (owner.current !== current) return;
      if (document.hidden || Date.parse(expiresAt) <= Date.now()) { dispose(); setBusy(false); setNotice('Refresh access before inspecting evidence.'); return; }
      setDetail(next); setNotice(next ? 'Exact source loaded. Its claims and approval remain unverified.' :
        'This exact selection is no longer available. Reload the decision records; no different revision was opened.');
    } catch { if (owner.current === current) { setDetail(null); setNotice('Evidence source could not be checked. Refresh access and reload the decision records.'); } }
    finally { if (owner.current === current) setBusy(false); }
  };
  return <>
    <h5>Referenced artifacts · source claims</h5>
    <ul>{record.claims.artifacts.map((artifact, index) => <li key={index}><code>{artifact.path}</code> at <code>{artifact.revision}</code>
      {artifact.path === brief.path && artifact.revision === brief.revision ? <> · <a href={briefFragment(brief)}>This selected Brief</a></> :
        <button type="button" className="access-secondary evidence-inspect" disabled={busy}
          onClick={event => void read(artifact, event.currentTarget)}>Inspect {artifact.path}</button>}</li>)}</ul>
    <p className="access-hint">Inspection requires current access and a configured source path. A recorded reference cannot grant permission.</p>
    {notice && <p role="status" data-testid="evidence-status">{notice}</p>}
    {active && (busy || detail) && <button type="button" className="access-secondary" onClick={clear}>{busy ? 'Cancel evidence read' : 'Close evidence source'}</button>}
    {active && detail && <div ref={panel} tabIndex={-1} className="decision-evidence" role="region" aria-labelledby={heading}>
      <h6 id={heading}>Evidence source: {detail.artifact.path}</h6>
      <p>Read-only projected source. Content is not an independently verified review, gate approval or permission to act.</p>
      <dl><dt>Exact source revision</dt><dd><code>{detail.artifact.revision}</code></dd>
        <dt>SHA-256</dt><dd><code>{detail.artifact.contentDigest}</code></dd>
        <dt>Referenced by decision source</dt><dd>{detail.decision.path} at <code>{detail.decision.revision}</code></dd></dl>
      <pre>{detail.artifact.content}</pre>
    </div>}
  </>;
}
