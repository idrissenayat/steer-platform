# Spec

- Separate operational accounting from rebuildable projections in `steer_usage`.
  Add versioned Drizzle budgets and reservations with forced row-level security.
- Budgets bind organization, UUID, human subject, configuration revision, approval
  digest, integer micro-USD cap and per-role maximum amounts. They default inactive;
  validity is at most 24 hours. No default cap, real approval or active row is seeded.
- Runtime can SELECT budgets and INSERT/SELECT reservations only. No creation,
  update, activation, refund, delete or truncate privileges. Other runtime roles
  cannot access usage tables. A composite foreign key prevents reassignment of a
  budget owner after reservations exist.
- Strict server binding and requested owner/configuration must agree. SQL checks
  active/valid matching budget, exact costs, sum of prior reservations and a maximum
  10,000 reservations per budget before inserting a new unique record.
- Serialize by organization/budget with a transaction advisory lock and explicitly
  force READ COMMITTED even on contaminated connections. Fixed parameterized SQL
  and server query/lock limits apply; transaction-local scope is scrubbed on release.
- Return permission only after known successful commit. Unknown commit returns
  false and evicts the connection, without retry or refund. A committed reservation
  remains consumed across service reconstruction and subsequent calls.
- No model calls, source-content storage, local deployment migration, budget
  provisioning, real spending, permission changes or automatic record deletion.

The binding is compatible with the existing DevelopmentPermit port, not yet wired
into the local startup. Upper-bound pricing/token verification, approval resolution,
call idempotency, recovery and provider reconciliation remain activation work.
