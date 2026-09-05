# Development evidence

Verified 2026-09-05 UTC against parent
1c59cf4f680a95a22d833b05c8b95f371b8936e0 plus this development increment.
This is Builder evidence, not an independent protected Exam or gate approval.

Node 24.20.0: API typecheck and all 63 API tests passed. Two new groups cover
explicit mounting/credential separation and combined request/resource drain;
existing runtime and gateway tests now cover optional MCP routing/configuration.

## Actual combined integration

pnpm test:auth:browser exited 0: 25 counted groups plus the inventory fixture
checkpoint. Official MCP client 2.0.0 uses an actual Keycloak 26.7.3 agent token
through the same production-source HTTPS listener, gateway and identity service
used by the human Chromium/Next.js flow. It reads an artifact ingested into actual
PostgreSQL 16.14 and compares bytes with the pinned local Git source. Foreign
tenant and cookie-plus-bearer deny. Committed agent revocation denies; restoring
the grant permits the later query. Human login/context/artifact/logout checks
still pass, followed by combined service/resource and listener shutdown.

The source is an isolated synthetic Git repository, not the live GitHub adapter's
network binding. Runtime factory wiring is separately tested through actual local
HTTPS with provider requests forbidden, proving optional mounting, lazy pools and
shutdown without claiming live provider access. The combined drain unit test holds
an admitted browser transaction while asserting shared resources remain open;
0034's endpoint test independently holds eight actual MCP calls through shutdown.
No fault-injected SDK cleanup failure or new manual visual audit is claimed.

## Full verification and boundaries

- pnpm check: exit 0; kit/scope validation, typechecks, 88 prototype, 21 controls,
  63 API, 54 adapter, 10 registry, 14 data and 5 web tests, and builds passed.
  Changed API tasks executed; unchanged packages used local Turbo cache. The
  browser command separately rebuilt Next.js and exercised actual Chromium.
- git diff --check passed. No dependency or lockfile change was required.
- Commands used npm exec --yes --package=node@24.20.0 -- before pnpm.

The harness cleaned only its owned disposable browser/listeners, PostgreSQL and
Keycloak containers/tmpfs and generated test credentials. No real App key,
production database or provider account was accessed. No signed architecture or
protected Exam changed. OAuth onboarding, Temporal workflows, full operating
surfaces, real runtime bindings and five R5 findings remain open. No spending,
deployment, release, governed write or gate approval occurred.
