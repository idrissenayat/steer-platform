# Development evidence — 2026-09-09

Base: `1fbc41ee51d75cf65e4de03f6e8911d4b9af6f3c` (0277).

## Verified attribution

An aggregate-only meter wraps the existing native provider transport specifically
for the actual identity fixture. Corpus, destination and save readers retain the
original shared transport. The fixture still verifies its signed issuer/App JWTs
and builds the actual identity/factory; no principal, response or service result
is substituted. Per-action deltas partition total native requests into identity
and remaining repository traffic. Both paths still observe the same native Git
head and authorization document, including grant edits and runtime reconstruction.

The meter retains counts only and delegates original request/init references and
promises unchanged. Tests cover response/error identity, private-data absence,
invalid intervals and exact partition sums. No production behavior or performance
improvement is claimed. Three metric tests and API/worker typechecks pass. The
`--journey-runtime` selection passes all three joined checks plus idempotent
migrations; its synthetic model/native responses and all prior workflow assertions
remain unchanged. Its runner closes all owned workers/API runtimes and removes its
disposable native fixture and SQL container/tmpfs data. This is not the full SQL
suite or signed-in UI acceptance.

## Exact measured ownership

Counts below are synthetic native-provider attempts in the actual authenticated
fixture. Head columns are subsets of the total; other categories are retained in
the test's fixed-count diagnostics, never paths, identities or provider bodies.

| Action | Total requests | Identity head reads | Repository head reads |
| --- | ---: | ---: | ---: |
| Current source review | 3,973 | 3,703 | 4 |
| Corrected-scope preparation | 13,997 | 13,063 | 14 |
| Scope result read | 664 | 661 | 0 |
| Final package review | 9,342 | 8,807 | 8 |
| Candidate preview | 33,694 | 32,617 | 22 |
| Confirmation, discarded reply | 67,820 | 65,669 | 44 |
| Confirmation after reconstruction | 67,758 | 65,605 | 44 |
| Identical confirmation replay | 67,756 | 65,605 | 44 |

The first confirmation's identity transport accounts for 65,672 total requests:
65,669 heads and one commit/tree/blob each. The remaining repository transport
accounts for 2,148: 44 heads, 708 commits, 708 trees and 688 blobs. Thus identity
owns 96.8% of all requests and 99.93% of head lookups in that action. This is direct
transport attribution, not extrapolation from shared URL shapes. It also confirms
that the existing exact-commit authorization-document reuse is active: the same
request reads its identity document once but repeatedly verifies head.

Preview/confirmation totals exactly match 0277; this diagnostic does not make them
faster. Observed preview was 29,415 ms; confirmations were 54,109 / 50,771 / 49,555 ms.
No live-provider latency/rate-limit benchmark, new model reservation or real GitHub
runtime write was performed. The joined test still has six synthetic model calls/
reservations, one encrypted original and one native Git commit, with current grant
revocation and exact older-commit reopen passing after restart/lost acknowledgements.

## Final verification

- **1,355 broad tests pass**, zero failed/cancelled/skipped, 142,297 ms,
  concurrency four. The transport metrics include original response/promise/
  synchronous-error/rejected-error identity and invalid-partition checks.
- API/worker typechecks pass directly. Prototype and all eight package typechecks
  pass in the final root command (seven unchanged checks use local Turbo cache),
  followed by a successful optimized Next production build.
- Protected Architecture/Exam/accepted-retention hashes, the 95-artifact kit,
  read-only workflow-token audit, 221 local links across seven changed/new Markdown
  files and diff whitespace checks pass.

No production source or live profile was changed. The user-owned
`docs/REAL-USER-ROADMAP.md` and `outputs/` remain untouched and excluded. The API-key
skill's resolved credential boundary remained intact; no credential inspection,
recreation or real model call was needed. The focused SQL result above is not the
full SQL suite, and there was no browser acceptance run.

## Next implementation boundary

A [bounded next-change investigation](INVESTIGATION.md) identifies
request-owned immutable corpus verification as a proposal requiring equivalence
tests, not an implemented permission cache or adopted architecture amendment.
Use it to remove unnecessary repeated work that triggers caller checks; do not
disable authentication, make identity grants stale, or skip distinct authority
services to obtain a smaller count. Live records/D1/model/write adoption, remaining
dispositions, semantic quality and signed-in I1–I6 acceptance stay open.
