# Development evidence — 2026-09-08

Base: `8395a83f1cc6e62ad9d356f07e7aabd38a7046f7`.

## Implementation

Shared `intent.scope.read` query, portable exact result/digest/state contracts and
an explicit API factory that pins the current profile and actual recorded SDK
verification. The existing combined reader supplies encrypted recovery and current
authority. No new table, migration, grant or default runtime installation.

## Verification

- Full regression suite: **1,050/1,050 passed** on Node 24.19.0, including six new
  scope-query/portable-response checks and one new lazy API-factory check.
- Full PostgreSQL 16.14 integration suite: **271/271 passed**, including six new
  actual HTTP/encrypted-SQL/recorded-SDK scope query cases. All 28 existing
  migrations apply idempotently; no migration was added.
- The focused scope planning/review/query set passes 19/19, and the focused
  factory/dependency set passes 11/11. These overlap the full suite, not extra totals.
- Prototype and all eight package typechecks, optimized Next build, Drizzle
  history, kit (95 required artifacts), workflow scope audit and whitespace checks
  pass. The portable-contract graph test now includes scope result contracts.

HTTP tests demonstrate a 34-source/two-batch pending→partial→complete review and
reconstruction with unchanged durable steps and one synthetic model call/reservation
per batch. They also preserve incomplete inventory/access coverage and unresolved
dispatch; deny default/agent/missing-grant/foreign/injected requests; reject a changed
current profile and denied/non-void source authority; mark newer corrections
superseded; withhold findings after current grant loss or a durable hold; and return
only metadata after expiration without invoking execution authorization.

Contract tests reject false-ready states, altered bindings/digests, private fields,
authority flags, inconsistent source/batch accounting and changed citation bytes.
These are structural integrity checks, not semantic correctness or source grants.

The integration runner removed only its own synthetic PostgreSQL container and
tmpfs data; real application records were not migrated or deleted.

Protected source SHA-256 values remain unchanged:

- `intent/0001/ARCHITECTURE.md`:
  `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- `intent/0001/EXAM.md`:
  `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- `intent/0001/reviews/domain/round-2/remediation/RETENTION-AND-RECORDS-POLICY.candidate.md`:
  `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

## Boundaries

Identity, source/records grants, keys, budgets and model responses remain synthetic.
The API-key skill preserves the resolved credential choice without key inspection
or creation. D1 is unsigned/inactive; the first-test model budget is unapproved.

No real migration, records adoption, paid call, runtime Git save, gate, deployment
or release was enabled. Actual editor integration, scope preparation/Temporal,
expired observation access, real authority, semantic quality and I1–I6 human/save
acceptance remain open. Protected signed documents and user-owned files are intact.
