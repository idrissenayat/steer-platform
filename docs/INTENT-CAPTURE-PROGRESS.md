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
| C22 | I5 Save/reopen | Measured provider request load and end-to-end latency satisfy documented human-UX acceptance thresholds on the representative journey. | Pending | [0298](../intent/0298/EVIDENCE.md) traces 45 authenticated synthetic HTTP invocations twice with identical identity counts. Confirmation remains 7,637 attempts. The unbatched corpus protocol alone has a 258-attempt lower bound, so history-only changes cannot meet 200. [Next](../intent/0298/REQUEST-BUDGET-PLAN.md): executable boundary/batch feasibility, coherent corpus/records read graph, all outer actions and complete benchmark. Diagnostic/plan only; no production optimization, latency or live acceptance. Prior delayed failure and unexplained 0289 recovery-unknown remain retained. |
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
| 2026-09-09 / 0288 | 17/25 | 68% | +0 percentage points | Partial C22: privately proven current-scope caller barriers remove 44.78% of initial drafting-start requests and 45.14% of receipt-recovery/repeated-start requests; 25 focused tests, four start-SQL checks, three default authenticated joined checks, 1,415 broad tests, types and build pass. No completed performance checkpoint or live acceptance is implied. |
| 2026-09-09 / 0289 | 17/25 | 68% | +0 percentage points | Partial C22: separate drafting-preparation evidence windows reduce the two-source native comparison from 70 to 52 requests. Twelve focused tests, 17 preparation checks, 40 save checks, three final authenticated joined checks, 1,416 broad tests, types and build pass. Managed preparation remains over budget. One earlier joined recovery-unknown result is retained; a passing rerun does not establish its root cause or a fix. |
| 2026-09-09 / 0290 | 17/25 | 68% | +0 percentage points | Recovery diagnostics: five focused tests, 40 final ordinary/delayed recovery repetitions, 40 candidate-save checks, 1,419 broad tests and all types pass. Clock traces show no reversal in 920 final observations. The 0289 failure did not reproduce; no root cause, production fix, new performance result or acceptance checkpoint is claimed. |
| 2026-09-09 / 0291 | 17/25 | 68% | +0 percentage points | Partial C22: flattened metadata-only policy traversal and exact immutable Git membership reduce source-review attempts by 87.97%, scope preparation by 86.98% and first confirmation by 67.56%. The final authenticated synthetic journey, 1,430 broad tests, types and build pass. No real UI, model-quality, runtime GitHub or complete performance acceptance is claimed. |
| 2026-09-09 / 0292 | 17/25 | 68% | +0 percentage points | Partial C22: deeper records metadata-policy traversal reduces first confirmation by 24.38%, preview by 24.74% and initial drafting start by 31.78%. The authenticated synthetic save/recovery/reopen, 34 focused tests, 1,446 broad tests, types and build pass. Source review remains above budget; no complete performance or live acceptance is claimed. |
| 2026-09-09 / 0293 | 17/25 | 68% | +0 percentage points | Partial C22: canonical source traversal reduces source review from 317 to 232 requests and scope preparation from 1,250 to 932; draft callbacks retain admission until they actually drain. The authenticated synthetic journey, 54 focused tests, 17 preparation SQL checks, 1,456 final broad tests, types and build pass. Delayed source review still exceeds its 200-request ceiling in both directions; no complete performance or live acceptance is claimed. |
| 2026-09-09 / 0294 | 17/25 | 68% | +0 percentage points | Partial C22: proven catalog forwarding reduces source review from 232 to 210 requests, scope preparation from 932 to 844 and first confirmation from 10,483 to 10,307; actual child callbacks retain parent admission. The authenticated synthetic save/recovery/reopen, 73 focused tests, 1,462 final broad tests, types and build pass. Full performance and real-user acceptance remain open; prioritize whole-path records/history consolidation over source-only increments. |
| 2026-09-09 / 0295 | 17/25 | 68% | +0 percentage points | Partial C22: shared retained-original history reads remove 100 preview and 200 confirmation requests (about 2%) with fresh key/lifecycle/authority checks and full final readback. The authenticated synthetic save/recovery/reopen, 40 final focused tests, eight final native records checks, 1,468 broad tests, types and build pass. This small reduction does not resolve the whole-path bottleneck; performance and live acceptance remain open. |
| 2026-09-09 / 0296 | 17/25 | 68% | +0 percentage points | Partial C22: explicit historical source-policy composition removes 940 preview and 1,880 confirmation requests (about 19%), retaining every source query, fresh caller validation and full final reads. The authenticated synthetic save/recovery/reopen, 65 focused checks, eight native records checks, 1,583 expanded broad tests, 233 supplemental tests, 88 prototype tests, types and build pass. Both repeated source-body reads and authority/records validation remain to consolidate; C22/live acceptance are open. |
| 2026-09-09 / 0297 | 17/25 | 68% | +0 percentage points | Partial C22: shared read-only corpus sessions reduce repository-body downloads by 75% across each preview and confirmation, preserving fresh authority and separate sessions after writes. Total preview/confirmation requests fall about 7% to 3,722 / 7,637. The authenticated synthetic save/recovery/reopen, 46 focused tests, 40 native save checks, 1,381 package/application tests, 88 prototype tests, types and build pass. Identity/records traversal remains the principal gap; full performance and live acceptance remain open. |
| 2026-09-09 / 0298 | 17/25 | 68% | +0 percentage points | Diagnosis/plan: two authenticated synthetic profiles preserve all 45 HTTP calls and identical identity counts. Scheduling origins identify scope/history/preview/control costs; current per-file corpus protocol alone has a 258-call lower bound against 200. No production change. Next is the executable boundary/batch feasibility experiment, then one coherent corpus/records correction and full benchmark. |

Next unblocked engineering checkpoint: C22, meet the documented request-load and
latency bounds without weakening current authority or recovery guarantees.
0298 establishes that neither records-only nor body-only reductions can suffice:
the current per-file corpus protocol alone exceeds the whole-request ceiling.
Follow the [bounded correction sequence](../intent/0298/REQUEST-BUDGET-PLAN.md),
starting with an executable boundary/batch feasibility experiment. Preserve fresh
authority, all policies, final readback and separate phases across effects. No
proposed budget or additional test result earns a checklist point.
The retained 0289 already-sent recovery-unknown observation also needs investigation;
its final rerun and existing synthetic C20 checks pass, but its cause is not known.
[0290](../intent/0290/EVIDENCE.md) adds bounded reproduction/clock diagnostics;
40 final ordinary/delayed repetitions do not reproduce it. No production fix or
new checkpoint is claimed; keep diagnostics available during performance work.
Eight checkpoints remain in total: performance, governed records/runtime activation,
real model quality and signed-in human acceptance. Live model/activation work still
requires its specific prerequisites; it is not authorized by this progress update.

The [delivery ledger](PHASE-1-DELIVERY.md) records individual increments. Updating
this reporting document itself earns no completion points.
