# Development evidence

Verified 2026-09-05 UTC under Node 24.20.0 against parent
1f0c031149135dfb52296d6694fd8d6e1f3b8670 plus this increment.

## New behavior

Three registry groups cover pre-I/O schema/grant/scope denial, post-I/O identity,
revocation/expiry/clock checks, missing services and sanitized output/failures.
Two data groups cover pre-acquisition scope, exact login role, missing/stale rows,
strict output identity and SHA-256/Git-blob integrity. Two API groups cover actual
async HTTP response suppression after revocation and explicit separate read-pool
configuration/lifecycle. No authority is derived from a cached business artifact.

## Integration and regression

- pnpm test:auth:browser: exit 0, 23 groups. Actual Next.js build, Chromium
  151.0.7922.34, Keycloak 26.7.3, isolated HTTPS and PostgreSQL. New flow commits
  synthetic content to Git, runs existing single-artifact reconciliation/ingestion,
  and reads it through the authenticated browser API. Foreign org/path, missing
  revision and Git-committed grant removal deny; restored explicit grant works.
- pnpm test:data:integration: exit 0, 27 groups on PostgreSQL 16.14. New adapter
  check exercises read-only role, organization RLS, exact revision, corrupt cache
  rejection and source-based repair of an owned synthetic row. Existing timeout,
  pool reuse, encryption, failure and shutdown groups remain passing.
- pnpm check: exit 0 after correcting a test's omitted optional-property shape
  for exactOptionalPropertyTypes. Kit/scope/typechecks, 88 prototype tests,
  21 controls, 10 registry, 42 adapter, 14 data, 54 API and 5 web tests, and builds
  passed. Changed registry/data/API checks executed; unchanged web/domain checks
  used Turbo cache. Browser command separately rebuilt actual Next.js.
- git diff --check: passed. No UI source changed and no new visual review claimed.

Commands used npm exec --yes --package=node@24.20.0 -- before pnpm. All integration
resources were isolated and run-owned; each harness confirmed cleanup of only
its synthetic containers/tmpfs, listeners, browser/processes and generated files.
No real runtime App key, user membership, provider secret or production database
was accessed or changed by this increment.

## Boundaries

Cache hash checks establish byte self-consistency, not independently verified
commit membership, current HEAD, signatures or defense against a coherently
forged database row. Git remains authoritative. This is one curated read tool
and single-path integration, not full-repository replay, durable ingestion,
production screens, a readiness claim or a completed Phase 1 walking skeleton.
Runtime configuration is opt-in/lazy; no live service was activated. No signed
snapshot, protected Exam, dependency version or package boundary was changed.
No gate, deployment, release, spending or governed-write approval is implied.
