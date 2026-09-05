# Development acceptance

Builder tests; not an independent protected Exam or gate approval.

- Both tables have enabled and forced RLS and USING/WITH CHECK tenant policies.
- No-context reads see zero rows and no-context writes fail.
- Tenant A cannot read B or insert/move rows into B; B remains independently readable.
- Commit, rollback, thrown callback and concurrent callers preserve isolation;
  a single-connection pool is deliberately reused across tenants.
- App cannot write; projector cannot rewrite history, delete or truncate.
- Runtime helper rejects admin/bypass roles and invalid/expired principal.
- Running the recorded Drizzle migrations twice is safe.
- Integration is observed against real PostgreSQL, not an in-memory imitation.
