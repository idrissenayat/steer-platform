# Intent 0292 execution evidence

Base: `26aa2a41010d1d318256bfcb5befed0415d7a46d`.
Progress: **68% (17/25; 8 remaining; +0 points)**. Partial C22, not live activation.

## Delivered change

One private metadata-policy helper is used by all five selected records owners.
Owners authenticate initially; every read policy then runs, completes with a void
result, and is followed by fresh caller validation before continuation. Policies
are permission-metadata only. No content fetching/transmission, key access, SDK
verification or effects belong in them. No identity/permission/result is cached.

Keys and SDK verification keep full before/after caller checks. Historical SDK
exchange verification explicitly remains on checked(). Historical/current private
bracket proofs, full scope windows, source/SQL/readback checks, scheduling/effects,
strict void outcomes, deadlines and four-call pending-work admission are unchanged.
Late closure/revocation/timeout denies; a prematurely resolving tracker cannot
grant a pending policy, and late rejections are observed after an early failure.

## Verification and measurements

The initial focused run passed 32/34 checks: two new owner-test expectations did
not account for the existing historical window's extra initial authentication.
Only those expectations were corrected; that stronger production check remains.
All **34 final focused checks** pass, including all five owners' revocation before
SQL/effects and timed-out admission until drain. All eight package types and
prototype types pass. The optimized Next.js 16.3.4 production build passes.

All **three authenticated joined checks plus idempotent migrations pass**. The
actual constructor graph uses 34 native sources, two scope batches, separate
Brief/Spec and Test Agent Exam roles, corrected documents/review, six synthetic
model calls/reservations, one confirmation original and one native save. Lost
acknowledgements, reconstructed idempotent recovery, restart, current policy/Git
revocation and exact older-commit reopening pass without resend or duplication.

| Action | 0291 attempts | 0292 attempts | Reduction |
| --- | ---: | ---: | ---: |
| Scope-result read | 337 | 227 | 32.64% |
| Initial drafting preparation | 6,516 | 4,756 | 27.01% |
| Repeated drafting preparation | 5,846 | 4,306 | 26.34% |
| Initial drafting start | 11,537 | 7,871 | 31.78% |
| Receipt-recovery/repeated drafting start | 12,992 | 8,866 | 31.76% |
| Save review | 1,326 | 1,106 | 16.59% |
| Preview | 7,309 | 5,501 | 24.74% |
| First confirmation, discarded reply | 14,829 | 11,213 | 24.38% |

Source review (317), scope preparation (1,250), scope start and draft-read counts
are unchanged. All first-confirmation savings are identity requests: 14,401 to
10,785; the same 428 repository requests still fetch/verify all sources. Two token
refreshes are included in the reconstructed confirmation sample (11,183), not
removed to improve counts. Repeated confirmation uses 11,181.

[Raw measurements](PERFORMANCE.json) retain all samples, source/harness hashes,
origin partitions and the prior baseline. Single undelayed local durations are
not warmed p95 or a reliable speedup claim. Measured action/preparation/start
samples did not overlap SQL/broad/build regressions. Later save/recovery/reopen
ran while those checks started; its 200 ms recovery duration is not comparable
latency evidence. Recovery returns committed with 17 requests, 14 SQL phases,
three valid clock observations, zero SQL failures and zero clock reversals.
The older 0289 recovery-unknown remains unexplained, not fixed by this passing run.

The delayed prefix was not rerun: its unchanged source-review boundary still
exceeds 200 before reaching these readers. The full repeated/cold/concurrent
protocol, complete C22, real-model quality, governed records/D1/runtime GitHub
activation and actual signed-in UI acceptance remain open. No credentials, live
model spending, runtime provider grants/writes, records adoption, signed sources,
gates, deployment, release or user data changed.

All **1,446 broad regression tests pass** (166,032.345 ms), with zero failure,
cancellation, skip or todo results. Four focused development-start SQL checks
plus idempotent migrations pass: exact retained source, missing/revoked grants,
holds/stale source, lost acknowledgement and post-dispatch denial retain their
original fail-closed/no-resend behavior.

All **10 historical-development SQL checks** and **82 scope-runtime checks** plus
their idempotent migrations pass. They cover current/historical records and SDK
verification, native preview/confirmation, exact retained lineage, late source/
key/caller loss, holds/quarantine, original-bound publication recovery, ordered
Temporal batches, no resend and cancellation with pending-work drain. These are
focused selections, not a claim that the full SQL suite was run.

All ten source/harness hashes, fourteen partitioned action/preparation samples,
nine start samples, 346 local Markdown links and the fixed 17/25 calculation
validate. The three protected signed-source hashes and the retained 0289 failure
artifact remain unchanged. Whitespace, 95-artifact kit and workflow-token scope
checks pass. Only owned disposable test PostgreSQL/native Git/Temporal data were
cleaned up; unrelated user work remains untouched and unstaged.
