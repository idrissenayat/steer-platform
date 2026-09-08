# Development evidence — 2026-09-08

Base: `19a26b1d8035da2b583182415dbf97c1eb6493b0`.

## Delivered boundary

`@steer/data/draft-lifecycle` implements disabled server-owned draft IDs and clocks.
Creation is unique by organization/owner/request UUID; callers cannot set creation,
draft ID or deadline. The original identity/clock survives retries and expiry.
Inspection returns metadata, never content-use permission. The loader implements
0213's exact lifecycle port using database state instead of invented fixture dates.

Explicit discard records a single database timestamp and shortens use to at most
60 seconds later. A hold needs its own trusted qualified verifier, stays sticky
and denies ordinary content retrieval. Publication needs a separate trusted exact
effect/time verifier; input references alone cannot set its clock. The original
publication binding is immutable. Earliest creation/publication/discard cutoff wins.
No mutation deletes a row, draft key, original payload, operation or Git record.

Migrations 0011/0012 add forced owner/org/product RLS, restricted role grants and
one-way metadata guards. Current authority and hold/publication evidence run outside
SQL; five-second bounds and retained admission suppress stalled/late work. Lost
COMMIT or post-commit revocation returns unknown without undoing recorded restrictions.
The metadata has a technical 10,000-row creation cap per authorized owner/product
scope; no purge or expiry reset replenishes it. This is not a disposal policy.

## Verification

- `pnpm test:data:integration`: **100/100** checks pass on PostgreSQL 16.14,
  native Git and Temporal 1.31.2. Ten lifecycle cases cover server ID/clock creation,
  concurrent retries, owner/product/role isolation, discard, aged expiry, distinct
  qualified hold/publication ports, timestamp/reference rejection, uncertain COMMIT,
  late authority revocation, immutable SQL guards and timeout/close handling.
- The candidate Temporal suite now reads actual SQL lifecycle state before decrypting
  the original. A new test records a durable hold after queueing and proves the
  activity cannot restore or send Git work. The existing successful save/replay,
  unknown outcome and cancellation paths remain passing with this loader.
- Worker/data/domain/registry units plus migration controls: **278/278** pass.
  Separate existing Temporal/projection regressions: **33/33**; encrypted-session
  destination runtime regression: **1/1**. The expanded thirteen migrations apply
  in both disposable harnesses, without changing real services or databases.
- Full prototype/eight-package typecheck, kit validation (95 required artifacts),
  workflow token-scope audit and whitespace checks pass. Drizzle regeneration
  reports no schema changes; it does not apply a real migration. Protected
  architecture/Exam/accepted-policy SHA-256 values remain `9e1783a5…`,
  `84ad1d4c…` and `f8a9cb9a…`.

## Non-claims and next work

The tests use disposable PostgreSQL, native Git and Temporal, with synthetic
authorization, qualified-hold/publication proof and in-memory key ports. A seeded
old SQL record tests elapsed retention; it is not seven days of observed operation.
The loader is integrated in tests only. It is not installed in the real UI or API.

The actual receipt-to-publication-clock binding and qualified-hold source validation
are not implemented by caller-supplied verifier ports. D1 is unsigned/inactive.
Accepted policy and architecture amendments, persistent key/all-copy recovery,
restricted hold preservation and authorized verified disposition remain open.
No deletion, key creation, role provisioning, real migration, paid call, provider
write, deployment, signed-source change or independent gate verdict occurred.

The development journal now has thirteen entries; the real local migration guard
still rejects anything beyond its seven-entry baseline before reading private state.
Versioned draft/editor content, generation checkpoints, development-role orchestration,
full-source/current-authority binding and real signed-in UI acceptance remain next.
