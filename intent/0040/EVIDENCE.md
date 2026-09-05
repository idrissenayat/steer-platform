# Development evidence

Baseline 762b57eb79392e56621fb5888b0de09758216e9f plus this increment,
2026-09-05 UTC. No gate approval is claimed.

Two new managed-client test groups cover eight-operation admission, pending
dispatch, repeated shutdown, failed initialization cleanup and failed closure.
Two API runtime groups cover explicit pairing, mismatched scope/limits, ownership
and failure cleanup. One service group covers browser-only request drain when
scheduling is enabled. The actual Temporal suite adds a distinct owned client
connection composed into the identity runtime and verifies closure separately
from the environment's still-working connection/server.

The runtime's database pools in that new connection test are intentionally lazy;
no database operation or real OIDC request is claimed by that test. Existing
Git/PostgreSQL/process-recovery groups provide separate regression evidence.
No credentials, protected Exam, signed architecture, live provider permission,
production data, deployment, release, spending or formal gate changes.

## Verification

- pnpm check: exit 0 on Node 24.20.0. Kit/scope/package checks, typechecks,
  88 prototype, 22 controls, 66 API, 57 adapter, 15 registry, 14 data, 5 web and
  15 worker tests plus builds passed. Changed tests executed; unchanged verified
  tasks used the local Turbo cache. No dependency or lockfile changes.
- pnpm test:workflow:integration: exit 0, twelve groups on checksum-verified
  Temporal CLI 1.8.3 / Server 1.31.2, Darwin ARM64. A separate real connection
  reads a retained execution, transfers ownership to the actual identity runtime,
  closes exactly once, and rejects subsequent direct SDK use. The environment's
  independent connection still reads the completed execution. Existing actual
  Git/PostgreSQL and process-SIGKILL/revocation groups pass again.
- pnpm test:auth:browser: exit 0, 25 counted groups plus inventory checkpoint
  using freshly built Next.js, actual isolated HTTPS/Keycloak 26.7.3,
  Chromium 151.0.7922.34 and PostgreSQL. Session/login, MCP/projection reads,
  source revocation, responsive/keyboard/automated accessibility and owned
  shutdown regression pass. No manual accessibility review is claimed.
- git diff --check passed. Updated runtime guide, delivery ledger, overview and
  component capability record preserve remaining production/gate limits.

Commands use npm exec --yes --package=node@24.20.0 -- before pnpm. Only owned
test services, generated fixtures and disposable PostgreSQL/container data are
closed/removed. The new connection test uses generated RSA/session material,
no provider call and zero database connections. This does not prove live cluster
TLS/ACLs, combined real OIDC-to-Temporal dispatch or human gate/accessibility review.
