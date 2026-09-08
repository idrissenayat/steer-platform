# Tenant projections and operational storage

Git-derived tables in `schema.ts` are rebuildable projections, not authoritative
business state. Authentication, usage and execution tables have separate operational
lifecycles; usage/execution records must never be discarded as a projection cache.
`withTenant` acquires one connection, checks its runtime role,
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

## Model budget reservations (uninstalled runtime binding)

`@steer/data/model-budget` provides a `DevelopmentPermit`-compatible adapter.
Migrations 0005/0006 add a separate `steer_usage` namespace with forced RLS and
append-only integer-micro-USD reservations. Unlike Git-derived projections, these
records are accounting controls and must not be discarded or rebuilt as a cache.
The runtime can read configured budgets and append reservations, but cannot
provision/activate/raise/reset budgets, refund reservations or delete/truncate them.
An explicit operator-provisioned row must match owner, configuration revision,
approval digest, cap and per-role worst-case reservation amounts. An approval digest
is a binding identifier, not an approval verifier; independent approval/provisioning
is still required. No real budget or model access is created by the migrations.

All adapter instances serialize each budget with a transaction advisory lock and
explicit READ COMMITTED isolation. A fresh atomic insert checks validity, activity,
matching limits and total reserved amounts. Each role's conservative upper bound
is consumed before a model call; failures and unknown commit acknowledgements never
refund or authorize retry. Unknown acknowledgement returns false even when a real
commit happened. Each budget also has a technical ceiling of 10,000 reservations.
No request/response content, credentials or model-generated approval is stored.

Provisioning must follow separate spending authorization and verified conservative
input/output/pricing bounds. This adapter is not yet installed in local API startup.
It is not provider billing reconciliation, duplicate-request idempotency or backup
acceptance. Restarting clients preserves the database counter; restoring a stale
backup or using independent database copies can regress accounting, so model access
must remain disabled during recovery until all reservations/provider usage are
reconciled. There is no automatic retention/deletion or replenishment job.

RLS protects trusted parameterized operations and reused connections, not arbitrary
SQL issued with stolen runtime credentials. The adapter is the serialized admission
path; no alternative code may append an unaccounted reservation or bypass it.

## Intent operation ownership (uninstalled runtime binding)

`@steer/data/intent-operations` adds server-minted operation IDs, immutable submission
bindings and one-way fenced role steps. Migrations 0007/0008 add `steer_execution`
with forced organization/subject RLS and link model reservations to unique
`(organization, operation, step)` keys. Apply these only in disposable harnesses
until the exact records/schema adoption and recovery requirements are satisfied.
The real local workspace's `migrate` command now refuses the expanded migration
set before private-state reads or database changes; `start` does not migrate.

The factory requires trusted `authorize` and `verifyCheckpoint` ports. Configuration
binds identity, product/repository/branch, action, revision, records-policy digest,
expiry and (for development) budget. Neither a digest nor this callback signature
supplies actual policy adoption, current source/lifecycle evidence or spending
authority. No production bootstrap installs the adapter.

- `create`: identical draft/revision/action/configuration submissions converge on
  one operation. Changed input/configuration conflicts; expired IDs never recreate.
- `inspect`: reads original operation/step metadata under current authorization;
  it never returns dispatch permission.
- `claim`: atomically claims Architect, Test Agent or candidate-save. Paid steps
  reserve their worst-case cost once using the same lock/cap as legacy permits.
  Pre-dispatch takeover reuses that reservation and increments the fencing token.
- `transition`: only the first unambiguously acknowledged `commit-dispatch` yields
  `dispatchAllowed: true`. Repeated calls, sent-state status and lost COMMIT
  acknowledgements never do. Checkpoints require exact persisted-result readback;
  Test Agent requires the verified Architect checkpoint and predecessor digest.
- `close`: stops admission/withholds late results; it does not undo external work.

Transactions use READ COMMITTED, restricted `steer_app`, connection-context
scrubbing and 5-second statement/1-second lock/5-second idle-transaction limits.
Authorization, pool acquisition and read-only checkpoint verification have 3-second
bounds; at most eight calls are admitted, with slots retained while timed-out
dependencies drain. SQL is never held across a model/provider call. Configuration
expires within 24 hours; claims last at most five minutes. Each organization/subject
has a technical limit of 10,000 operations, with no automatic purge or replenishment.

Only hashes, identifiers, status and result references are stored—not draft/model
bytes. Result encryption/storage and authorized retention are separate requirements.
The caller must dispatch only once on a fresh positive acknowledgement and recheck
action-time authority; these internal protocol results are not public tool grants.
Unknown outcomes remain blocked. Explicit linked new attempts, verified unknown
resolution, Scout/semantic/embedding roles, Temporal activity integration and the
actual GitHub dispatch-authority composition are not implemented by this adapter.
Stale-backup/copy recovery must withhold dispatch until accounting and external
effects are reconciled. This is at-most-one authorized dispatch under the protocol,
not exactly-once external execution or a hostile-SQL security boundary.

See [0209 evidence](../../intent/0209/EVIDENCE.md) for real disposable PostgreSQL,
independent-process contention, failure injection and the synthetic authority/result
ports used in testing. No live database, budget, provider or user content is involved.

Increment [0210](../../intent/0210/EVIDENCE.md) composes these operation claims with
the existing candidate-bundle writer in an uninstalled worker-side factory.
Admission hashes bind the exact submission/publication profile before a server ID
exists; step and Git-receipt hashes bind the eventual ID as well. Sent-state recovery
always takes the read-only provider path. This does not activate a database, supply
the missing trusted authority service or implement receipt-to-checkpoint promotion.
