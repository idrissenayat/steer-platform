# Development evidence

Baseline 3d6f4988030d291659a10c4dafe48bacadc066c6 plus this increment,
2026-09-05 UTC. Development verification passes. No approval is claimed.

Five new native registry groups cover bounded fixed scope, current authorization,
post-I/O revocation including reset outcomes, malformed/foreign/skipped outputs,
and exact large decimal/caught-up/empty/reset cases. Existing official MCP parity
tests include the new tool. Runtime tests cover explicit opt-in and shared-pool
shutdown. Synthetic data and credentials only; no live provider activation.

Verified on Node 24.20.0 and pnpm 11.19.0:

- `pnpm check`: exit 0, including kit/security controls, typechecks, tests and
  builds. Registry: 28 native groups passed; data: 16 passed.
- `pnpm test:auth:browser`: exit 0, 26 counted groups plus inventory. Real
  Keycloak 26.7.3/Chromium 151.0.7922.34; actual synthetic Git/PostgreSQL pages,
  cursor continuation/reset, wrong scope and Git-committed grant revocation.
  The actual MCP client also reads the four reference events. No new UI claimed.
- `pnpm test:data:integration`: exit 0, 31 groups, PostgreSQL 16.14.
- `pnpm test:workflow:integration`: exit 0, 18 groups, Temporal CLI 1.8.3/server
  1.31.2, actual Git/PostgreSQL and independent-process recovery.
- `pnpm install --frozen-lockfile`: exit 0, unchanged lock.

Only run-owned test services and generated test credentials/data were cleaned
up. Candidate commit/remote equality is verified in the task publication handoff.
The explicit runtime flag has initialization/ownership tests; real browser
verification composes the service with the same data reader, not a live profile.
