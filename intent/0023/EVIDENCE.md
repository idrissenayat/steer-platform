# Development evidence

Verified on 2026-09-05 UTC under Node 24.20.0 against parent
`f2b05ae82b60ef0d93b342d3b8cae86ff1260851` plus this increment.

- `npm exec --yes --package=node@24.20.0 -- pnpm test:data:integration`:
  exit 0, all 26 PostgreSQL 16.14 groups passed. Three new groups prove exact
  checked-out backend failure/replacement, graceful shutdown with denied new
  admission, and forced shutdown of a connection with a lost COMMIT reply.
- The fault relay forwarded a synthetic insert and COMMIT while dropping server
  replies. A separate test/admin query observed exactly one committed row while
  STEER's request remained pending. Explicit shutdown completed within the
  eight-second test bound (five-second grace), evicted one lease and left zero
  active/pooled connections. The caller received
  `DatabaseCommitOutcomeUnknownError`, and its operation callback ran once.
  This is actual acknowledgement-loss evidence, not a simulated failed query or
  proof that the write rolled back. Only the test observer knew it had committed.
- The normal drain check kept an existing lease usable, denied new acquisition,
  did not resolve prematurely, and finished without any forced release. Repeated
  shutdown calls shared their actual completion promise.
- `npm exec --yes --package=node@24.20.0 -- pnpm check`: exit 0. Kit/scope
  validation, typechecks, 88 prototype tests, 20 controls, workspace tests and
  builds passed. Changed data/API work executed; unchanged packages used local
  Turbo cache. Unit checks preserve confirmed-COMMIT cleanup semantics and
  distinguish unconfirmed COMMIT without replay. No dependency/lockfile change.
- `npm exec --yes --package=node@24.20.0 -- pnpm test:auth:browser`: exit 0,
  all 15 real-provider/Chromium groups passed with the changed pool. Keycloak,
  encrypted session storage, Git-backed synthetic authority, cookie/CSRF/replay,
  reconstruction and logout remained valid.

The relay kept protocol bytes only in memory, with no logs or capture. It and
its sockets were closed. Harness cleanup confirmed removal of owned temporary
containers/tmpfs and browser/HTTPS/generated credential data. Exact backend
termination and the committed marker affected only this run's synthetic database.
No real credentials, database connections, memberships, source records or
deployment settings were used or changed. `git diff --check` passed.

Public TLS, proactive network-failure detection, total transaction budgets,
complete service lifecycle wiring, production deployment, spending, protected
Exam incorporation and formal gate approval remain separate and unclaimed.
