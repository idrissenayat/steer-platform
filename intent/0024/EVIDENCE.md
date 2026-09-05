# Development evidence

Verified on 2026-09-05 UTC under Node 24.20.0 against parent
`e5e271f3f379e14996ec63ce9c781906e21a454d` plus this increment.

- `npm exec --yes --package=node@24.20.0 -- pnpm check`: exit 0. Kit/scope
  checks, typechecks, 88 prototype tests, 20 controls, workspace tests and builds
  passed. The changed API checks executed; unchanged packages used local Turbo
  cache. No package dependency, boundary rule or lockfile change.
- Four new unit groups verify resource binding rejection, running-but-unready,
  shared truthful shutdown, request denial/no cookies, resource cleanup finishing
  before an active handler, and sanitized failure with no implicit retry.
- `npm exec --yes --package=node@24.20.0 -- pnpm test:auth:browser`: exit 0,
  all 16 groups passed. Actual Chromium/Keycloak login, Git-backed synthetic
  membership, encrypted PostgreSQL and reconstructed instances ran through the
  new service factory. At the end, all service instances reported stopped with
  zero active requests; browser tool fetch returned 503, creating a fresh runtime
  store failed, and the separate admin inspector observed zero auth rows.
- Chromium remained 151.0.7922.34 with the existing fresh-profile/scoped-TLS
  setup; no real user profile, public certificate or production UI is implied.
- `npm exec --yes --package=node@24.20.0 -- pnpm test:auth:integration`:
  exit 0, all 13 assembled provider/storage groups passed after the shared fixture
  changes. Original callback/cryptographic/storage rejection cases remain valid.

Harnesses confirmed closure of owned browser/HTTPS servers, synthetic runtime
pools, temporary PostgreSQL/Keycloak containers and generated credentials/data.
Runtime shutdown does not delete the database; the separate test harness removes
its own disposable resources afterward. No real credential, account, membership,
database or deployment setting was accessed or changed. `git diff --check` passed.

This proves explicit lifecycle composition, not validated public bootstrap,
production TLS/ingress, total network/transaction budgets, production Next.js UI,
manual accessibility, protected Exam or formal gate acceptance.
