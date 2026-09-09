# Intent capture delivery progress

Checklist version: 1. Established 2026-09-09 at the user's request.

**Overall: 68% — 17 of 25 acceptance checkpoints verified.**

This measures completion of the fixed delivery checklist below, not elapsed time,
remaining engineering effort, production readiness or the number of tests/commits.
Each checkpoint contributes four percentage points. Component and synthetic
integration verification are explicitly distinguished from real-user acceptance;
the latter remains pending. The actual authenticated application journey in
[the intent journey plan](INTENT-JOURNEY-PLAN.md) is still the completion target.

## Reporting contract

After every verified completed increment, report:

> Intent capture: **X% (N/25 checkpoints; R remaining; +Y percentage points)**. Completed:
> [capability and verification level]. Next: [next incomplete capability].

If an increment improves part of an incomplete checkpoint, report the same overall
percentage and a zero-point change. Extra tests, documentation, refactors and
performance improvements do not independently earn points. Work in progress does
not count. Regressions reopen the affected checkpoint and can reduce the percentage.
Keep this denominator fixed; a genuine scope change needs a documented version,
reason and rebased comparison, not a silent increase or new optimistic estimate.
Do not claim 100% until all real signed-in UI and saved-repository checks pass.

## Fixed acceptance checklist

“Verified” means the evidence satisfies the specific level stated in that row.
“Pending” includes partial implementation and missing activation or acceptance;
it does not imply that no code exists.

