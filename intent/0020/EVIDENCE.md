# Development evidence

Verified on 2026-09-05 UTC under Node 24.20.0 against parent candidate
`cf07cde64c5d9e907a41cf19595fbd0553093425` plus this increment.

- `npm exec --yes --package=node@24.20.0 -- pnpm test:auth:browser`: exit 0,
  15 groups (six provider plus nine Chromium) against Keycloak 26.7.3 and real
  encrypted PostgreSQL. Chromium 151.0.7922.34 retained its isolated profile,
  sandbox and exact-generated-key TLS exception with unrelated-certificate denial.
- Actual browser sessions used the production Git resolver and new explicit API
  composition. Temporary local Git commits revoked/restored synthetic membership;
  missing, duplicate and cross-organization records/documents denied. Injected
  source outage, head movement and digest failure returned 401 without fallback.
  Repaired source returned 200 while the session remained valid. Existing native
  login, secure cookie, CSRF, reconstruction, replay and logout checks passed.
- `npm exec --yes --package=node@24.20.0 -- pnpm --filter @steer/api test`:
  exit 0, 19 tests. New bearer test covers the same commit/fault path, ignored
  resolver override, invalid startup paths and unchanged 503 readiness.
- `npm exec --yes --package=node@24.20.0 -- pnpm test:auth:integration`:
  exit 0, all 13 assembled HTTP/provider/storage groups passed.
- `npm exec --yes --package=node@24.20.0 -- pnpm check`: exit 0. Kit/scope
  validation, typechecks, 88 prototype tests, 20 controls, workspace suites and
  builds passed. Unchanged packages used local Turbo cache; API/adapters checks
  executed against the changed sources. No dependency or lockfile change.

The harness confirmed cleanup of its owned browser, HTTPS servers, database and
Keycloak containers and generated temporary data, including the synthetic Git
repository. No real GitHub key, identity, membership or provider account was
accessed or changed. Synthetic Git reads do not re-prove the live GitHub transport
or configure a real organization. No production UI/ingress, deployment, spending,
protected Exam edit or gate approval is claimed.
