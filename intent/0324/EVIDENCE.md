# 0324 — Verified readback from candidate preservation

Base: `ffa9c343495d18253a7cbd081282b31a8b0db60c`. [Brief](BRIEF.md),
[Spec](SPEC.md), [verification](VERIFICATION.json).

`putAndRead` returns the immutable original from the complete recovery that
candidate preservation already performs. Confirmation compares that result to
the admitted request instead of immediately performing a second full recovery.
The legacy `put` acknowledgement remains unchanged. Failure/uncertainty never
includes an original. Initial preview, admission, pre-preservation source check
and full post-preservation draft/preview/draft validation remain separate.

This is not a read cache. Candidate recovery durably synchronizes observed holds
and shortened expiry, so it must not be treated as a read-only lease. Both
synchronizations still run in the retained recovery, including final key/record
checks. Later independent reads fully recover again. Scope/development original
stores have distinct `put` and `read` purposes; this change does not infer one
from the other or install this optimization there.

## Measured effect

| Authenticated synthetic action | 0323 attempts | 0324 attempts |
| --- | ---: | ---: |
| New-distinct confirmation / recovery / repeat | 747 / 719 / 717 | 709 / 681 / 679 |
| Continuation confirmation / recovery / repeat | 967 / 939 / 937 | 929 / 901 / 899 |

Each confirmation removes 38 attempts. First-confirmation work outside its two
previews falls 193→155 (19.69%); whole first confirmation improves 5.09% / 3.93%.
Previews remain 277/387, final review 162, and all other sampled action counts
are unchanged. All identity, token and repository attempts remain included.

The native store comparison returns identical originals for new and repeated
preservation. Initial key lookups fall five→three; repeated lookups four→two.
Lifecycle synchronizations fall four→two in both cases. There is still one
immutable insert, no retention renewal and no provider dispatch. These are
undelayed functional samples, not warmed p95, browser speed or C22 acceptance.

## Verification

Five new native checks cover old/new readback and legacy acknowledgement parity,
six late-loss variants, lost insertion acknowledgement, concurrent insertion,
and a timed-out key retained through actual drainage/close. The late-loss cases
cover record authority, denied/rotated keys, held/expired lifecycle and owner
closure. Holds and earlier expiry remain latched after stale lifecycle values
return. Failure never returns the private original.

The final candidate-save selection passes 45 native checks plus idempotent
migrations. Both authenticated native directions pass (three default joined
checks, one continuation), retaining one save, restart/lost-reply recovery,
exact old-commit reopen and prior-file/target preservation. The focused selection
passes 27 tests; all eight apps/packages and prototype typechecks pass. The kit
has 95 required artifacts and the workflow token scope audit passes. Broad
regression passes all 1,568 tests in 325,361.290917 ms with zero failures, skips
or cancellations. Exact source/protected hashes are in the verification artifact.
Focused tests overlap broad tests; these are not the full PostgreSQL suite.

No failing run or production correction occurred during this increment. The
first native save selection passed 44 checks; it was rerun with the added
timeout/close check and passes 45. No live model, runtime GitHub write, real
records/profile activation, deployment, release, signature or live-record
deletion occurred. Harness cleanup affects only owned disposable test data.
Protected artifacts, the unresolved 0289 recovery observation and the user's
untracked roadmap/outputs are preserved.

**Progress: 68% (17/25; eight remaining; +0 percentage points).**
Next consolidate the remaining draft/original checks with their distinct current
read purposes and effect boundaries, then run the unchanged whole-action
20-warm/3-cold/4-concurrent benchmark. C22, real-model quality, governed live
save/reopen and signed-in human UX acceptance remain open.
