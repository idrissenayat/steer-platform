# Intent 0289 execution evidence

Status: increment verified; performance acceptance incomplete. The final joined
rerun passes, but one earlier recovery-unknown observation remains unexplained.
Base: `43f7b6a9e43c741cdb6d700792c895370abddb27` (0288).
Progress: 68% (17/25; 8 remaining; +0 points). No real UI/live-provider or
performance acceptance is claimed. Existing credential provisioning/reuse is
resolved; the first live-model budget remains unapproved. Tests stay synthetic.

## Implemented boundary

The actual owned journey installs the existing private corpus read-session hook
in drafting preparation. Each of the three source/policy/source validation pairs
gets its own read-only session. Initial acquisition remains full, and the next
session recollects full evidence after admission or original persistence. All
assessment, human-direction, current records/draft/source and exact-equality checks
remain. No session encloses admission, original put/readback, scheduler/model work
or Git writes. The hook is pinned for the operation; no caller input or runtime
activation option can install it.

The existing preparation helper owns pending wrapper/work/reads, rejects skipped,
replayed, early or nonvoid completion and preserves owner conflict identity through
corpus error sanitization. It is unchanged in this increment. The full no-hook
fallback remains available. Deadlines, authority and recovery are not extended.

## Verified so far

- All 12 focused preparer/helper/selector tests pass (146.639 ms).
- Prototype and all eight package typechecks pass (2.389 s); optimized Next.js
  16.3.4 build passes. The first typecheck found an explicit-undefined optional
  hook in the test fixture; the fallback now omits the hook, and the rerun passes.
- Explicit `--development-prepare` passes 17 preparation/source-review/discovery
  HTTP/encrypted-SQL checks plus idempotent migrations. This is not the full SQL
  suite. The native two-source comparison produces the same immutable original
  with eight rather than fourteen body reads and 52 rather than 70 provider
  requests (25.71% fewer requests). It creates one operation/original, no model
  reservations and no provider save; the repeated fallback preserves those counts.
- Native boundary cases prove three read sessions close before admission and
  persistence, reopen with fresh body reads after each effect, deny final grant
  loss and malformed callbacks before admission, and return uncertainty on
  post-effect source drift without changing existing originals or resending.

## Managed drafting-preparation measurements

The actual authenticated 34-source factory's final run records initial preparation
at 20,130 requests / 14,868 ms, and repeated preparation at 18,790 requests /
13,562 ms. The first run records the same counts at 15,137 / 13,600 ms.
Identity accounts for 19,586 / 18,246 requests; repository acquisition accounts
for 544 in each. Each log retains method-category and transport-origin partitions.
These are single undelayed synthetic measurements, not warmed p95 or a reliable
latency speedup. The managed preparation counts were not recorded before 0289;
there is no managed before/after reduction claim. The native 70-to-52 comparison
above has a different fixture and must not be extrapolated to this larger path.

Both managed preparation counts remain far above the fixed 200-attempt budget.

## Retained failure and final joined rerun

The first joined run passed the two managed draft checks, separate role generation,
corrections, confirmation recovery, one native commit and read-only authenticated
receipt recovery. It then failed at the separate durable-store recovery assertion
(`authenticated-candidate-save.integration.ts:248` before diagnostic changes):
`compareAndWrite` returned `unknown`, expected `committed`, for the already-sent
operation. No duplicate native save occurred before the failure. Exact older-commit
reopen was not reached. The failed sample is retained, not a full joined pass.
Bounded, content-free SQL phase/request diagnostics are added to identify a repeat;
the production recovery boundary and all assertions remain unchanged.
The separate `--candidate-save` selection then passed all 40 admission/original/
HTTP/Temporal/native-Git checks plus idempotent migrations, including lost-ACK
recovery, no redispatch, reconciliation, expiry and cancellation. The complete
authenticated journey was rerun with diagnostics; the failure's cause is
not established. Types pass after the diagnostic-only change (1.148 s).

The final `--journey-runtime` rerun passes all three joined checks plus idempotent
migrations, including six synthetic model calls/reservations, one confirmation
original, one native commit, lost scheduler/provider/HTTP responses, reconstruction,
separate reconciliation, exact older-commit reopen and current policy/Git denial.
The instrumented already-sent recovery returned committed in 220 ms, with 17
provider requests, 14 database phases, zero database failures and no extra Git
write. No production recovery code changed. A passing rerun is not evidence that
the earlier unknown outcome was fixed; its root cause remains an explicit
follow-up. [Raw measurements](PERFORMANCE.json) retain both runs and the diagnostic.

All twelve corrected-package request counts and their origin partitions match
0288, as do the three drafting-start totals (23,064 / 25,974 / 25,974). Source
review still has 2,634 requests, so the previously failed delayed
prefix remains blocked upstream of the changed preparation boundary; it is not
rerun or claimed to pass in this increment.

## Final verification and limits

All **1,416 broad regression tests pass** (148,112.013 ms; zero failures,
cancelled, skipped or todo tests). The 12 focused tests, 17 preparation checks,
40 candidate-save checks, three final joined checks, prototype/eight-package types
and optimized build pass on the final production code. Each of the four SQL runs
also passed idempotent migration verification; one joined run still failed as
recorded above. The 95-artifact kit and read-only workflow-token audit pass.
All 326 checked local document links, 15 source/harness hashes, 28 sample origin
partitions, unchanged request-count comparisons, private helper exports and the
fixed 17/25 calculation pass. Architecture, canonical Exam and HR-01-R2 hashes
remain unchanged. Whitespace checks pass; unrelated user files stay untouched.

Each SQL run removed only its own synthetic PostgreSQL container and tmpfs data;
no live user data was removed. Other full dispositions, full historical/full SQL,
real models/providers and actual signed-in UI acceptance were not run. No live
configuration, credentials, model spending, runtime GitHub grant/write, records/D1
adoption, gate/signature, deployment or release changed. Next investigate the
retained recovery observation and reduce repeated identity-policy traversal before
the complete delayed performance protocol. **68% (17/25; 8 remaining; +0 points)**.
