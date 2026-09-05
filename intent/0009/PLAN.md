# Execution route

1. Record the item and acceptance boundaries.
2. Define two Drizzle tables and organization RLS policies.
3. Generate baseline SQL and add explicit FORCE RLS/runtime-grant migration.
4. Build transaction-local tenant execution and typed projection reading.
5. Test current/expired principals and rollback behavior.
6. Execute migrations twice and isolation/pool-reuse tests in disposable
   PostgreSQL 16 as non-owner roles; inspect actual privileges and RLS flags.
7. Run root checks, record evidence, commit and push.