| ID | Plan area | Acceptance checkpoint and required verification level | Status | Evidence / remaining work |
| --- | --- | --- | --- | --- |
| C01 | I1 Capture/review | Actual application's free-text capture and conversational components preserve the user's source; component verification. | Verified | [0198](../intent/0198/EVIDENCE.md), [0230](../intent/0230/EVIDENCE.md). Not a browser acceptance claim. |
| C02 | I1 Capture/review | Permitted repository corpus, exact provenance and incomplete-search safeguards; native integration verification. | Verified | [0232](../intent/0232/EVIDENCE.md), [0279](../intent/0279/EVIDENCE.md). |
| C03 | I1 Capture/review | Multi-batch scope review, exact citations and retained combined assessment; recorded integration verification. | Verified | [0242](../intent/0242/EVIDENCE.md), [0276](../intent/0276/EVIDENCE.md). |
| C04 | I1 Capture/review | Representative, independently adjudicated duplicate, paraphrase, partial-overlap and related-intent quality evaluation with an authorized real model. | Pending | [0250](../intent/0250/EVIDENCE.md) is a synthetic evaluator, not model-quality evidence. |
| C05 | I2 Disposition | Explicit human direction, reason and exact target in the actual editor, with stale-choice invalidation; component/API verification. | Verified | [0201](../intent/0201/EVIDENCE.md), [0230](../intent/0230/EVIDENCE.md). No automatic merge/create. |
| C06 | I2 Disposition | Server-verified assessment and exact human direction reach both separate drafting roles; recorded integration verification. | Verified | [0248](../intent/0248/EVIDENCE.md), [0276](../intent/0276/EVIDENCE.md). |
| C07 | I2 Disposition | Authenticated pre-pull candidate revision through confirmation, one native save and exact old/new reopen, preserving prior files. | Verified | [0280](../intent/0280/EVIDENCE.md): revision and default joined selections, 1,369 broad tests, types and build pass. Synthetic authority, not live GitHub/UI. |
| C08 | I2 Disposition | Authenticated new-linked direction through confirmation, one native save and exact reopen with preserved relationship. | Verified | [0281](../intent/0281/EVIDENCE.md): linked/default joined selections, 1,371 broad tests, types and build pass. Linked source is unchanged; relationship stays pinned. Synthetic authority, not live GitHub/UI. |
| C09 | I2 Disposition | Authenticated first amendment through confirmation, one native save and exact reopen without replacing canonical artifacts. | Verified | [0282](../intent/0282/EVIDENCE.md): first-amendment/default joined selections, 1,372 broad tests, types and build pass. Existing canonical and hidden-context blobs stay unchanged; original proposal target survives exact reopen. Synthetic authority, not live GitHub/UI. |
| C10 | I2 Disposition | Authenticated proposal continuation through confirmation, one native save and exact reopen with original target/parent checks. | Verified | [0283](../intent/0283/EVIDENCE.md): continuation/default joined selections, 1,373 broad tests, types and build pass. Only the selected proposal pointer advances; canonical/prior proposal files and original target are preserved, with exact old/new reopen. Synthetic authority, not live GitHub/UI. |
| C11 | I3 Drafting | Ordered Architect Brief/Spec and separate Test Agent Exam with full permitted source context; recorded workflow verification. | Verified | [0276](../intent/0276/EVIDENCE.md). Model responses remain synthetic. |
| C12 | I3 Drafting | Focused clarification stops generation until answered and resumes with source/review invalidation; actual-component verification. | Verified | [0230](../intent/0230/EVIDENCE.md), [0238](../intent/0238/EVIDENCE.md). |
| C13 | I3 Drafting | Durable run/cost reservation, refusal handling and retry/replay without duplicate model dispatch; synthetic integration verification. | Verified | [0198](../intent/0198/EVIDENCE.md), [0235](../intent/0235/EVIDENCE.md), [0276](../intent/0276/EVIDENCE.md). No spending approval is implied. |
| C14 | I3 Drafting | Approved capped live-model run produces source-faithful useful Brief, Spec and independent Exam, with content-quality acceptance. | Pending | Model budget/activation and real output evaluation remain open. |
| C15 | I4 Review/recovery | Actual editor supports all three documents, human corrections, source linkage and downstream invalidation; component/API verification. | Verified | [0204](../intent/0204/EVIDENCE.md), [0230](../intent/0230/EVIDENCE.md), [0275](../intent/0275/EVIDENCE.md). |
| C16 | I4 Review/recovery | Encrypted draft/history, retained originals and restart/lost-acknowledgement recovery; joined synthetic integration verification. | Verified | [0251](../intent/0251/EVIDENCE.md), [0258](../intent/0258/EVIDENCE.md), [0275](../intent/0275/EVIDENCE.md). |
| C17 | I4 Review/recovery | Current records/source/key/hold restrictions suppress unsafe reads and preserve immutable originals; synthetic integration verification. | Verified | [0270](../intent/0270/EVIDENCE.md), [0279](../intent/0279/EVIDENCE.md). Does not include operational records adoption or late-recovery resolution. |
| C18 | I4 Review/recovery | Governed real records/D1/lifecycle/clock adoption and constrained late/quarantined-outcome recovery, with runtime ownership and recovery acceptance. | Pending | [Runtime guide](AUTHENTICATED-INTENT-RUNTIME.md). D1 remains unsigned/inactive; clock and late recovery are incomplete. |
| C19 | I5 Save/reopen | Authenticated new-distinct exact confirmation and atomic idempotent native save, with current scope/authority checks. | Verified | [0275](../intent/0275/EVIDENCE.md), [0276](../intent/0276/EVIDENCE.md). Synthetic authority, not live GitHub. |
| C20 | I5 Save/reopen | Uncertain save, scheduler/provider lost replies and restart reconcile without resend; exact older-commit reopen through authenticated services. | Verified | [0275](../intent/0275/EVIDENCE.md), [0276](../intent/0276/EVIDENCE.md). |
| C21 | I5 Save/reopen | Governed actual startup, current runtime GitHub write authority and a verified real repository save/reopen. | Pending | Source-code pushes are not application saves or runtime-write authorization. |
| C22 | I5 Save/reopen | Measured provider request load and end-to-end latency satisfy documented human-UX acceptance thresholds on the representative journey. | Pending | [0287](../intent/0287/EVIDENCE.md) lowers scope preparation to 9,598 requests (15.55% reduction); source review and first confirmation stay at 2,634 and 45,716. The [benchmark prefix](INTENT-CAPTURE-PERFORMANCE.md) still fails source review at the 200-attempt target; only draft-read targets passed previously. Later-stage, full failure/concurrency and issuer-latency coverage remain open. This remains unacceptable request load, not C22 completion. |
| C23 | I6 Human acceptance | Actual signed-in UI happy path, open-existing, exact/paraphrased duplicate, partial overlap and related-but-distinct scenarios; real sources and saved commits. | Pending | No preview, fixture or component-only result substitutes for this demonstration. |
| C24 | I6 Human acceptance | Actual UI handles empty/failed/stale search, corrections, permission loss, exhausted budget, concurrent creation, uncertain save and refresh/reopen without lost work. | Pending | Component/negative tests inform but do not complete this real journey. |
| C25 | I6 Human acceptance | Actual end-to-end keyboard, narrow-screen and accessibility verification, followed by the user's usable-journey acceptance. | Pending | Component axe checks do not establish browser/visual or human acceptance. |

