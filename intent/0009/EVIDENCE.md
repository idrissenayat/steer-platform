# 0009 development evidence

Date: 2026-09-04 (America/New_York). Baseline: `ef34aec`.
This record covers source in the same delivery commit, not an independent Exam.

## Observed verification

- Five data unit tests passed: invalid/expired identity, transaction-local
  parameterization and release, unsafe-role/rollback-failure destruction, and
  expiry during pool acquisition, and confirmed-commit cleanup semantics.
- Eight real PostgreSQL integration checks passed after the final code change:
  migration replay, forced RLS/policy coverage, no-context denial, tenant
  isolation on a deliberately contaminated/reused connection, cross-tenant write/move denial, runtime
  privileges, rollback plus concurrent callers, and admin/expired refusal.
- Observed server: PostgreSQL 16.14. Image:
  `postgres@sha256:16bc17c64a573ef34162af9298258d1aec548232985b33ed7b1eac33ba35c229`.
  Its role/bootstrap credentials and data were generated synthetic test data.
  The harness stopped and removed its exact run-owned container and tmpfs data.
- The first startup probe initially hit PostgreSQL's temporary initialization
  socket; the test correctly failed. The probe now checks TCP readiness and
  subsequent full runs passed. The failed container was also cleaned up.
- Drizzle generation after migrations reported no schema changes. The custom
  FORCE RLS/runtime grants migration remains explicit and tracked in the journal.
- Frozen install and root `pnpm check` passed, including the existing prototype,
  controls, registry, adapter/API and web tests, new data tests, typechecks and
  builds. Typechecks and workspace tests ran uncached in that root run;
  dependency builds reused entries produced earlier in the same run. The
  subsequent pool-hardening changes passed focused typechecks, unit tests and
  the full real PostgreSQL integration again.
- `pnpm audit --prod --audit-level high`: no known vulnerabilities found at
  verification time. This is a registry audit, not a full security review.

## Dependencies and boundaries

Pinned Drizzle ORM 0.45.2, Drizzle Kit 0.31.10, pg 8.23.0 and @types/pg 8.23.1.
pnpm 11 required explicit `allowBuilds.esbuild: true` for Drizzle's transpiler;
this carries forward the repository's existing esbuild-only build permission.
The existing unrelated build allowlist entries were preserved. No minimum
release-age exemption was added. Drizzle Kit reports deprecated esbuild-kit
transitive development dependencies; these are not runtime service code.

Regular root checks deliberately do not pretend to run Docker integration.
Use `pnpm test:data:integration` for the separately observed database test.
Hosted CI integration and Node 24 verification remain pending. Runtime here is
Node 25.9.0. The pinned local test image is not a deployment/security approval.

No production database was connected, migrated, populated or deleted. No
deployment, provider write, spending or gate signature occurred. Docker Desktop
was started for local testing; other containers/volumes were not modified by
the harness. Actual Git ingestion, authorization projection and browser login
are still to be connected. Gate 2 R5 findings remain open.

References: [PostgreSQL row security](https://www.postgresql.org/docs/16/ddl-rowsecurity.html),
[Drizzle RLS](https://orm.drizzle.team/docs/rls),
[Drizzle migrations](https://orm.drizzle.team/docs/migrations).
