# 0323 — Review caller-bracket ownership

Base: `b1d54161227b0c4c667457840bddf47e25aaae39`. [Brief](BRIEF.md),
[Spec](SPEC.md), [verification](VERIFICATION.json).

The exact constructed source and final-review producers already check their
supplied caller before dependent work and after IO. A private registration now
lets those producers own these brackets without duplicate session-wrapper calls.
Unknown/ordinary/bound readers retain the outer checks. Independent callbacks
remain independent. No draft, corpus, record, key, scope or effect-boundary read
is removed; the current assessment's lazy entry and final closure are unchanged.

Per-consumption bookkeeping requires at least two completed checks of the exact
caller and no pending check. This detects missing/unfinished brackets; it does
not replace the producers' audited before/after-IO responsibility. Any caller
failure poisons the session, even when a producer swallows the error and later
checks would pass. Port/scope/owner changes and escaped/concurrent reads deny.

## Functional synthetic measurements

| Action | 0322 provider attempts | 0323 provider attempts |
| --- | ---: | ---: |
| Final review, either direction | 166 | 162 |
| New-distinct preview | 285 | 277 |
| New-distinct confirmation / recovery / repeat | 763 / 735 / 733 | 747 / 719 / 717 |
| Continuation preview | 395 | 387 |
| Continuation confirmation / recovery / repeat | 983 / 955 / 953 | 967 / 939 / 937 |

All identity, repository and token attempts count. The other measured actions are
unchanged. First confirmation improves only 2.10% / 1.63%, and remains far above
200 attempts. These undelayed, shared-host native samples are not warmed p95,
browser latency, real provider/model quality or the complete C22 benchmark.

The unchanged confirmation control outside its two previews still costs 193
attempts in these first-confirmation samples: `747 - 2*277` and `967 - 2*387`.
The [whole-request allocation](../0298/REQUEST-BUDGET-PLAN.md) therefore remains
unproven. Further wrapper-only reductions are not a sufficient completion plan;
remaining draft/original validation must be consolidated within explicitly owned
read-only phases, with fresh phases around admission and persistence, and then
measured as whole actions against the unchanged limit.

## Verification

Seven added tests cover exact construction, before/after ordering, independent
callbacks, missing/nonvoid checks, late revocation/replacement, escaped callers,
swallowed denials and unfinished checks. The final focused selection passes all
75 tests; typecheck passes the prototype and all eight apps/packages. Both final
authenticated native selections pass: three default joined checks and one
continuation joined check, each with idempotent migrations. They retain exact
saved/reopened bytes, one synthetic commit, lost-response/restart recovery and
denial after authority loss. Existing native scope/key/held-work cases also pass.
The 95-artifact kit and workflow contents-read-only audit pass. The clean final
broad rerun passes all 1,568 tests in 316,781.312333 ms, with zero failures, skips
or cancellations. Focused tests overlap broad tests. Exact source/protected
hashes and samples are recorded in the verification artifact.

An earlier focused run failed because the new test called its pending Promise
as a function; it was corrected and the whole focused/type selection rerun.
The initial broad run passed 1,567/1,568 tests; its only failure was an older
source-review assertion that still subtracted six now-removed wrapper calls.
The assertion now compares the exact additional independent caller work, with
unchanged draft/evidence/policy counts. The expanded focused/type selection and
full broad suite were rerun; production source did not change for that correction.
The first native run preceded the final swallowed-denial/pending-check hardening;
both directions were rerun on final production source. No earlier result is used
as final-source verification. The full PostgreSQL suite, browser/build, delayed
20-warm/3-cold/4-concurrent acceptance and live-provider tests were not run here.

No paid model use, live runtime GitHub save, activation, deployment, release,
signature or live-record deletion occurred. Disposable harness cleanup removed
only its own synthetic containers/tmpfs. Protected artifacts, the retained 0289
failure observation, user drafts and the untracked roadmap/outputs are unchanged.

**Progress: 68% (17/25; eight remaining; +0 percentage points).** This completes
a bounded engineering increment, not C22 or the real signed-in user journey.
