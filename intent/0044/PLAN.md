# Implementation plan

1. Add Drizzle schema and a versioned invoker-rights projection trigger.
2. Add strict internal fixed-scope reader and loss-detecting decimal cursors.
3. Verify real PostgreSQL paging, duplicate/repair, lock ordering, rollback, RLS,
   runtime privileges and generation/gap refusal plus native validation tests.
4. Rerun repository and affected shared PostgreSQL/Temporal/browser harnesses.
5. Document exact evidence and limits, commit/push, verify candidate remote.

Next foundation work remains authenticated gate source/proof normalization and
consumer composition, followed by governed business tools and operating screens.
