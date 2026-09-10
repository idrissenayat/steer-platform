# 0327 — Owned source-review draft phase and lifecycle test repair

Base: `ad4ec1f91c19ba78904b9b0478a0753e1813b5eb`.
[Brief](BRIEF.md), [Spec](SPEC.md), [verification](VERIFICATION.json).

A private exact-method/scope registration connects native draft read phases to
ordinary and shared source review. Each phase lazily captures one canonical
encrypted-draft snapshot, checks fresh read permissions on reuse, then compares
full key bytes/ID, encrypted row, latest revision and lifecycle after dependent
work and corpus closure. The first deadline cannot renew; invalid/backward SQL
clocks deny. Owned key copies clear after actual drainage. Ordinary API shapes,
unregistered readers and append behavior remain; no phase encloses effects.

The service retains four public-call slots and separately bounds private phases
at four, using the same bounded pool and shutdown tracking. Native tests prove
four enclosing phases can perform public draft reads, while a fifth private
phase is denied. Only its exact constructed native store uses guard-only inner
caller boundaries: service entry/final checks, fresh post-policy callers and both
key-lookup caller edges remain. Independent native consumers retain full callers.

## Measured effect

| Authenticated synthetic action | 0326 attempts | 0327 attempts |
| --- | ---: | ---: |
| Source / save review, either direction | 75 / 162 | 70 / 150 |
| New-distinct preview | 277 | 265 |
| New-distinct confirmation / recovery / repeat | 709 / 681 / 679 | 685 / 657 / 655 |
| Continuation preview | 387 | 375 |
| Continuation confirmation / recovery / repeat | 929 / 901 / 899 | 905 / 877 / 875 |

Three native draft reads use two key lookups instead of six, with exact output
parity and unchanged encrypted rows. Other sampled counts stay unchanged:
preparation 280 and 520/475, drafting start 458/521/521, and outside-preview
confirmation control 155. First confirmation improves only 3.39% / 2.58%.
All identity, repository, token and retry attempts remain included; 34 action
samples and their kind/origin sums are retained. These are modest partial gains,
not the whole-action solution, warmed p95 or a live UI speed claim.

The intermediate implementation raised standalone source review 75→77 and
reduced confirmation only to 701/921. The final exact-service caller ownership
correction produces the counts above without omitting independent permissions.

## Evidence defect and correction

An added expiry test failed `draft_lifecycle_bounds`. Its fixture attempted an
invalid direct `use_until` update. Inspection also found that four new 0326
hold/expiry cases could report store denial because their fixture SQL failed,
without ever applying the intended state. The historical 0326 report now carries
an explicit correction; its original counts/hashes are not rewritten as new runs.

Corrected fixtures seed valid three-minute-old disposable lifecycles, use actual
hold operations and trigger-valid expired discards. Explicit success assertions
require the state transition before counting the store's denial. Both original
stores now pass those corrected cases. The new draft-phase tests also require
successful mutations and acknowledged holds. No completed fixed checkpoint
depended on these four new 0326 cases; they advanced a pending C22 only.

## Final verification

**1,583 broad tests pass**, no failures/skips/cancellations, in 341,853.588333 ms.
**65 focused tests pass** in 523.070792 ms. Prototype and all eight apps/packages
pass typecheck. Final native draft selection passes **18 checks**, including six
new checks covering parity, late work/final-key loss, clocks, concurrency and
drainage. Corrected original-preservation selection passes **26 checks**. Each
native selection also passes idempotent migrations.

Both final authenticated synthetic journeys pass: three default joined checks
and one continuation check, each plus migrations. One fixed native save,
lost-response/restart/replay recovery, exact old-commit reopen, late authority
denial and prior/canonical/proposal-target preservation remain. The broad/unit
sources are final; two assertion-only native hold checks were strengthened during
the broad run, then rerun in the final native selection and final typecheck.

The kit validates 95 required artifacts and the workflow token-scope audit passes.
Eighteen source/protected hashes are retained. Focused/broad checks overlap; these
native selections are not the full PostgreSQL suite. Build/browser and the full
20-warm/3-cold/4-concurrent delayed protocol were not run.

**Progress: 68% (17/25; eight remaining; +0 percentage points).**
C22 remains open, as do model quality, records/clock adoption, governed runtime
save/reopen and signed-in human acceptance. The 0289 recovery observation and
signed requirements remain unchanged. No live model calls/spending, runtime
GitHub artifact write, activation, deployment/release, signature or real-data
deletion occurred. Cleanup affects only owned disposable fixtures; user drafts,
the untracked roadmap and outputs remain untouched.

Next continue whole-action validation consolidation and complete the unchanged
benchmark. No test count, documentation change or fixture repair earns a new
acceptance checkpoint by itself.
