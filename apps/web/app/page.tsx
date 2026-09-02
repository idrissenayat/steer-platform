const foundations = [
  "Git-authoritative operations",
  "Tenant isolation from the first record",
  "One tool surface for humans and agents",
  "Durable workflows and rebuildable projections",
];

export default function FoundationPage() {
  return (
    <main className="foundation-shell">
      <section className="foundation-card" aria-labelledby="foundation-title">
        <div className="eyebrow">Phase 1 · Foundation</div>
        <h1 id="foundation-title">A clean production path for STEER.</h1>
        <p className="lede">
          This Next.js shell is the first production workspace boundary. The
          fixture-backed product remains a separate prototype until experience
          parity and the architecture exam are signed.
        </p>
        <ul className="foundation-list">
          {foundations.map((foundation) => (
            <li key={foundation}>{foundation}</li>
          ))}
        </ul>
        <a className="focus-link" href="https://github.com/idrissenayat/steer-platform">
          View the authoritative repository
        </a>
      </section>
    </main>
  );
}
