'use client';

import { useEffect, useRef, useState } from 'react';
import type { CandidateSaveReviewOutput } from '@steer/tool-registry/candidate-save-review-contracts';
import { candidateSavePreviewInputSchema, type CandidateSavePreviewOutput } from '@steer/tool-registry/candidate-save-preview-contracts';
import type { IntentRunDiscoveryOutput } from '@steer/tool-registry/intent-run-discovery-contracts';
import type { DevelopmentEditorSource } from './intent-development-editor';
import { createCandidateSavePreviewClient } from './candidate-save-preview-client';
import { createIntentRunDiscoveryTransport } from './intent-run-discovery-transport';
import { createCandidateSavePrepareClient } from './candidate-save-prepare-client';
import { createCandidateSaveStartClient } from './candidate-save-start-client';
import type { CandidateSaveStartOutput } from '@steer/tool-registry/candidate-save-start-contracts';
import { candidateSaveStatusFragment } from './candidate-save-status-client';
import { candidateSavePrepareInputSchema, type CandidateSavePrepareInput, type CandidateSavePrepareOutput } from '@steer/tool-registry/candidate-save-prepare-contracts';

export default function CandidatePackagePreview({ review, source, identity, expiresAt }: {
  review: CandidateSaveReviewOutput; source: DevelopmentEditorSource; identity: string; expiresAt: string;
}) {
  const [page, setPage] = useState<IntentRunDiscoveryOutput | null>(null), [selected, setSelected] = useState('');
  const [item, setItem] = useState(''), [state, setState] = useState('idle'), [receipt, setReceipt] = useState<{ key: string; output: CandidateSavePreviewOutput } | null>(null);
  const [confirmation, setConfirmation] = useState<{ key: string; input: CandidateSavePrepareInput; output: CandidateSavePrepareOutput | null; reference: CandidateSavePrepareOutput['reference']; busy: boolean } | null>(null);
  const [saveRequest, setSaveRequest] = useState<{ key: string; output: CandidateSaveStartOutput | null; busy: boolean } | null>(null);
  const contextKey = JSON.stringify([review, source, identity, expiresAt]), selectionKey = JSON.stringify([contextKey, selected, item]);
  const active = useRef(selectionKey); active.current = selectionKey;
  const owner = useRef<{ start: ReturnType<typeof createCandidateSaveStartClient>; prepare: ReturnType<typeof createCandidateSavePrepareClient>; preview: ReturnType<typeof createCandidateSavePreviewClient>; discovery: ReturnType<typeof createIntentRunDiscoveryTransport>; valid(): boolean } | null>(null);
  const busy = useRef(false), recordsExpiry = useRef(0), heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const preview = createCandidateSavePreviewClient(window.location.origin), discovery = createIntentRunDiscoveryTransport(window.location.origin), prepare = createCandidateSavePrepareClient(window.location.origin);
    const start = createCandidateSaveStartClient(window.location.origin);
    let closed = false, last = Date.now(); recordsExpiry.current = 0; busy.current = false;
    const valid = () => { const now = Date.now(), expiry = Date.parse(expiresAt);
      const result = !closed && !document.hidden && Number.isFinite(expiry) && now >= last && now < expiry && (!recordsExpiry.current || now < recordsExpiry.current);
      last = now; return result; };
    const session = { start, prepare, preview, discovery, valid }; owner.current = session;
    const clear = () => { closed = true; start.close(); prepare.close(); preview.close(); discovery.close(); setPage(null); setSelected(''); setReceipt(null); setConfirmation(null); setSaveRequest(null); setState('closed'); };
    const check = () => { if (!valid()) clear(); };
    setPage(null); setSelected(''); setItem(''); setReceipt(null); setConfirmation(null); setSaveRequest(null); setState('idle'); check();
    const timer = setInterval(check, 1000); document.addEventListener('visibilitychange', check); window.addEventListener('pagehide', clear);
    return () => { closed = true; start.close(); prepare.close(); preview.close(); discovery.close(); if (owner.current === session) owner.current = null; clearInterval(timer);
      document.removeEventListener('visibilitychange', check); window.removeEventListener('pagehide', clear); };
  }, [contextKey, expiresAt]);
  const result = receipt?.key === selectionKey ? receipt.output : null;
  const confirmed = confirmation?.key === selectionKey ? confirmation : null;
  const saving = saveRequest?.key === selectionKey ? saveRequest : null;
  useEffect(() => { if (result) heading.current?.focus(); }, [result]);
  async function find(cursor: IntentRunDiscoveryOutput['cursor'] = null) {
    const session = owner.current;
    if (!session?.valid() || busy.current) return;
    busy.current = true; setReceipt(null); setSelected(''); setPage(null); setState('finding');
    try {
      const output = await session.discovery.discover({ organizationId: review.organizationId, productId: review.productId,
        repository: review.repository, draftId: review.draftId, cursor });
      if (owner.current !== session || !session.valid()) return;
      if ((['revision', 'revisionDigest', 'scopeInputDigest'] as const).some(k => output.latest[k] !== source.input[k])
        || Date.now() >= Date.parse(output.useUntil)) throw new Error();
      recordsExpiry.current = Date.parse(output.useUntil); setPage(output); setState('ready');
    } catch { if (owner.current === session && session.valid()) setState('unavailable'); }
    finally { if (owner.current === session) busy.current = false; }
  }
  const existing = review.choice.action === 'extend-existing' ? /^items\/([^/]+)\/BRIEF\.md$/.exec(review.choice.target.path)?.[1] : undefined;
  const entry = page?.entries.find(e => e.kind === 'development' && e.operationId === selected);
  const { kind: _kind, subject: _subject, branch: _branch, expectedHead: _head, documents: _docs, assessmentDigest: _assessment,
    dispositionDigest: _direction, saveConfirmed: _consent, operationCreated: _operation, savedToGit: _saved,
    executionAuthorized: _execution, gateSigned: _gate, ...reviewInput } = review;
  const parsed = candidateSavePreviewInputSchema.safeParse({ ...reviewInput, generation: entry?.kind === 'development'
    ? { operationId: entry.operationId, inputDigest: entry.inputDigest } : null, itemId: existing ?? item, proposalId: null });
  async function preview() {
    const session = owner.current, key = selectionKey;
    if (!session?.valid() || busy.current || !parsed.success || !source.content.documents) return;
    busy.current = true; setReceipt(null); setState('previewing');
    try {
      const output = await session.preview.preview(parsed.data, source.content.documents);
      if (owner.current !== session || !session.valid() || active.current !== key) return;
      if (JSON.stringify(output.review) !== JSON.stringify(review)) throw new Error();
      setReceipt({ key, output }); setState('ready');
    } catch { if (owner.current === session && session.valid() && active.current === key) {
      setPage(null); setSelected(''); setReceipt(null); setState('unavailable');
    } }
    finally { if (owner.current === session) busy.current = false; }
  }
  async function confirm() {
    const session = owner.current, key = selectionKey;
    if (!session?.valid() || busy.current || !result || confirmed?.output?.outcome === 'prepared') return;
    const input = confirmed?.input ?? candidateSavePrepareInputSchema.parse({ organizationId: result.input.organizationId,
      preview: result.input, previewDigest: result.previewDigest, confirmation: result.proposedConfirmation, confirm: true });
    const reference = confirmed?.reference ?? null;
    busy.current = true; setConfirmation({ key, input, output: null, reference, busy: true });
    try {
      const output = await session.prepare.prepare(input);
      if (owner.current !== session || !session.valid() || active.current !== key) return;
      setConfirmation({ key, input, output, reference: output.reference ?? reference, busy: false });
    } catch { if (owner.current === session && session.valid() && active.current === key) setConfirmation({ key, input, output: null, reference, busy: false }); }
    finally { if (owner.current === session) busy.current = false; }
  }
  async function startSave() {
    const session = owner.current, key = selectionKey;
    if (!session?.valid() || busy.current || confirmed?.output?.outcome !== 'prepared' || !confirmed.reference
      || saving?.output?.receipt.outcome === 'acknowledged') return;
    busy.current = true; setSaveRequest({ key, output: null, busy: true });
    try {
      const output = await session.start.start({ ...confirmed.reference, save: true });
      if (owner.current !== session || !session.valid() || active.current !== key) return;
      setSaveRequest({ key, output, busy: false });
    } catch { if (owner.current === session && session.valid() && active.current === key) setSaveRequest({ key, output: null, busy: false }); }
    finally { if (owner.current === session) busy.current = false; }
  }
  // An uncertain acknowledgement keeps the same command. The package controls
  // cannot silently turn a recovery click into a new confirmation.
  const working = state === 'finding' || state === 'previewing' || !!confirmed;
  return <section aria-label="Candidate package preview">
    <h5>Preview the repository package</h5>
    <p>Select the drafting run to compare with your preserved documents. Previewing does not confirm a save or start an agent.</p>
    <button type="button" className="access-secondary" disabled={working || state === 'closed'} onClick={() => { void find(); }}>Find drafting runs for this package</button>
    {page && <><label htmlFor="candidate-generation-run">Original drafting run</label>
      <select id="candidate-generation-run" value={selected} disabled={working} onChange={e => { setSelected(e.target.value); setReceipt(null); }}>
        <option value="">Select a recorded run</option>{page.entries.filter(e => e.kind === 'development').map(e => e.kind === 'development'
          && <option key={e.operationId} value={e.operationId}>Draft revision {e.source.revision} · {e.operationId}</option>)}</select>
      {!page.entries.some(e => e.kind === 'development') && <p>No drafting runs on this page. A missing reference is not proof that no generation was attempted.</p>}
      {page.nextCursor && <button type="button" disabled={working} onClick={() => { void find(page.nextCursor); }}>More drafting runs</button>}
      {page.cursor && <button type="button" disabled={working} onClick={() => { void find(); }}>First page</button>}
    </>}
    {review.choice.action === 'extend-existing' ? <p>{existing ? `Existing destination: items/${existing}` : 'This legacy destination needs an explicit publication mapping before package preview is available.'}</p>
      : <><label htmlFor="candidate-item-name">Repository item ID</label><input id="candidate-item-name" value={item} maxLength={160} disabled={working || state === 'closed'}
        placeholder="For example, 0260-booking" onChange={e => { setItem(e.target.value); setReceipt(null); }} />
        <p>Use the assigned four-digit number and a short name. The server checks that this destination is available; this field does not reserve it.</p></>}
    <button type="button" className="access-secondary" disabled={working || state === 'closed' || !parsed.success || (review.choice.action === 'extend-existing' && !existing)} onClick={() => { void preview(); }}>Preview exact package</button>
    <div role="status" aria-live="polite">{(state === 'finding' || state === 'previewing') && <p>{state === 'finding' ? 'Finding recorded drafting runs…' : 'Verifying the documents, both agent roles and destination…'}</p>}
      {state === 'unavailable' && <p>Package preview is unavailable or changed under current configuration or permissions. Your documents are unchanged; nothing was confirmed or saved.</p>}</div>
    {result && <div><h5 ref={heading} tabIndex={-1}>Exact package preview — not saved</h5>
      <p>{result.destination.purpose} · {result.destination.repository} · {result.destination.branch} · items/{result.destination.itemId}</p>
      <p>Original generation: draft revision {result.generation.source.revision}. Preserved documents: revision {result.review.revision}.</p>
      <p>{result.manifest.lineage.editedDocuments.length ? `Changed from original output: ${result.manifest.lineage.editedDocuments.map(n => n.toUpperCase()).join(', ')}.` : 'All document bytes match the original agent output.'}</p>
      <p>Spec conformance: {result.manifest.specConformance.state}. Exam review: {result.manifest.examReview.state}. Neither is a gate signature.</p>
      <details><summary>Exact package references</summary><p>Expected commit: <code>{result.destination.expectedHead}</code></p>
        <p>Manifest: <code>{result.manifestDigest}</code></p><p>Preview: <code>{result.previewDigest}</code></p></details>
      <p>Confirming preserves this exact package for a later authorized save. It does not start the save, commit to GitHub, or sign a gate.</p>
      {!confirmed && <button type="button" className="access-primary" onClick={() => { void confirm(); }}>Confirm this exact package</button>}
      <div role="status" aria-live="polite">{confirmed?.busy && <p>Rechecking your confirmation and preserving the exact original…</p>}
        {confirmed && !confirmed.busy && (confirmed.output?.outcome === 'prepared'
          ? <p>Exact original preserved and read back. Not saved to GitHub. Saving requires a separate request and current server authorization.</p>
          : confirmed.output?.outcome === 'conflict'
            ? <p>The package changed before admission. Review the current draft and destination again; no save was started.</p>
            : <p>Confirmation acknowledgement is unavailable or uncertain. Do not create another submission. Recovery rechecks this same confirmation; it cannot start a save.</p>)}</div>
      {confirmed && !confirmed.busy && confirmed.output?.outcome !== 'prepared' && confirmed.output?.outcome !== 'conflict'
        && <button type="button" className="access-secondary" onClick={() => { void confirm(); }}>Recover this exact confirmation</button>}
      {confirmed?.output?.outcome === 'conflict' && <button type="button" className="access-secondary" onClick={() => { setConfirmation(null); setReceipt(null); }}>Return to package review</button>}
      {confirmed?.output?.outcome === 'prepared' && <>
        <p>Request saving of this exact package to the repository shown above. The server rechecks current permissions and the original draft before starting the same save operation.</p>
        {saving?.output?.receipt.outcome !== 'acknowledged' && <button type="button" className="access-primary" disabled={!!saving?.busy}
          onClick={() => { void startSave(); }}>{saving ? 'Recover this same save request' : 'Save this exact package to GitHub'}</button>}
        <div role="status" aria-live="polite">{saving?.busy ? <p>Rechecking authority and requesting the original save workflow…</p>
          : saving?.output?.receipt.outcome === 'acknowledged'
            ? <p>Save workflow acknowledged: {saving.output.receipt.state}. This does not verify a GitHub commit. Check the original save operation below for the saved documents.</p>
            : saving && <p>Save acknowledgement is unavailable or uncertain. Check the original save status first. Recovery uses the same operation and may start it if it was never accepted; it does not create a replacement submission.</p>}</div>
      </>}
      {confirmed?.reference && <a className="access-secondary" href={candidateSaveStatusFragment(confirmed.reference)}>Check this original save operation</a>}
    </div>}
  </section>;
}
