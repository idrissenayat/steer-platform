'use client';

import { useEffect, useRef, useState } from 'react';
import { describeCandidateSaveReview, type CandidateSaveReviewOutput } from '@steer/tool-registry/candidate-save-review-contracts';
import { bindRecordedIntentScope, verifyBoundIntentScope, intentScopeSelectionFor } from '@steer/tool-registry/intent-scope-selection';
import type { IntentDevelopmentReviewOutput } from '@steer/tool-registry/intent-development-review-contracts';
import type { IntentScopeReadOutput } from '@steer/tool-registry/intent-scope-read-contracts';
import type { IntentDispositionChoice } from '@steer/tool-registry/intent-overlap-contracts';
import type { DevelopmentEditorSource } from './intent-development-editor';
import { createCandidateSaveReviewClient } from './candidate-save-review-client';

export default function CandidateSaveReview({ source, review, assessment, choice, subject, identity, expiresAt, locked }: {
  source: DevelopmentEditorSource | null; review: IntentDevelopmentReviewOutput | null; assessment: IntentScopeReadOutput | null;
  choice: IntentDispositionChoice | null; subject: string; identity: string; expiresAt: string; locked: boolean;
}) {
  const [receipt, setResult] = useState<{ output: CandidateSaveReviewOutput; selectionKey: string } | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const heading = useRef<HTMLHeadingElement>(null), session = useRef<{ client: ReturnType<typeof createCandidateSaveReviewClient>; valid(): boolean } | null>(null);
  const selectionKey = JSON.stringify([source, review, assessment, choice, locked]);
  const result = receipt?.selectionKey === selectionKey ? receipt.output : null;
  useEffect(() => {
    const client = createCandidateSaveReviewClient(window.location.origin); let closed = false, last = Date.now();
    const valid = () => { const now = Date.now(), expiry = Date.parse(expiresAt); const allowed = !closed && !document.hidden
      && Number.isFinite(expiry) && now >= last && now < expiry; last = now; return allowed; };
    const current = { client, valid }; session.current = current; setResult(null); setBusy(false); setMessage('');
    const close = () => { closed = true; client.close(); setResult(null); setBusy(false); setMessage(''); };
    const check = () => { if (!valid()) close(); };
    const timer = setInterval(check, 1000); check(); document.addEventListener('visibilitychange', check); window.addEventListener('pagehide', close);
    return () => { closed = true; client.close(); if (session.current === current) session.current = null; clearInterval(timer);
      document.removeEventListener('visibilitychange', check); window.removeEventListener('pagehide', close); };
  }, [identity, expiresAt, selectionKey]);
  useEffect(() => { if (result) heading.current?.focus(); }, [result]);
  async function check() {
    const current = session.current;
    if (!current?.valid() || busy || locked || !source?.content.documents || !review || !choice) return;
    setBusy(true); setResult(null); setMessage('');
    try {
      const selected = assessment?.review ? { kind: 'recorded' as const, reviewId: assessment.reviewId,
        preparationDigest: assessment.preparationDigest, resultsDigest: assessment.review.resultsDigest } : null;
      const binding = selected ? await bindRecordedIntentScope(selected, assessment, review.evidence, { ...source.input, subject })
        : await verifyBoundIntentScope({ kind: 'empty-corpus', planDigest: review.scopeBatchPlan.planDigest }, review.evidence);
      const input = { ...source.input, configurationRevision: review.configurationRevision, sourceSnapshotDigest: review.sourceSnapshotDigest,
        choice, scopeReview: intentScopeSelectionFor(binding) };
      const expected = await describeCandidateSaveReview(input, subject, review.evidence.branch, source.content.documents, review.evidence, binding);
      if (!current.valid() || session.current !== current) return;
      const output = await current.client.review(input, source.content.documents);
      if (!current.valid() || session.current !== current) return;
      if (JSON.stringify(output) !== JSON.stringify(expected)) throw new Error(); setResult({ output, selectionKey });
    } catch { if (current.valid() && session.current === current) { setResult(null); setMessage('Final review could not be verified. Preserve and review the current draft and sources again. Nothing was saved or confirmed.'); } }
    finally { if (session.current === current) setBusy(false); }
  }
  if (!source?.content.documents) return null;
  return <section className="access-note" aria-labelledby="candidate-save-review-title">
    <h4 id="candidate-save-review-title" ref={heading} tabIndex={-1}>Review this bundle for saving</h4>
    <p>Check the preserved Brief, Spec and Exam with your selected direction. This reads current records and scope evidence; it does not regenerate documents or save to GitHub.</p>
    <button type="button" className="access-secondary" disabled={locked || busy || !review || !choice} onClick={() => { void check(); }}>
      {busy ? 'Checking the final draft…' : 'Review final draft for saving'}</button>
    <div role="status" aria-live="polite" aria-atomic="true">{message && <p>{message}</p>}
      {result && <><p>Exact preserved revision {result.revision} and selected direction checked against commit <code>{result.expectedHead}</code>.</p>
        <dl className="candidate-metadata">{(['brief', 'spec', 'exam'] as const).map(name => <div key={name}>
          <dt>{name.toUpperCase()}.md · {result.documents[name].bytes.toLocaleString()} bytes</dt><dd><code>{result.documents[name].contentDigest}</code></dd></div>)}</dl>
        <p>Read-only review reference: <code>{result.reviewDigest}</code>.</p>
        <p>No save confirmed, operation created or gate signed. Destination, generation lineage, lifecycle authority and exact human save confirmation still need verification before saving is available.</p></>}
    </div>
  </section>;
}
