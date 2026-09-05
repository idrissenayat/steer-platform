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

## Ephemeral authentication storage

`@steer/data/browser-session` implements the shared server session contract with
AES-256-GCM, an explicit secret-provider keyring, five-minute maximum TTL,
bounded capacity and atomic one-use login consumption. Separate `steer_auth`
tables use forced RLS scoped to the trusted identity binding, not a pre-auth
user-supplied organization. Provision `steer_auth_runtime` separately with
NOINHERIT and no elevated/ownership privileges before migrations 0002/0003.
The harness alone provisions that role in its disposable database.

No browser route, production connection or encryption key is configured here.
Expired-row reclamation affects only short-lived auth rows, not Git records.
Cold expired rows remain until a later insert or an approved operational purge;
expiry immediately denies authentication regardless. See `intent/0015/SPEC.md`
for boundaries, capacity/keyring configuration and remaining operational work.

From the workspace root, `pnpm test:auth:integration` combines this production
store with the real disposable Keycloak human-code/HTTP flow. See `intent/0018`
for exactly-once callback, ciphertext, app/store reconstruction and logout
evidence. It never selects an existing database or real encryption key.

Later increments must connect the authoritative Git ingestion, reconciliation,
grant-freshness checks, rebuild/replay, operational queues and API tools. This
package alone does not establish any of those workflows or gate authority.
