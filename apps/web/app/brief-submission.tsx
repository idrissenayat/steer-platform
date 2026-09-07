import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createBriefSubmissionClient, type SubmissionState } from './brief-submit-client';
import { briefReceiptFragment } from './brief-location';
import { saveStatusMessages } from './brief-review-client';

/** Client child of the authoring boundary; callbacks are never server-component props. */
export default function BriefSubmission({ organizationId, subject, expiresAt, render }: {
  organizationId: string; subject: string; expiresAt: string;
  render: (submit: (value: Parameters<ReturnType<typeof createBriefSubmissionClient>['submit']>[0]) => void, attempted: boolean) => ReactNode;
}) {
  const [state, setState] = useState<SubmissionState>({ kind: 'idle' }), [attempted, setAttempted] = useState(false);
  const owner = useRef<ReturnType<typeof createBriefSubmissionClient> | null>(null);
  useEffect(() => {
    const create = () => createBriefSubmissionClient({ organizationId, subject, expiresAt }, window.location.origin, setState);
    let current = create(), paused = false, terminal = false; owner.current = current;
    const clear = (permanent: boolean) => {
      const sent = current.attempted(); current.close(); paused = true; terminal ||= permanent || sent;
      setState(sent ? { kind: 'expired' } : { kind: 'idle' }); setAttempted(terminal);
    };
    const hide = () => {
      if (document.hidden) clear(false);
      else if (paused && !terminal && Date.parse(expiresAt) > Date.now()) { current = create(); owner.current = current; paused = false; }
    };
    const leave = () => clear(true);
    const timer = setTimeout(leave, Math.max(0, Date.parse(expiresAt) - Date.now()));
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', leave);
    return () => { current.close(); if (owner.current === current) owner.current = null; clearTimeout(timer);
      document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', leave); };
  }, [organizationId, subject, expiresAt]);
  const submit = (value: Parameters<ReturnType<typeof createBriefSubmissionClient>['submit']>[0]) => {
    if (document.hidden || Date.parse(expiresAt) <= Date.now()) return;
    const current = owner.current; if (!current) return;
    void current.submit(value, true); setAttempted(current.attempted());
  };
  const reference = 'reference' in state ? state.reference : null;
  const result = state.kind === 'observed' ? state.value.result : null;
  const link = state.kind === 'observed' ? briefReceiptFragment(state.value) : null;
  const message = state.kind === 'observed' ? (result?.outcome === 'committed' ? 'This reviewed Brief was recorded. No gate was signed.' : saveStatusMessages[result!.outcome]) :
    ({ idle: '', submitting: 'Submitting this operation once…', checking: 'Checking the same operation with current access…',
      unknown: 'Save outcome is unverified. Do not submit again. Check this operation with current access.',
      expired: 'Submission details cleared. Any dispatched operation may still have completed. Use its original operation ID to check status after refreshing access.' })[state.kind];
  return <>{render(submit, attempted)}{state.kind !== 'idle' && <section className="brief-submission" aria-label="This save operation" aria-busy={state.kind === 'submitting' || state.kind === 'checking'}>
    <h4>This save operation</h4><p role="status" data-testid="submission-status">{message}</p>
    {reference && <><dl className="save-receipt"><div><dt>Operation ID — keep for recovery</dt><dd><code data-testid="submission-operation">{reference.idempotencyKey}</code></dd></div>
      <div><dt>Original Brief path</dt><dd><code>{reference.path}</code></dd></div></dl>
      <p className="access-hint">Keep this ID before leaving or hiding the page. There is no automatic retry and nothing is stored in this browser. Editing the draft does not change this operation.</p>
      <button type="button" className="access-secondary" disabled={state.kind === 'submitting' || state.kind === 'checking'} onClick={() => {
        if (!document.hidden && Date.parse(expiresAt) > Date.now()) void owner.current?.check();
      }}>Check this operation</button></>}
    {result?.outcome === 'committed' && <dl className="save-receipt" data-testid="submission-receipt"><div><dt>Recorded revision</dt><dd><code>{result.revision}</code></dd></div>
      <div><dt>Content SHA-256</dt><dd><code>{result.contentDigest}</code></dd></div></dl>}
    {link && <a className="session-refresh" href={link} data-submission-receipt-link>Read the recorded Brief</a>}
  </section>}</>;
}
