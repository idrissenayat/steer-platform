# Development evidence

Baseline `cb778ba`; local verification 2026-09-04. This evidence covers source
in the same delivery commit, not a protected independent Exam.

- Four new unit/contract tests pass: deterministic scoped keys, pre-SQL
  identity/integrity denial, exact reconciliation source/previous-revision
  binding, and zero-ingestion behavior on source failure/head movement.
- Three new real PostgreSQL checks pass: concurrent duplicate delivery and
  older-event non-regression; CAS/conflicting-source rollback; deterministic
  repair after synthetic projection corruption/loss. The complete database
  harness now passes eleven checks against PostgreSQL 16.14.
- Existing five data unit and 23 adapter tests remain passing. Root checks
  verify the kit, controls, prototype, package types/tests and builds.
- All source/provider responses were isolated fixtures. The only database
  writes/deletions were synthetic test data in the run-owned disposable
  container, removed afterward. No existing database or host data was touched.

The immutable ingestion reference and current projection update share one
transaction. Per-source advisory locking and expected-revision checks protect
concurrent updates. Exact duplicates append nothing; conflicting immutable
bytes deny. Repairs do not rewrite event history. Authorization still reads
through current Git source, never this projection cache.

This is a single-artifact reconciliation building block, not a complete
webhook consumer, durable worker, full-repository replay or live Git connection.
Repository force-push/branch-rewind handling is not enabled: an older known
event cannot regress a newer projection. Operational recovery/migration and
provider-write permissions remain gated. No Gate 2 or release claim is made.
