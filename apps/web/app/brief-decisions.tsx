'use client';

import { useEffect, useRef, useState } from 'react';
import type { BriefDecisions } from '@steer/tool-registry/decision-contracts';
import type { BriefProjection } from '@steer/tool-registry/brief-contracts';
import { createDecisionReader } from './decision-reader';
import { briefFragment } from './brief-location';

/** Record inspection, never an approval action or a source of lifecycle state. */
export default function BriefDecisionRecords({ brief, expiresAt }: { brief: BriefProjection; expiresAt: string }) {
  const owner = useRef<ReturnType<typeof createDecisionReader> | null>(null);
  const [result, setResult] = useState<BriefDecisions | null>(null); const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('Load the permitted decision records for this selected Brief.');
  const reference = { organizationId: brief.organizationId, repository: brief.repository, path: brief.path,
    revision: brief.revision, contentDigest: brief.contentDigest };
  const dispose = () => { owner.current?.close(); owner.current = null; };
  useEffect(() => () => dispose(), [brief]);
  const load = async () => {
    dispose(); setResult(null); setBusy(false);
    if (document.hidden || Date.parse(expiresAt) <= Date.now()) { setNotice('Refresh access before reading decision records.'); return; }
    const current = createDecisionReader(reference, window.location.origin); owner.current = current;
    setBusy(true); setNotice('Checking current access and reading decision sources…');
    try {
      const next = await current.read();
      if (owner.current !== current) return;
      if (document.hidden || Date.parse(expiresAt) <= Date.now()) { dispose(); setBusy(false); setNotice('Refresh access before reading decision records.'); return; }
      setResult(next); setNotice(!next ? 'The selected Brief is no longer available. Close it and refresh Briefs; no different revision was opened.' :
        next.records.length ? 'Decision sources checked. Recorded claims below remain unverified.' :
        'No permitted projected decision records were returned. This does not prove that no decisions exist.');
    } catch { if (owner.current === current) { setResult(null); setNotice('Decision records could not be checked. Refresh access and try again.'); } }
    finally { if (owner.current === current) setBusy(false); }
  };
  return <section className="brief-decisions" aria-labelledby="brief-decisions-title">
    <div className="brief-library-heading"><h3 id="brief-decisions-title">Recorded decisions</h3>
      <button type="button" className="access-secondary" disabled={busy} onClick={() => void load()}>Load decision records</button></div>
    <p>These are source claims, not verified human signatures, gate clearance or permission to write. Matching a Brief revision does not verify an approval.</p>
    <p role="status" data-testid="decision-status">{notice}</p>
    {result?.records.map(record => <article className="decision-record" key={record.path}>
      <h4>Gate {record.claims.gate} · Recorded decision: {record.claims.decision}</h4>
      <p className="decision-linkage">{record.briefLinked ? 'References this exact Brief revision.' : 'Does not reference this exact Brief revision.'} <strong>Approval unverified.</strong></p>
      <dl><dt>Recorded organization / item</dt><dd>{record.claims.organization} / {record.claims.item}</dd>
        <dt>Recorded product home</dt><dd>{record.claims.productHome}</dd>
        <dt>Recorded artifact revision</dt><dd><code>{record.claims.artifactRevision}</code></dd></dl>
      <h5>Recorded signers · unverified</h5>
      <ul>{record.claims.signatures.map((signer, index) => <li key={index}>{signer.subject} · {signer.hat} · Sequence {signer.sequence} · {signer.signedAt}</li>)}</ul>
      <h5>Referenced artifacts · source claims</h5>
      <ul>{record.claims.artifacts.map((artifact, index) => <li key={index}><code>{artifact.path}</code> at <code>{artifact.revision}</code>
        {artifact.path === brief.path && artifact.revision === brief.revision && <> · <a href={briefFragment(reference)}>This selected Brief</a></>}</li>)}</ul>
      <details className="decision-source"><summary>Decision source and fingerprint</summary>
        <dl><dt>Source path</dt><dd>{record.path}</dd><dt>Selected record revision</dt><dd><code>{record.revision}</code></dd>
          <dt>SHA-256</dt><dd><code>{record.contentDigest}</code></dd><dt>Git blob</dt><dd><code>{record.blobSha}</code></dd></dl>
        <p>Exact projected source. Additional fields below remain source statements. Reads do not prove that Git has stayed unchanged.</p>
        <pre>{record.content}</pre></details>
    </article>)}
  </section>;
}
