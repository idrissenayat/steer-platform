# 0319 — Current permission-query contract

1. A private constructor distinguishes a permission-only current-source policy
   from generic caller brackets. Ordinary calls retain both before/after checks.
   No content read, key lookup, mutation or scheduling belongs inside that policy.
2. Only the current-scope read window with the exact same caller callback may use
   the metadata query. Its entry authenticates first. The query executes the real
   source policy, then freshly checks the caller before any scope IO or continued
   consumption. Every use reruns policy and caller checks; no decision is cached.
3. Construction identity survives genuine forwarding with fixed arguments,
   receiver and owner tracking/guards. Copied/bound/wrapped/historical/different-
   caller callbacks cannot opt in. Nonvoid, failed, changed or closed authority
   rejects; premature trackers cannot grant work that has not actually drained.
4. Drafting start opts in only for its read-only original source permission.
   Current scope, final record/key/source closure, full first/final IO validation,
   ordinary ordering, scheduler separation and actual pending ownership remain.
5. Verify owner/forwarding/ordering/negative tests, native ordinary/owned start,
   both full synthetic authenticated save/recovery/reopen directions, types and
   broad regression. Measure all provider attempts; no increased deadline, hidden
   identity exclusion or substitution of synthetic evidence for real UI acceptance.

The existing request-attribution selection supplies diagnostic evidence only.
It is not p95 or the complete benchmark. 68% (17/25; +0) remains until a complete
acceptance checkpoint passes.
