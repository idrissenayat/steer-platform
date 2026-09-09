# Development evidence — 2026-09-09

Base: `5cdde4cdf35672e85ad1eeb04c1b05edb0ceff94` (0275).

## Current work

A [worker-owned helper](../../apps/worker/test/authenticated-model-workflows.integration.ts)
connects the actual factory's two authenticated model-workflow starts to existing
scope/development schedulers, activities and workers. It deliberately supplies
synthetic authority/model ports, not an injected principal or replacement API
service. The caller's exact prepared runtime still owns recorded SQL/SDK checks.

Initial and corrected scope each use one runtime across the verified two-batch
manifest. Drafting uses one recorded model and one step runtime across Architect
and Test Agent. The real workflow selects batch/role order; synthetic responses
match the exact observed request and pinned profile. Each workflow checks denied
start, lost scheduler acknowledgement, repeated start, reference-only single-attempt
history, replay and owned worker shutdown. Prior confirmation/save/reopen remains.

The longer fixture now renews only its disposable membership before initial source
capture and uses fresh signed three-minute JWTs per HTTP action. Explicit grant
denials and the separate pre-final-corpus renewal remain. Production tokens,
membership, timeouts and records policy are unchanged.

Initial type checking found a test-only scheduler-interface erasure of its `close`
method; the helper now retains the concrete owned client separately.

## Observed failure and bounded repair

The first joined run passed initial scope but failed the drafting start: HTTP 503
after 30,042 ms and 65,833 synthetic native-provider calls, at the unchanged
30-second service deadline. That is a failed run, not a successful workflow.

Each development-start revalidation restored its original three times; each
restoration traversed the same full current scope twice. The new private
[current-scope read window](../../packages/data/src/current-scope-read-window.ts)
does two full current reads around exact immutable intermediate reuse in that
single read-only validation. Every caller/source callback still executes, as do
all original/key/lifecycle/execution/start-policy checks. The full final read must
agree before any scheduler RPC. Each later scheduler callback opens a fresh
window; history, expiry and supersession never substitute for current evidence.
No timeout, corpus, profile, authority or cost boundary was relaxed.

Eight new negative/positive window tests and the nine existing historical-window
tests pass, and API/data/worker typechecks pass. The repaired joined run has now
passed both scope workflows and drafting, including lost scheduler ACKs, replay
and no duplicate reservations. Its drafting starts took 13,001 / 14,640 / 14,525 ms
and 41,768 / 47,350 / 47,350 synthetic native-provider calls. The complete repaired
`--journey-runtime` selection passes all three joined checks plus idempotent
migration verification, including corrected confirmation, one fixed save and
exact older-commit reopen after lost acknowledgements and actual runtime restart.
It is not the full SQL suite. The two scope workflows, one drafting workflow and
one save workflow leave exactly six synthetic model requests/reservations and
one disposable native Git commit. All owned workers, four managed API runtimes,
native fixture and SQL container are closed/removed by their test owners.

This run's candidate preview took 31,098 ms / 39,550 native requests. The first
confirmation and two recovery reads took 51,564 / 56,184 / 53,178 ms and
79,532 / 79,470 / 79,468 native requests. That remains unsuitable evidence of
responsive live UX.

## Final verification

- Broad regression: **1,349 tests pass**, zero failed/cancelled/skipped,
  143,610 ms, concurrency four. This includes eight new current-window cases:
  current callback checks, fresh next-barrier reads, final records/source/result
  changes, expired/superseded/history denial, exact target/reader pinning,
  nonvoid/missing callbacks, cancellation, overlap/unawaited work and closed ports.
- The explicit new `--development-start` SQL selection passes four HTTP/SQL
  regressions plus idempotent migrations: exact original binding, missing/revoked
  authority and stale source, late hold/correction, and lost ACK/post-dispatch
  revocation. Its selection is tested and cannot silently stand for the full suite.
- Prototype and all eight package typechecks pass (five unchanged checks use
  local Turbo cache); the optimized Next production build passes.
- The 95-artifact kit, read-only workflow-token scope audit, protected Architecture,
  Exam and accepted retention hashes, 211 local links across six changed/new
  Markdown files and diff whitespace checks pass.

The user-owned `docs/REAL-USER-ROADMAP.md` and `outputs/` remain untouched and
excluded. No browser acceptance or live-provider load test was performed. The
first failed joined attempt remains documented above; only its repaired rerun
and the explicitly named checks are passing evidence, not the full SQL suite.

## Open boundaries

No new production worker profile or current authority is installed. The helper
tests ownership with completed synthetic operations, not every hung dependency or
production crash/drain scenario. Confirmation request volume and approximately
52–56-second latency remain open, along with governed startup/bindings, D1 and
model/provider/write authority, semantic acceptance and remaining dispositions.
