import { connection } from 'next/server';
import { identityView } from './identity-view';

export default async function FoundationPage() {
  await connection();
  const configured = identityView(process.env.STEER_WEB_AUTH, process.env.STEER_WEB_AUTH_ORIGIN, process.env.STEER_WEB_IDENTITY_ISSUER);
  return (
    <main className="access-shell">
      <header className="access-brand"><span className="brand-mark" aria-hidden="true">S</span><span>STEER</span><span className="brand-caption">Human direction. Agent execution.</span></header>
      <div className="access-grid">
        <section className="access-intro" aria-labelledby="access-title">
          <div className="eyebrow">Your operating space</div>
          <h1 id="access-title">Good work starts<br />with intent.</h1>
          <p className="lede">Bring the direction. Let your agents do the work. Keep the decisions that matter in human hands.</p>
          <ol className="access-principles">
            <li><span aria-hidden="true">01</span><div><strong>Set the intent</strong><p>Make the outcome and boundaries clear.</p></div></li>
            <li><span aria-hidden="true">02</span><div><strong>Steer the work</strong><p>People and agents use one governed process.</p></div></li>
            <li><span aria-hidden="true">03</span><div><strong>Trust the evidence</strong><p>Every approval belongs to an accountable human.</p></div></li>
          </ol>
        </section>
        <section className="access-card" aria-labelledby="sign-in-title">
          <span className="access-label">WORKSPACE ACCESS</span>
          <h2 id="sign-in-title">Welcome to STEER.</h2>
          <p>Sign in through your organization. Your current workspace permissions are verified separately.</p>
          {configured ? <>
            <form action="/auth/login" method="post"><button className="access-primary" type="submit">Sign in</button></form>
            <p className="access-hint">You’ll continue to your identity provider. STEER never asks for your password here.</p>
            <div className="access-divider" />
            <h3>Already using this browser?</h3>
            <p className="access-hint">End your STEER session on this device. This does not sign you out of your identity provider.</p>
            <form action="/auth/logout" method="post"><button className="access-secondary" type="submit">Sign out</button></form>
          </> : <>
            <button className="access-primary" type="button" disabled aria-describedby="configuration-note">Sign in</button>
            <p id="configuration-note" className="access-hint">Sign-in is not configured for this workspace. No account access is enabled.</p>
          </>}
          <div className="access-note"><strong>Foundation preview</strong><p>This is the production sign-in surface in development. Workspace features and formal release gates are still in progress.</p></div>
        </section>
      </div>
      <footer className="access-footer"><span>Intent → evidence → human decision</span><a href="https://github.com/idrissenayat/steer-platform">Project repository</a></footer>
    </main>
  );
}
