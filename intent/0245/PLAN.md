# Implementation plan

1. Add exact start/receipt contracts and explicit authenticated tool dispatch.
2. Compose retained original, current draft/manifest and execution authorization.
3. Add fixed-namespace Temporal scheduling with exact-history recovery and no retry.
4. Test contracts, timeouts, authority/source changes, real HTTP/SQL/Temporal lost
   responses, concurrent starts and mismatched workflow input/policy.
5. Run full regressions, integration, types/build, migration-history and repository
   checks. Record observed results, commit/push owned files and verify remote HEAD.
6. Continue actual editor scope preparation/start/read/progress/recovery without
   relaxing legacy generation gates or installing unsigned real records/model access.

## Next integration boundary

The actual editor must keep prepared, running, unknown, superseded, expired,
incomplete and review-available states distinct. Recover findings through
`intent.scope.read`; Temporal completion alone cannot select a disposition, claim
newness or authorize drafting/saving. Preserve human corrections and exact review
references, and invalidate stale review when Brief/Spec scope changes.

Real records adoption, current corpus/lifecycle/model authority, approved first-test
spending, semantic evaluation and signed-in save/reopen acceptance remain required.