## Progress history

| Date / checkpoint | Verified | Overall | Change | Basis |
| --- | --- | --- | --- | --- |
| 2026-09-09 baseline through 0279 | 13/25 | 52% | Baseline, not a new capability | Evidence-backed component and joined synthetic results above; no live UI acceptance. |
| 2026-09-09 / 0280 | 14/25 | 56% | +4 percentage points | C07: authenticated existing-candidate revision/save/reopen with prior-file preservation; both joined selections and final broad regression pass. |
| 2026-09-09 / 0281 | 15/25 | 60% | +4 percentage points | C08: authenticated new-linked save/reopen with unchanged source and exact relationship; linked/default joined selections and final broad regression pass. |
| 2026-09-09 / 0282 | 16/25 | 64% | +4 percentage points | C09: authenticated first-amendment save/reopen with unchanged canonical artifacts and preserved original target; amendment/default joined selections and final broad regression pass. |
| 2026-09-09 / 0283 | 17/25 | 68% | +4 percentage points | C10: authenticated proposal-continuation save/reopen with exact parent advancement and original target/canonical/prior-file preservation; continuation/default joined selections and final broad regression pass. |
| 2026-09-09 / 0284 | 17/25 | 68% | +0 percentage points | Partial C22: private identical-caller proof removes about 19% of preview/confirmation requests; default/continuation and historical SQL selections pass, followed by final receiver-compatibility, 1,382 broad tests, types and build. Exact verification timing is recorded; latency-bearing acceptance remains open. |
| 2026-09-09 / 0285 | 17/25 | 68% | +0 percentage points | Partial C22: executable authenticated delay/budget prefix, retained samples and correct failed-benchmark reporting; two prefix integrity checks, default joined regression, 1,387 broad tests, types and build pass. Source review exceeds the request limit; full performance acceptance remains open. |
| 2026-09-09 / 0286 | 17/25 | 68% | +0 percentage points | Partial C22: private nested-read proof removes 13.41% of source-review and 6.66% of confirmation requests; 58 focused tests, final default joined regression, two prefix integrity checks, 1,399 broad tests, types and build pass. The source-review limit still fails; no live acceptance or completed checkpoint is implied. |
| 2026-09-09 / 0287 | 17/25 | 68% | +0 percentage points | Partial C22: separate read-only scope-preparation windows remove 15.55% of requests without crossing admission/persistence effects; nine focused tests, 82 scope-runtime checks, three default authenticated joined checks, 1,406 broad tests, types and build pass. Source review, confirmation and drafting-start counts remain unchanged; no whole checkpoint or live acceptance is complete. |

Next unblocked engineering checkpoint: C22, meet the documented request-load and
latency bounds without weakening current authority or recovery guarantees.
Eight checkpoints remain in total: performance, governed records/runtime activation,
real model quality and signed-in human acceptance. Live model/activation work still
requires its specific prerequisites; it is not authorized by this progress update.

The [delivery ledger](PHASE-1-DELIVERY.md) records individual increments. Updating
this reporting document itself earns no completion points.
