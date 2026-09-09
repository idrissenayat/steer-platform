'use client';

import { useEffect, useRef, useState } from 'react';
import type { IntentRunDiscoveryInput, IntentRunDiscoveryOutput, IntentRunEntry } from '@steer/tool-registry/intent-run-discovery-contracts';
import { createIntentRunDiscoveryTransport } from './intent-run-discovery-transport';
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
  const owner = useRef<ReturnType<typeof createIntentRunDiscoveryTransport> | null>(null), busy = useRef(false), heading = useRef<HTMLHeadingElement>(null);
  const recordsExpiry = useRef(0);
  const selectionKey = JSON.stringify([scope, draftId, currentSource, subject, identity, expiresAt, locked]), active = useRef(selectionKey); active.current = selectionKey;
  useEffect(() => {
    const transport = createIntentRunDiscoveryTransport(window.location.origin); owner.current = transport; busy.current = false; recordsExpiry.current = 0;
    let closed = false, last = Date.now();
    const clear = () => { closed = true; transport.close(); if (owner.current === transport) owner.current = null;
      setPage(null); setSelected(null); setResultKey(''); setState('closed'); };
    const check = () => { const now = Date.now(), expiry = Date.parse(expiresAt);
      if (!closed && (locked || document.hidden || !Number.isFinite(expiry) || now < last || now >= expiry || (recordsExpiry.current > 0 && now >= recordsExpiry.current))) clear(); last = now; };
    setPage(null); setSelected(null); setResultKey(''); setState('idle'); check();
    const timer = setInterval(check, 1000); document.addEventListener('visibilitychange', check); window.addEventListener('pagehide', clear);
    return () => { closed = true; transport.close(); if (owner.current === transport) owner.current = null;
      clearInterval(timer); document.removeEventListener('visibilitychange', check); window.removeEventListener('pagehide', clear); };
  }, [selectionKey, expiresAt, locked]);
  useEffect(() => { if (state === 'ready') heading.current?.focus(); }, [state]);
  async function find(cursor: IntentRunDiscoveryInput['cursor'] = null) {
    const transport = owner.current, key = selectionKey, startedAt = Date.now(); if (!transport || busy.current || locked) return;
    const current = () => owner.current === transport && active.current === key && !document.hidden && Date.now() >= startedAt && Date.now() < Date.parse(expiresAt);
    busy.current = true; setPage(null); setSelected(null); setResultKey(''); setState('reading');
    try {
      const output = await transport.discover({ ...scope, draftId, cursor }); if (!current()) return;
      if (currentSource?.input.draftId === draftId && currentSource.input.revision > output.latest.revision) throw new Error('Older discovery snapshot');
      if (currentSource?.input.draftId === draftId && currentSource.input.revision === output.latest.revision
        && (currentSource.input.revisionDigest !== output.latest.revisionDigest || currentSource.input.scopeInputDigest !== output.latest.scopeInputDigest)) throw new Error('Changed discovery snapshot');
      if (Date.now() >= Date.parse(output.useUntil)) throw new Error('Expired discovery');
      recordsExpiry.current = Date.parse(output.useUntil);
      setPage(output); setResultKey(key); setState('ready');
    } catch { if (current()) { setPage(null); setSelected(null); setState('unavailable'); } }
    finally { if (owner.current === transport) busy.current = false; }
  }
  const shown = resultKey === selectionKey ? page : null, chosen = shown ? selected : null;
  const contentExpiry = shown && Date.parse(shown.useUntil) < Date.parse(expiresAt) ? shown.useUntil : expiresAt;
  return <section aria-label="Retained agent run history" className="intent-run-history access-note">
    <h4>Agent runs across this draft’s revisions</h4>
    <p>Draft <code>{draftId}</code>. Find recorded scope reviews and drafting runs without loading them into your editor or starting new work.</p>
    <button type="button" className="access-secondary" disabled={locked || state === 'reading' || state === 'closed'} onClick={() => { void find(); }}>Find retained agent runs</button>
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
    {chosen?.kind === 'development' && <DevelopmentHistory key={`development:${chosen.operationId}`} input={{ ...scope, operationId: chosen.operationId, inputDigest: chosen.inputDigest }}
      original={{ input: { ...scope, draftId, ...chosen.source } }} currentSource={currentSource} identity={identity} expiresAt={contentExpiry} />}
    {chosen?.kind === 'scope' && <ScopeHistory key={`scope:${chosen.reviewId}`} input={{ ...scope, reviewId: chosen.reviewId, preparationDigest: chosen.preparationDigest }}
      subject={subject} identity={identity} expiresAt={contentExpiry} contextKey={selectionKey} draftId={draftId} revision={chosen.source.revision} revisionDigest={chosen.source.revisionDigest} />}
  </section>;
}
