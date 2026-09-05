# Tenant projection data

`schema.ts` and Drizzle migrations define rebuildable data, not authoritative
business state. `withTenant` acquires one connection, checks its runtime role,
sets tenant context transaction-locally, and commits or rolls back before pool
release. Callers must already have passed the shared tool authorization boundary.

No untrusted SQL is supported: a database principal that can execute arbitrary
SQL can change custom PostgreSQL settings. RLS protects normal parameterized
application queries and prevents accidental tenant omissions; it is not a
sandbox for hostile callbacks or stolen database credentials.

## Verification

- `pnpm --filter @steer/data test`: unit checks; no Docker needed.
- `pnpm test:data:integration`: starts a uniquely named, labeled, loopback-only
  PostgreSQL 16 container with tmpfs data and generated disposable credentials,
  applies Drizzle migrations, tests real isolation/privileges, and stops/removes
  only that container. No existing database, Docker volume or host data is used.
  Missing Docker or failed checks cause a nonzero exit, never a skipped pass.
- `pnpm --filter @steer/data db:generate`: reviews schema changes into migration
  files. The custom FORCE RLS/grant migration is not represented by Drizzle's
  table snapshot; preserve and extend its controls on future tables.

Roles `steer_app` and `steer_projector` must be separately provisioned without
superuser, bypass, role-management or table-ownership privileges before
migrations. The harness provisions them only inside its own test database.
No production migration or credential-loading command is provided here.

Later increments must connect the authoritative Git ingestion, reconciliation,
grant-freshness checks, rebuild/replay, operational queues and API tools. This
package alone does not establish any of those workflows or gate authority.
