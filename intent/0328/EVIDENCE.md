# 0328 — Preparation draft validation and measured limits

Base: `58d567809475a932381b53a4c17af3fa6e4050b7`.
[Brief](BRIEF.md), [Spec](SPEC.md), [verification](VERIFICATION.json).

Both preparers now use one private draft snapshot per read-only recheck. Full
final native draft/key/row/latest-revision/lifecycle verification follows evidence
closure. Fresh caller and purpose checks remain, and admission/preservation stay
between separate phases. Initial discovery and empty/incomplete paths retain
ordinary reads. No public API, signed requirement or runtime binding changes.

## Measured result

| Authenticated synthetic preparation | 0327 requests | 0328 requests |
| --- | ---: | ---: |
| Scope preparation, either direction | 280 | 277 |
| First drafting preparation, either direction | 520 | 517 |
| Second drafting preparation, either direction | 475 | 472 |

Native draft key lookups across the three rechecks fall twelve to six, with one
initial lookup during each evidence window and one final lookup after it closes.
This is only three fewer whole-action attempts per preparation (1.07%, 0.58% and
0.63%). It is not sufficient progress against the 200-attempt ceiling to justify
another completion forecast. Save preview/confirmation remain 265/685 for
new-distinct and 375/905 for continuation. All identity, repository, token and
retry attempts count. Undelayed shared-host timings are not a p95 benchmark.

## Verification

- **1,583 broad regression tests pass**, zero failures/skips/cancellations,
  348,420.707041 ms. **20 focused tests pass**, 215.898708 ms; scopes overlap.
- **20 native scope-preparation checks** and **19 native drafting-preparation
  checks** pass, each plus idempotent migrations. Four new named checks include
  36 late-change cases: six modes across three phases in both preparers.
- Explicit mutation-success assertions verify actual edits, acknowledged holds,
  trigger-valid expiry, key changes, draft-grant loss and close. Before admission,
  failures leave no operation; after admission, uncertainty preserves committed
  metadata; after original preservation, no failed phase releases readiness.
  Exact original bytes and zero model reservations are checked.
- Three default authenticated joined checks and one continuation joined check
  pass, each plus migrations. Corrected documents, exact human confirmation,
  fixed native save, lost acknowledgements/reconstruction, replay and old-commit
  reopen remain verified under synthetic provider/authority responses.
- Final prototype and all eight apps/packages typecheck. The first full typecheck
  found two possibly-undefined test counters; explicit non-null indexing fixed
  them. Both native selections and full types were rerun. Production source was
  unchanged during the broad run; those native-only counter assertions changed.
- The kit validates 95 required artifacts; workflow token scopes remain read-only.

The verification artifact retains 28 complete action samples (14 per direction),
including their conserved request-kind and origin totals. An earlier default
console chunk was truncated; the complete final 12-action summary and two complete
drafting-preparation lines are retained, not reconstructed from missing text.

## Current request attribution

The scheduling-origin profile was rerun on this source with a read-only stdout
reducer. It validates each group's count, each action's total, zero overflow/
capture errors and exactly **45 actions / 10,445 identity attempts**. An earlier
verbose run exited successfully but its console capture was truncated and is not
used as complete attribution evidence. The fresh compact [profile](PROFILE.json)
preserves all action counts and exclusive scheduling-origin/leaf totals, with its
reproduction command. This diagnostic run is separate from latency acceptance.

First new-distinct confirmation totals **685 attempts**: 647 identity and 38
repository. Of the identity attempts, 470 belong to the two preview phases, 166
to other confirmation work and 11 to other/boundary work. These are attribution
groups, not safely removable checks. Even deleting all preview traffic would
leave 215 total attempts; deleting all other confirmation traffic would leave
519. Therefore neither hotspot alone can reach 200. No phase may be deleted.

Next address the combined final-review/preview caller and draft graph plus the
independent confirmation/preservation controls, preserving separate pre-/post-
effect phases. Use the same whole-action measurements as the success condition;
draft-only wrapper reductions are not sufficient. Drafting start also remains
458/521/521 and requires its own complete caller/read-set integration.

## Remaining work and authority

Whole-action request costs and the unchanged complete delayed C22 protocol remain
open. Real-model quality, governed records/clock adoption, runtime GitHub save/
reopen and signed-in UI/human acceptance are also incomplete.

**68% (17/25; eight remaining; +0 percentage points).** This increment advances
preparation validation; it does not complete a new fixed acceptance checkpoint.
No live model call/spending, runtime GitHub artifact write, deployment/release,
profile/records activation, signature or real-data deletion occurred. Cleanup
removed only the tests' owned disposable PostgreSQL containers/tmpfs data. The
user's roadmap/outputs and protected architecture/Exam/records policy are untouched.
