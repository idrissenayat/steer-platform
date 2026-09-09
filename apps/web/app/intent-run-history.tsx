'use client';

import { useEffect, useRef, useState } from 'react';
import type { IntentRunDiscoveryInput, IntentRunDiscoveryOutput, IntentRunEntry } from '@steer/tool-registry/intent-run-discovery-contracts';
import { createIntentRunDiscoveryTransport } from './intent-run-discovery-transport';
import type { IntentAdmissionInput, IntentAdmissionOutput } from '@steer/tool-registry/intent-admission-discovery-contracts';
import { createIntentAdmissionDiscoveryTransport } from './intent-admission-discovery-transport';
import type { DevelopmentEditorSource } from './intent-development-editor';
import DevelopmentHistory from './intent-development-history';
import { ScopeHistory } from './intent-scope-panel';

/** Navigation only: no editor setter, generation controller or save callback. */
export default function IntentRunHistory({ scope, draftId, currentSource, subject, identity, expiresAt, locked = false }: {
  scope: Pick<IntentRunDiscoveryInput, 'organizationId' | 'productId' | 'repository'>; draftId: string;
  currentSource: DevelopmentEditorSource | null; subject: string; identity: string; expiresAt: string; locked?: boolean;
}) {
  const [page, setPage] = useState<IntentRunDiscoveryOutput | null>(null), [selected, setSelected] = useState<IntentRunEntry | null>(null);
  const [state, setState] = useState('idle'), [resultKey, setResultKey] = useState('');
  const [diagnostics, setDiagnostics] = useState<IntentAdmissionOutput | null>(null), [diagnosticState, setDiagnosticState] = useState('idle');
  const [diagnosticKey, setDiagnosticKey] = useState('');
  const diagnosticOwner = useRef<ReturnType<typeof createIntentAdmissionDiscoveryTransport> | null>(null), diagnosticHeading = useRef<HTMLHeadingElement>(null);
  const owner = useRef<ReturnType<typeof createIntentRunDiscoveryTransport> | null>(null), busy = useRef(false), heading = useRef<HTMLHeadingElement>(null);
  const recordsExpiry = useRef(0);
  const selectionKey = JSON.stringify([scope, draftId, currentSource, subject, identity, expiresAt, locked]), active = useRef(selectionKey); active.current = selectionKey;
  useEffect(() => {
    const transport = createIntentRunDiscoveryTransport(window.location.origin); owner.current = transport; busy.current = false; recordsExpiry.current = 0;
    const diagnosticTransport = createIntentAdmissionDiscoveryTransport(window.location.origin); diagnosticOwner.current = diagnosticTransport;
    let closed = false, last = Date.now();
    const clear = () => { closed = true; transport.close(); if (owner.current === transport) owner.current = null;
      diagnosticTransport.close(); if (diagnosticOwner.current === diagnosticTransport) diagnosticOwner.current = null;
      setDiagnostics(null); setDiagnosticKey(''); setDiagnosticState('closed');
      setPage(null); setSelected(null); setResultKey(''); setState('closed'); };
    const check = () => { const now = Date.now(), expiry = Date.parse(expiresAt);
      if (!closed && (locked || document.hidden || !Number.isFinite(expiry) || now < last || now >= expiry || (recordsExpiry.current > 0 && now >= recordsExpiry.current))) clear(); last = now; };
    setPage(null); setSelected(null); setResultKey(''); setState('idle'); check();
    setDiagnostics(null); setDiagnosticKey(''); if (!closed) setDiagnosticState('idle');
    const timer = setInterval(check, 1000); document.addEventListener('visibilitychange', check); window.addEventListener('pagehide', clear);
    return () => { closed = true; transport.close(); if (owner.current === transport) owner.current = null;
      diagnosticTransport.close(); if (diagnosticOwner.current === diagnosticTransport) diagnosticOwner.current = null;
      clearInterval(timer); document.removeEventListener('visibilitychange', check); window.removeEventListener('pagehide', clear); };
  }, [selectionKey, expiresAt, locked]);
  useEffect(() => { if (state === 'ready') heading.current?.focus(); }, [state]);
  useEffect(() => { if (diagnosticState === 'ready') diagnosticHeading.current?.focus(); }, [diagnosticState]);
  async function diagnose(cursor: IntentAdmissionInput['cursor'] = null) {
    const transport = diagnosticOwner.current, key = selectionKey, startedAt = Date.now(); if (!transport || busy.current || locked) return;
    const current = () => diagnosticOwner.current === transport && active.current === key && !document.hidden && Date.now() >= startedAt && Date.now() < Date.parse(expiresAt);
    busy.current = true; setDiagnostics(null); setDiagnosticKey(''); setDiagnosticState('reading');
    // A refreshed observation must not leave an older selected content panel visible.
    setPage(null); setSelected(null); setResultKey(''); setState('idle');
    try {
      const output = await transport.discover({ ...scope, draftId, cursor }); if (!current()) return;
      if (currentSource?.input.draftId === draftId && (currentSource.input.revision > output.latest.revision
        || (currentSource.input.revision === output.latest.revision && (currentSource.input.revisionDigest !== output.latest.revisionDigest
          || currentSource.input.scopeInputDigest !== output.latest.scopeInputDigest)))) throw new Error('Changed diagnostics snapshot');
      if (Date.now() >= Date.parse(output.useUntil)) throw new Error('Expired diagnostics');
      recordsExpiry.current = recordsExpiry.current ? Math.min(recordsExpiry.current, Date.parse(output.useUntil)) : Date.parse(output.useUntil);
      setDiagnostics(output); setDiagnosticKey(key); setDiagnosticState('ready');
    } catch { if (current()) { setDiagnostics(null); setDiagnosticState('unavailable'); } }
    finally { if (diagnosticOwner.current === transport) busy.current = false; }
  }
  async function find(cursor: IntentRunDiscoveryInput['cursor'] = null) {
    const transport = owner.current, key = selectionKey, startedAt = Date.now(); if (!transport || busy.current || locked) return;
    const current = () => owner.current === transport && active.current === key && !document.hidden && Date.now() >= startedAt && Date.now() < Date.parse(expiresAt);
    busy.current = true; setPage(null); setSelected(null); setResultKey(''); setState('reading');
    setDiagnostics(null); setDiagnosticKey(''); setDiagnosticState('idle');
    try {
      const output = await transport.discover({ ...scope, draftId, cursor }); if (!current()) return;
      if (currentSource?.input.draftId === draftId && currentSource.input.revision > output.latest.revision) throw new Error('Older discovery snapshot');
      if (currentSource?.input.draftId === draftId && currentSource.input.revision === output.latest.revision
        && (currentSource.input.revisionDigest !== output.latest.revisionDigest || currentSource.input.scopeInputDigest !== output.latest.scopeInputDigest)) throw new Error('Changed discovery snapshot');
      if (Date.now() >= Date.parse(output.useUntil)) throw new Error('Expired discovery');
      recordsExpiry.current = recordsExpiry.current ? Math.min(recordsExpiry.current, Date.parse(output.useUntil)) : Date.parse(output.useUntil);
      setPage(output); setResultKey(key); setState('ready');
    } catch { if (current()) { setPage(null); setSelected(null); setState('unavailable'); } }
    finally { if (owner.current === transport) busy.current = false; }
  }
  const shown = resultKey === selectionKey ? page : null, chosen = shown ? selected : null;
  const diagnosticShown = diagnosticKey === selectionKey ? diagnostics : null;
  const contentExpiry = shown && Date.parse(shown.useUntil) < Date.parse(expiresAt) ? shown.useUntil : expiresAt;
  return <section aria-label="Retained agent run history" className="intent-run-history access-note">
    <h4>Agent runs across this draft’s revisions</h4>
    <p>Draft <code>{draftId}</code>. Find recorded scope reviews and drafting runs without loading them into your editor or starting new work.</p>
    <button type="button" className="access-secondary" disabled={locked || state === 'reading' || state === 'closed' || diagnosticState === 'reading'} onClick={() => { void find(); }}>Find retained agent runs</button>
    <div role="status" aria-live="polite">{state === 'reading' && <p>Finding retained references…</p>}
      {state === 'unavailable' && <p>Run history is unavailable or changed under current access. This is not an empty history. Your editor is unchanged; explicitly refresh the list when ready.</p>}</div>
    {shown && <div><h5 ref={heading} tabIndex={-1}>Retained references · latest preserved revision {shown.latest.revision}</h5>
      <p>All preserved revisions in the current records configuration. Ordered by revision, run type and reference—not generation time. A reference does not prove a run started or finished.</p>
      {!shown.entries.length && <p>No retained input references on this page. This does not prove that no request was attempted or that the intent is new.</p>}
      <ul>{shown.entries.map(entry => { const id = entry.kind === 'scope' ? entry.reviewId : entry.operationId;
        return <li key={`${entry.kind}:${id}`}><p>{entry.kind === 'scope' ? 'Scope review' : 'Document drafting'} · source revision {entry.source.revision} · <code>{id}</code></p>
          <button type="button" className="access-secondary" aria-pressed={chosen === entry} onClick={() => setSelected(entry)}>Inspect {entry.kind === 'scope' ? 'scope review' : 'drafting run'} from revision {entry.source.revision}</button></li>;
      })}</ul>
      {shown.nextCursor && <button type="button" className="access-secondary" onClick={() => { void find(shown.nextCursor); }}>More retained runs</button>}
      {shown.cursor && <button type="button" className="access-secondary" onClick={() => { void find(); }}>Return to first page</button>}
      <p>Refresh to include newly prepared runs. Held, discarded, published, expired-retention and differently configured records are not disclosed. Reading content requires separate current history permission.</p>
    </div>}
    <div className="intent-preparation-diagnostics">
      <h4>Missing a previous request?</h4>
      <p>Check recorded preparation separately from retained input. This does not start, retry or save work.</p>
      <button type="button" className="access-secondary" disabled={locked || state === 'reading' || state === 'closed' || diagnosticState === 'reading' || diagnosticState === 'closed'} onClick={() => { void diagnose(); }}>Check preparation diagnostics</button>
      <div role="status" aria-live="polite">{diagnosticState === 'reading' && <p>Checking preparation records…</p>}
        {diagnosticState === 'unavailable' && <p>Preparation diagnostics are unavailable or changed under current access. This is not an empty history or permission to retry.</p>}</div>
      {diagnosticShown && <div><h5 ref={diagnosticHeading} tabIndex={-1}>Preparation diagnostics · latest preserved revision {diagnosticShown.latest.revision}</h5>
        <p>Limited to {diagnosticShown.configuredExecutionCount} configured scope-review and drafting bindings. Other configurations and candidate saves were not searched. Ordered by revision, type and reference—not execution time.</p>
        {!diagnosticShown.entries.length && <p>No preparation records on this page within these bindings. This does not prove no earlier request exists.</p>}
        <ul>{diagnosticShown.entries.map(entry => <li key={`${entry.kind}:${entry.kind === 'scope' ? entry.reviewId : entry.operationId}`}>
          <p>{entry.kind === 'scope' ? 'Scope review' : 'Document drafting'} · source revision {entry.source.revision} · <code>{entry.kind === 'scope' ? entry.reviewId : entry.operationId}</code></p>
          <p>{entry.originalRecord === 'not-observed' ? 'Preparation recorded; original input metadata was not observed. Do not create another request from this result.' : 'Original input metadata is present; content and execution outcome are not verified.'}</p>
          {entry.executionExpired && <p>The execution window has expired. Retained metadata does not extend it.</p>}
        </li>)}</ul>
        {diagnosticShown.nextCursor && <button type="button" className="access-secondary" onClick={() => { void diagnose(diagnosticShown.nextCursor); }}>More preparation records</button>}
        {diagnosticShown.cursor && <button type="button" className="access-secondary" onClick={() => { void diagnose(); }}>First preparation page</button>}
        <p>Execution status was not inspected. No retry or new model call is authorized. To inspect retained content, use “Find retained agent runs” with separate current permission.</p>
      </div>}
    </div>
    {chosen?.kind === 'development' && <DevelopmentHistory key={`development:${chosen.operationId}`} input={{ ...scope, operationId: chosen.operationId, inputDigest: chosen.inputDigest }}
      original={{ input: { ...scope, draftId, ...chosen.source } }} currentSource={currentSource} identity={identity} expiresAt={contentExpiry} />}
    {chosen?.kind === 'scope' && <ScopeHistory key={`scope:${chosen.reviewId}`} input={{ ...scope, reviewId: chosen.reviewId, preparationDigest: chosen.preparationDigest }}
      subject={subject} identity={identity} expiresAt={contentExpiry} contextKey={selectionKey} draftId={draftId} revision={chosen.source.revision} revisionDigest={chosen.source.revisionDigest} />}
  </section>;
}
