'use client';

import { useEffect, useRef, useState } from 'react';
import type { AgentOutput } from '@steer/tool-registry/agent-contracts';
import { createAgentTransport } from './agent-transport';
import BriefMarkdown from './brief-markdown';

export default function IntentConversation({ organizationId, subject, expiresAt, enabled }: {
  organizationId: string; subject: string; expiresAt: string; enabled: boolean;
}) {
  const [intent, setIntent] = useState(''); const [clarification, setClarification] = useState('');
  const [result, setResult] = useState<AgentOutput | null>(null); const [error, setError] = useState('');
  const [busy, setBusy] = useState(false); const [expired, setExpired] = useState(false);
  const [selected, setSelected] = useState<'brief' | 'spec' | 'exam'>('brief');
  const transport = useRef<ReturnType<typeof createAgentTransport> | null>(null);
  const live = useRef(true); const pending = useRef(false);
  useEffect(() => {
    live.current = true; let last = Date.now();
    transport.current = createAgentTransport(window.location.origin);
    const expire = () => {
      live.current = false; transport.current?.close(); setExpired(true); setBusy(false);
      setIntent(''); setClarification(''); setResult(null); setError('');
    };
    const check = () => { const now = Date.now(); if (now < last || now >= Date.parse(expiresAt)) expire(); last = now; };
    const timer = setInterval(check, 1000); check();
    const hide = () => { if (document.visibilityState === 'hidden') expire(); };
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', expire);
    return () => { live.current = false; clearInterval(timer); transport.current?.close(); document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', expire); };
  }, [expiresAt]);
  async function send() {
    if (pending.current || !live.current || !enabled || !intent.trim()) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const output = await transport.current!.develop({ organizationId, intent, clarification });
      if (!live.current) return;
      if (output.organizationId !== organizationId || output.subject !== subject || Date.now() >= Date.parse(expiresAt)) throw new Error('Workspace access changed. Refresh access before continuing.');
      setResult(output); setSelected('brief');
    } catch (cause) { if (live.current) setError(cause instanceof Error && cause.message.length < 300 && !cause.message.startsWith('[')
      ? cause.message : 'The agent could not finish. Your text is still here. Nothing was saved.'); }
    finally { pending.current = false; if (live.current) setBusy(false); }
  }
  return <section className="intent-conversation access-card" aria-labelledby="intent-conversation-title">
    <div className="eyebrow">Start with intent</div><h2 id="intent-conversation-title">What would you like to change?</h2>
    <p>Describe the problem, idea, or outcome in your own words. The agent will review it, ask only what’s needed, then draft your Brief, Spec, and Exam.</p>
    {!enabled && <p className="access-note" role="status">Live agent setup is pending. Model usage needs an approved budget and an enabled connection before you can send your intent.</p>}
    {expired ? <p role="alert">This conversation was cleared when the session expired or the page was hidden. <a href="/">Refresh access</a> to continue.</p> : <>
      <form onSubmit={event => { event.preventDefault(); void send(); }}>
        <label htmlFor="agent-intent">Your intent</label>
        <textarea id="agent-intent" rows={7} maxLength={10000} value={intent} disabled={busy}
          placeholder="I want to…" onChange={event => { setIntent(event.target.value); setResult(null); setClarification(''); }} />
        {result && <div className="intent-agent-reply"><h3>STEER agent</h3><p>{result.message}</p>
          {result.questions.length > 0 && <><ul>{result.questions.map((question, index) => <li key={index}>{question}</li>)}</ul>
            <label htmlFor="agent-clarification">Add details in your own words</label>
            <textarea id="agent-clarification" rows={4} maxLength={3000} value={clarification} disabled={busy} onChange={event => setClarification(event.target.value)} /></>}
        </div>}
        <p className="access-hint">Not saved. Hiding or refreshing the page clears this conversation. Sending uses the configured model provider.</p>
        <button className="access-primary" type="submit" disabled={!enabled || busy || !intent.trim() || Boolean(result?.documents) || Boolean(result?.questions.length && !clarification.trim())}>
          {busy ? 'Agent is working…' : result?.questions.length ? 'Continue with these details' : 'Review my intent'}</button>
      </form>
      {busy && <p role="status">Reviewing your intent and preparing the next response. This can take up to 90 seconds. Please keep this page open.</p>}
      {error && <p role="alert" className="access-note">{error}</p>}
      {result?.documents && <div className="intent-documents"><h3>Your draft documents</h3>
        <p>Generated candidates · not saved to GitHub · no gate signed · tests not run</p>
        <div className="intent-document-buttons" aria-label="Choose a draft document">{(['brief', 'spec', 'exam'] as const).map(name =>
          <button key={name} type="button" className="access-secondary" aria-pressed={selected === name} onClick={() => setSelected(name)}>{name.toUpperCase()}.md</button>)}</div>
        <BriefMarkdown content={result.documents[selected]} />
        <p className="access-hint">The Exam was drafted in a separate Test Agent context. These documents still need review and authorized repository saving.</p>
      </div>}
    </>}
  </section>;
}
