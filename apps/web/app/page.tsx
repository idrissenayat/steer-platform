import { connection } from 'next/server';
import BriefAuthor from './brief-author';
import IntentConversation from './intent-conversation';
import LearnHub from './learn-hub';
import learnCorpus from './generated/learn.json';
import type { LearnCorpus } from './learn-reader';

/** The actual workspace, temporarily single-user. No login or identity headers.
 * The owned server is bound to this computer only. */
export default async function FoundationPage() {
  await connection();
  const organizationId = 'steer-local-idrissenayat', subject = 'local-owner';
  return <main className="access-shell workspace-shell">
    <header className="access-brand"><span className="brand-mark" aria-hidden="true">S</span><span>STEER</span><span className="brand-caption">Human direction. Agent execution.</span></header>
    <div className="workspace-heading"><div><div className="eyebrow">Your operating space</div><h1>Your workspace.</h1>
      <p className="lede">One place to frame intent, steer the work, and review the evidence.</p></div></div>
    <p className="access-note">Single-user workspace · authentication is off. Available only on this computer. Anyone using this computer can open it.</p>
    <IntentConversation organizationId={organizationId} subject={subject} expiresAt={null} enabled={false} />
    <details className="workspace-diagnostics"><summary>Manual Brief tools</summary>
      <BriefAuthor organizationId={organizationId} subject={subject} expiresAt={null} submissionEnabled={false} />
    </details>
    <LearnHub corpus={learnCorpus as LearnCorpus} expiresAt={null} />
    <section className="workspace-surfaces" aria-labelledby="surfaces-title"><h2 id="surfaces-title">Your operating surfaces</h2>
      <p className="access-hint">The workspace opens directly. These work surfaces are still being built.</p>
      <ul>{[['Intent backlog', 'Frame outcomes and boundaries before work is pulled.'], ['Flight board', 'Follow work through its lifecycle and evidence gates.'], ['Inbox', 'Review the decisions that need your attention.']].map(([name, description]) =>
        <li key={name}><h3>{name}</h3><p>{description}</p><span>Not connected yet</span></li>)}</ul></section>
    <footer className="access-footer"><span>STEER · in development</span><a href="https://github.com/idrissenayat/steer-platform">Project repository</a></footer>
  </main>;
}
