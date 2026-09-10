# 0326 — Dual-purpose original preservation and verified readback

## Follow-up evidence correction — 0327

[0327](../0327/EVIDENCE.md) found that the new shared late-hold/expiry injections
could pass through a fixture SQL error: directly changing `held` or `use_until`
violated lifecycle constraints before the intended state change. Those four
cases (hold and expiry for each store) were not valid lifecycle-enforcement
evidence in the original 26-check result. The historical run/count and source
hashes below remain unchanged. The corrected fixtures use actual hold operations
and aged, trigger-valid expiry, with explicit mutation-success assertions and a
fresh native rerun. Other prior lifecycle evidence and the fixed 17/25 tracker
are not replaced by this correction; 0326 never completed an acceptance checkpoint.

Base: `1e8a38d5b5ca53a38c00242e3c9980a96e1fc587`.
[Brief](BRIEF.md), [Spec](SPEC.md), [verification](VERIFICATION.json).

Both scope and drafting preparation now consume preservation's full verified
restoration instead of immediately repeating it. The joined server-only method
separately requires put and current-read target and original/source purposes,
including renewed read checks after put-specific execution checks. It shares
physical recovery, not permission. Legacy puts stay acknowledgement-only and
require no new read purpose; ordinary/historical reads retain their behavior.

Full ciphertext, exact source, key, lifecycle/hold/expiry, final SQL row and
revision checks remain. Preparers still compare exact originals and latest draft
revision, reject expired execution and recheck around admission/persistence.
Unknown or denied results contain no recovered payload, even when persistence
already succeeded. Timeout drainage and historical-window ownership remain.

## Measured effect

Both final authenticated synthetic directions report the same preparation counts:

| Action | 0325 attempts | 0326 attempts |
| --- | ---: | ---: |
| Scope preparation | 292 | 280 |
| First drafting preparation | 532 | 520 |
| Second drafting preparation | 487 | 475 |

Each removes 12 attempts: 4.11% for scope and 2.26% for first drafting preparation.
The native store contract measures initial key lookups 11→7 and repeat 10→6 for
each store. Independent verification reads are excluded from that key comparison,
never the put/read permission checks. Both preserve exactly the same stored row
and recovered original as legacy put followed by read.

Across the 34-sample comparison, other counts are unchanged: drafting start 458/521/521,
final review 162, new-distinct preview/confirmation 277/709 and continuation
387/929; confirmation recovery/repeat 681/679 and 901/899 respectively. Outside
both preview phases, confirmation control remains 155. Identity, repository,
token and retry attempts remain included; totals and origin sums were checked.

These modest reductions do not solve C22. Preparations and confirmation still
exceed 200. Undelayed shared-host timing is not warmed p95, browser usability or
the full 20-warm/3-cold/4-concurrent protocol. The existing benchmark is prefix-only.

## Verification

Native original-preservation selection: **26 checks**, including ten new shared
checks against both actual stores. Scope-preparation selection: **18 checks**;
drafting-preparation selection: **17 checks**. Each also passes idempotent
migrations. Both complete authenticated synthetic directions pass: three default
joined checks and one continuation check, each plus idempotent migrations.
They retain one fixed native save, lost-response/restart/replay recovery, exact
old-commit reopen, current-authority denial and prior/canonical/proposal-target
preservation. These are disposable native Git/SQL/Temporal and recorded SDK tests,
not live model or GitHub application activity.

Final focused selection: **26 passed**, no failures/skips/cancellations, in
10,212.372167 ms. Typecheck passes for the prototype and all eight apps/packages.
The final broad suite passes **1,577 tests** in 306,325.190167 ms with zero
failures/skips/cancellations.
The kit validates 95 required artifacts and the workflow token-scope audit passes.
Fifteen source/protected hashes and 34 exact action samples are in verification.
Focused tests overlap the broad selection; native selections are not the complete
PostgreSQL suite. Build/browser and the full delayed C22 protocol were not run.

The initial broad run passed 1,576 and failed one of 1,577 tests in
353,034.434083 ms: the existing development-original API inventory omitted
`putAndRead`. The expected method list was corrected and malformed-input,
denied-valid-input and closed-store assertions added, requiring zero SQL
connections and no recovered content. Only this unit test changed after native
journey verification; application and native harness code stayed identical.

**Progress remains 68% (17/25; eight remaining; +0 percentage points).**
No live model calls/spending, runtime GitHub artifact writes, records activation,
deployment/release, signatures or real-data deletion. Harness cleanup removes
only its owned disposable data. Protected artifacts, the unresolved 0289 recovery
observation and the user's untracked roadmap/outputs remain unchanged.

Next address remaining whole-action validation costs and complete the unchanged
benchmark. Real model quality, records adoption, governed runtime save/reopen and
signed-in human acceptance remain separate open requirements.
