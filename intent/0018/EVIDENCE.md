# Development evidence

Verified on 2026-09-05 UTC under Node 24.20.0, from parent candidate
`ee3f1f45d9d5a11053b796c7b24140f4b0fd6aa2` plus this increment.

- `npm exec --yes --package=node@24.20.0 -- pnpm test:auth:integration`: exit 0;
  13 real provider/storage groups with pinned Keycloak 26.7.3 and PostgreSQL
  16.14. The actual password/code flow now stores encrypted transactions and
  sessions through the production data package. Two callback requests across
  independent app/store instances returned 303 and 400 with exactly one token
  exchange. Wrong-key reconstruction denied; correct-key reconstruction recovered
  the context; logout denied both original and reconstructed instances.
- Raw JSON inspection confirmed an authenticated envelope, not plaintext
  access-token, subject or organization values. The four existing Drizzle
  migrations applied to the disposable database, and runtime operations used
  separate non-elevated `steer_auth_runtime` connections.
- `npm exec --yes --package=node@24.20.0 -- pnpm test:identity:integration`:
  exit 0; all original 12 provider-only groups passed after fixture refactoring.
- `pnpm install --frozen-lockfile --ignore-scripts`: exit 0. Added only API test
  dependencies at versions already present in the workspace; no new package
  downloads or lifecycle scripts. Production package dependencies did not change.
- `npm exec --yes --package=node@24.20.0 -- pnpm check`: exit 0; kit/workflow
  audit, typechecks, prototype/control/workspace suites and builds passed.
  Unchanged packages use local Turbo cache. The import guard additionally rejects
  production-to-own-test relative imports, preserving test-only fixture isolation.
- Both integration modes confirmed exact-run container/TLS/temp cleanup. The
  combined run closed its pools and removed only the generated PostgreSQL tmpfs
  database and Keycloak test resources. `git diff --check` was clean.

No existing database, provider credentials, GitHub keys, real memberships,
production migrations, deployed route, spending, release, Exam changes or gate
signatures were involved. The grant resolver remains synthetic. Hono runs
in-process and Keycloak uses a scoped HTTPS form driver; this is not browser
cookie/TLS-policy evidence or an OS-process restart. Those boundaries and
approved runtime membership/configuration remain required next.
