# Development evidence

Verified on 2026-09-05 UTC under Node 24.20.0 against parent
`8526cf3ba4e9c5a7a1c8808e0b2fa69476d0d9d5` plus this increment.

- `pnpm install --frozen-lockfile --ignore-scripts`: exit 0. The lockfile only
  moves the existing workspace data package to API production dependencies and
  declares existing Zod 4.5.4 there. No package versions or dependency-age policy
  changed; `pnpm-workspace.yaml` is untouched.
- Root Node 24 `pnpm check` passed: kit/scope validation, typechecks, 88 prototype
  tests, 21 controls, workspace suites and builds. API has 32 passing tests,
  including two new bootstrap groups. Exact-file controls allow data/Zod imports
  only in `src/runtime.ts`, rejecting them in other API production files.
- Bootstrap unit checks constructed real adapters/resources without a provider
  call or database connection, retained 503 readiness and 401 unauthenticated
  tools, and verified stopped/closed state. Malformed public/secret fields, unsafe
  downstream URLs/paths/roles/keys and extra fields rejected with generic errors.
- `npm exec --yes --package=node@24.20.0 -- pnpm test:auth:browser`: exit 0,
  all 17 groups passed. The new bootstrap group constructed actual components
  with generated secrets, used the real bounded PostgreSQL pool and encrypted
  store, POSTed login and observed one pending encrypted transaction. The
  separate matching-key store read/consumed it, then bootstrap shutdown reported
  stopped with zero DB connections. Provider transports were explicitly blocked
  and their call count stayed zero for this bootstrap group.
- The subsequent real Chromium/Keycloak/Git-fixture/session flow and service
  shutdown passed unchanged. The new bootstrap test does not substitute its
  synthetic App identity for the separately verified live runtime App binding.
- `npm exec --yes --package=node@24.20.0 -- pnpm test:auth:integration`:
  exit 0, all 13 assembled provider/storage groups passed after shared fixture edits.

Only owned disposable services and generated credentials were used. Harnesses
confirmed closure/removal of their browser, HTTPS servers, runtime pools,
PostgreSQL/Keycloak containers and temporary test data. No real secret was read,
no real provider access was added, and no membership or deployment changed.
`git diff --check` passed. Signed architecture/gate snapshots were not edited.

Trusted listener/secret loading, production TLS/ingress, real membership, full
bootstrap-to-GitHub integration, production UI, independent review and formal
gate/deployment/spending authorization remain explicitly unclaimed.
