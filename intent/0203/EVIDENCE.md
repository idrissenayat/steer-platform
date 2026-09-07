# Development evidence — 2026-09-07

Base: `63e417e`. Implemented the independent durable budget prerequisite while the
proposed $5 model-test budget remains unapproved. No model or provider call occurred.

Added `steer_usage` tables, Drizzle migrations 0005/0006 and the uninstalled
`createModelBudgetPermit` adapter. The generated owner-FK migration was corrected
to create its required unique constraint before the foreign key; forced RLS and
least-privilege runtime grants were added explicitly. No existing migration changed.

## Verification

- Real PostgreSQL 16.14 integration: 40 checks passed. Both new migrations apply
  idempotently through the existing harness, alongside all prior migrations.
- Eight independent pools with deliberately contaminated repeatable-read defaults
  made parallel reservations against one synthetic cap: exactly three successful
  reservations consumed the full cap; reconstruction could not reset it.
- Real SQL denied budget creation/raising, reservation refunds/deletion/truncate,
  wrong owner/configuration/approval/amounts and expired/inactive limits. Owner
  reassignment after reservation was blocked by the composite foreign key.
- A fault injected after actual SQL COMMIT returned no permission; the real durable
  reservation remained consumed and the next fresh client could not spend it again.
  This is a commit-acknowledgement fault injection, not a claimed provider failure.
- Data unit suite: 28/28 passed. Typecheck initially found an exact-optional test
  annotation error; the annotation was corrected before final verification.
- Final data typecheck, package-boundary checks (8/8), kit validation (95 required
  artifacts), workflow security check and whitespace check passed.
- Migration-count expectations in the separate auth harness and explicit local
  migration/verification command now expect seven migrations. Neither local command
  was run against the persistent workspace; its new usage migrations remain unapplied.

The harness used only its uniquely named/labeled tmpfs PostgreSQL container and
generated synthetic credentials. It removed only that container and disposable
test data. No persistent local workspace database, Docker volume, real budget,
approval record, user artifact or source draft was changed.

## Remaining boundary

No real migration, budget provisioning, runtime binding or spending approval was
performed. This is not end-to-end activation, request idempotency, provider cost
reconciliation or disaster recovery. A stale backup/independent database copy must
not be used to resume model spending without reconciliation. Accounting rows are
not disposable projections. Full input/output/cost bounds and approval verification
remain required before enabling the port for real model calls.
