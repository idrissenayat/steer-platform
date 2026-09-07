# Plan

1. Permit the signed-dispatch fixture to reuse an explicitly supplied owned Git
   fixture and exact item/operation without changing its other transports.
2. Replace direct dispatch in the existing created-Brief journey with the actual
   managed scheduler, identity runtime, signed JWT and current Git authorization.
3. Run focused regression/typechecks and the full isolated Temporal/Git/PostgreSQL
   suite. Preserve the synthetic-only scenario as separate negative/ownership coverage.
4. Update current project documentation, run final regression/builds, then commit,
   push and verify exact remote equality and a clean tree.
