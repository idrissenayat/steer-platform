# Plan

1. Compose immutable originals, successful response checkpoints and the existing
   corpus-wide assessment validator behind a read-only, current-authority boundary.
2. Preserve pending, unresolved, incomplete, superseded and expired states without
   inventing uniqueness or retry/save authority.
3. Verify actual multi-batch SQL/SDK recovery, partial findings, missing checkpoints,
   coverage gaps, abstention, corrections, expiry, current authority/key denial,
   changing snapshots, holds, close and read-only SQL behavior.
4. Run full regressions/integration and compatibility/governance checks. Record the
   exact observed results and limits; commit/push owned changes and verify GitHub.
5. Continue scope Temporal/query/UI wiring under the unchanged activation boundaries.
   Keep the existing one-minute implementation loop active.
