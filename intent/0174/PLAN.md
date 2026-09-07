# Plan

1. Audit journey code gaps separately from governance prerequisites.
2. Add an owned fixed-operation client beside the existing Temporal starter.
3. Test snapshots, one attempt, uncertainty/absence, hostile metadata, namespace
   drift, single-flight admission and owned failure/draining cleanup.
4. Extend disposable Temporal/native Git/PostgreSQL integration: lose a real start
   acknowledgment, inspect, recreate connection, reject duplicate, and distinguish
   completed workflow metadata from unchanged projection state.
5. Run regressions/builds, document actual evidence, commit/push the candidate and
   verify exact remote equality and a clean tree.
