# Intent capture delivery progress

## Current user-workflow tracker — version 2, 2026-09-10

The user explicitly resumed the loop at one-minute intervals after narrowing
the priority to intent capture, understanding, duplicate review, document
generation, and human review/approval. These eight milestones enumerate that
whole user-facing workflow; they do not add eight new features.

**Actual-application acceptance baseline, 2026-09-10: 0% (0/8 verified).**
This measures the usable end-to-end workflow, not implementation effort. Existing
code and test coverage remain; development is not restarting from zero. Actual
Chrome sign-in now reaches the workspace, but it explicitly reports draft
preservation, repository search and live-agent setup as unconfigured. No whole
workflow milestone below is available for acceptance yet. Do not carry forward
the historical 68% as actual-application acceptance.

| ID | User-visible workflow milestone | Acceptance evidence required | Status |
| --- | --- | --- | --- |
| W01 | Capture natural-language intent | Actual UI accepts free text without a mandatory questionnaire, preserves the submitted intent and can reopen it. | Partial UI only: free-text field present; preservation/reopen not configured |
| W02 | Understand intent and clarify only what is needed | Real agent responds to the submitted intent; necessary questions can be answered and the workflow continues without losing source context. | Blocked: live-agent connection disabled; Review my intent disabled |
| W03 | Check duplicates, overlap and related intent | Actual workflow searches permitted existing content, presents useful matches/evidence and uncertainty, and lets the user resolve the relationship without silent merging or false claims from incomplete search. | Blocked: repository search not configured; Check existing scope disabled |
| W04 | Generate Intent Brief | Real model produces a useful source-faithful Brief visible in the actual application, not a fixture or an unrelated preview. | Blocked upstream: no live drafting run |
| W05 | Generate Intent Spec | Real model produces a useful Spec consistent with the intent and Brief, visible in the same workflow. | Blocked upstream: no live drafting run |
| W06 | Generate Intent Exam | Separate fresh-context Test Agent produces a relevant Exam from the accepted source context; visible alongside Brief and Spec. | Blocked upstream: no live drafting run |
| W07 | Review and correct the documents | The user can read all three documents, make corrections and retain/reopen the resulting revision without losing their changes. | Blocked upstream: no generated/preserved document revision |
| W08 | Explicitly approve for implementation | The actual user approves the exact reviewed revision in STEER; the approval is retained and visible, and the user accepts the complete journey. Agents do not fabricate signatures or begin deployment. | Pending actual user review and acceptance; no approval inferred |

### Actual browser evidence — 2026-09-10

After the user completed the approved local password reset, sign-in returned to
the application but the gateway displayed `The request could not be served.`
The owned renderer had started on September 7; its on-disk build was dated
September 9. A direct diagnostic using synthetic display-only headers reproduced
HTTP 500 on that renderer, while a temporary fresh renderer of the same current
build returned HTTP 200. The diagnostic renderer was stopped afterward.

The verified owned gateway/renderer were gracefully restarted with the existing
profile and credentials. The actual Chrome tab then displayed `Your workspace.`,
organization `steer-local-idrissenayat`, and Org Admin, Product Lead and Product
Designer hats. The recovery-administrator browser session was signed out first.
No password, TLS trust, database schema, runtime grant or model budget was changed
by the restart. No model call or application GitHub write was made.

The same page explicitly reports that draft preservation, repository search and
live-agent setup are unconfigured. `local-workspace.mjs start` does not install
the managed intent-journey factory/policy binding or enable its editor/agent flags;
the private profile has no intent-journey binding. This is the next concrete
integration target, not the old C22 optimization work. The proposed D1 records
amendment remains unsigned/inactive; the $5 test budget does not adopt it.
Connect existing services within those boundaries; do not fabricate activation
authority or enable a second preview. Sign-in repair earns no W01–W08 points.

### Current reporting contract

After each verified completed increment report:

> Workflow acceptance: X% (N/8 verified; R remaining; +Y percentage points).
> Completed: user-visible behavior and actual evidence. Remaining: incomplete
> milestone IDs and any real blocker. Next: the immediate missing workflow step.

Percentage = verified milestones / 8 × 100, displayed to one decimal when needed
(12.5 points per milestone). Count actual-application acceptance, not files,
tests, commits, planning, synthetic outputs or hours. Mark partial work as
implemented/tested but not verified; an unchanged percentage is valid. Reopen a
milestone if it regresses. Do not claim 100% without the actual user's acceptance.
Keep these eight milestones fixed; scope changes require the user's direction
and an explicit versioned comparison. Report after meaningful completions or
blockers, not an unchanged notification every minute. The schedule can wake
every minute without spawning overlapping work or deliberately idling a live run.

Live OpenAI testing has an explicitly approved one-time **$5 USD total** cap,
shared across all loop runs, not $5 per run. Enforce it through durable budget
controls before calling the provider; count usage and outstanding/uncertain
reservations, stop at the cap and never auto-renew. Application GitHub writes,
deployment and other runtime/records prerequisites remain separate.

## Historical broader-delivery tracker — version 1

Established 2026-09-09. Retained without changing its 25-checkpoint denominator
or previous evidence. The following percentage is not the version 2 workflow
baseline, and its historical "next" statements do not control current work.

**Historical broader coverage: 68% — 17 of 25 acceptance checkpoints verified.**

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
| C22 | I5 Save/reopen | Measured provider request load and end-to-end latency satisfy documented human-UX acceptance thresholds on the representative journey. | Pending | [0329](../intent/0329/EVIDENCE.md) shares an exact draft phase through nested source/final/preview reviews with fresh permissions and full final native validation. Actual factory review/preview each use two draft-key reads. Final review falls 150→129, new-distinct preview/confirmation 265/685→230/615 and continuation 375/905→340/835. Preparation 277 and 517/472, drafting start 458/521/521, scope start 195/221/221 and outside-preview confirmation control 155 remain unchanged. Remaining confirmation/preservation and caller/read-set costs, the unchanged complete benchmark, live acceptance and the 0289 recovery observation remain open. |
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
| 2026-09-09 / 0299 | 17/25 | 68% | +0 percentage points | Test-only corpus protocol feasibility: 42 distinct physical files / 34 semantic sources match, with bounded dependency queries and 126 source-policy calls. Eight protocol and 130 shared-fixture tests pass; large documents require 63 attempts. Three follow-up checks use the actual OIDC/Git resolver: 33 cold, 31 next-request and 57 two-phase attempts, including bootstrap. Source metadata remains synthetic; HTTP/records and persistence-boundary costs are unproven. No production change or user-workflow acceptance. Next finish records/history and outer-boundary feasibility before coherent integration. |
| 2026-09-09 / 0300 | 17/25 | 68% | +0 percentage points | Test-only native records feasibility: 20 encrypted rows, exact source/prompt/predecessor/confirmation bindings, six SDK exchanges and full final readback use 22 simulated provider attempts including actual OIDC/Git grants. Boundary/unit and native journey tests do not establish full production policy/owner/effect integration or C22. No application optimization or live acceptance; next combine corpus/records and outer boundaries before coherent integration. |
| 2026-09-09 / 0301 | 17/25 | 68% | +0 percentage points | Test-only combined records/source graph: two revisions and three original contexts retain exact source/record/SDK checks while immutable-object sharing reduces this portion from 74 to 50 simulated attempts. Both native selections, 22 unique focused tests and final types pass. Production policies, final cross-component source closure, ownership and outer effect integration remain unproven; whole confirmation stays 7,637. No application optimization or completed checkpoint. |
| 2026-09-09 / 0302 | 17/25 | 68% | +0 percentage points | Test-only lifetime boundary: earliest first/final snapshot expiry remains effective through return; invalid/backward clocks, copied proofs and post-record expiry deny. Final native selection, 15 focused tests and all types pass; combined provider cost remains 52. No production installation, operational records acceptance or completed C22. |
| 2026-09-09 / 0303 | 17/25 | 68% | +0 percentage points | Application GitHub batch primitive with native inventory proof, existing restricted token lifecycle, bounded queries/streams and independent revision/path policies. Four references sharing two immutable objects use one content query in the component fixture. Corruption, late denial, refresh-time port changes and cancellation reject. No collector/factory switch, application speedup or completed C22; see exact verification scope in [evidence](../intent/0303/EVIDENCE.md). |
| 2026-09-09 / 0304 | 17/25 | 68% | +0 percentage points | Owned application-source corpus graph preserves current/historical canonical, candidate and amendment bytes, dependency order and final source closure after dependent records work. Cancelled work keeps admission until it drains. Native records/OIDC/Git selection passes at 53 simulated attempts for that portion; application confirmation remains 7,637. No factory switch, accepted allocation, live records adoption or completed C22. |
| 2026-09-09 / 0305 | 17/25 | 68% | +0 percentage points | Owned metadata-first records reader grants each group independently before ciphertext, requires full final row/lifecycle equality, and drains actual cancelled work. The corrected native corpus/records portion passes at 56 simulated attempts with the existing test crypto/SDK oracle; 30 focused tests and all types pass. Initial native null-budget rejection and correction are retained. No factory switch, production policy activation, UI improvement or completed C22; application confirmation remains 7,637. |
| 2026-09-09 / 0306 | 17/25 | 68% | +0 percentage points | Canonical production decoding and owned key access verify 20 native encrypted records against the SDK/crypto oracle, with 40 independent key grants and 52 simulated provider attempts for this portion. Forty-one focused and eighteen existing-store tests, native selection and all types pass. JSONB equality and enclosing final-caller lease regressions are retained with three prior native failures. No factory/profile switch, actual runtime save, UI improvement or completed C22. |
| 2026-09-09 / 0307 | 17/25 | 68% | +0 percentage points | Production SDK/worker and exact recorded scope-to-development lineage verification, with explicit pending/unknown/clarifying outcomes. Thirty-seven native isolation cases, 44 focused tests and types pass; the owned portion stays at 52 simulated attempts. No factory switch, application speedup, live authority or completed C22. |
| 2026-09-10 / 0308 | 17/25 | 68% | +0 percentage points | Owned corpus integrated into actual source-review and preparation constructors, with lazy loading, incomplete-search warnings and nested drain ownership. Synthetic source review drops to 75 attempts and the delayed draft/source prefix passes both directions; confirmation remains 7,087. Package composition boundaries are repaired. Full records/history integration, C22 and live acceptance remain open. |
| 2026-09-10 / 0309 | 17/25 | 68% | +0 percentage points | Owned current/history scope projections connected to actual drafting and confirmation paths under independent record/key grants, with exact metadata-only discovery and expiry protection. Synthetic scope read 227→25, drafting preparation 3,826→594, drafting start 7,871→1,407 and confirmation 7,087→3,823. Functional/equivalence evidence is not full C22 or live acceptance. |
| 2026-09-10 / 0310 | 17/25 | 68% | +0 percentage points | Owned development history connected to the actual factory with separately authorized retained scope verification and nested shutdown drain. Synthetic new-distinct preview 1,815→509 and confirmation 3,823→1,211; continuation preview 2,105→799 and confirmation 4,403→1,791. Exact history/negative/native evidence is in [0310](../intent/0310/EVIDENCE.md). Counts still exceed C22; no live activation or UI acceptance. |
| 2026-09-10 / 0311 | 17/25 | 68% | +0 percentage points | One private owned original/history phase spans dependent preview reads, with final independent record/key/source checks and forgotten-read drain. Synthetic preview falls 509→485 and confirmation 1,211→1,163; continuation 799→775 and 1,791→1,743. Both native journeys pass. This modest reduction does not close C22; surrounding review/preparation controls remain. |
| 2026-09-10 / 0312 | 17/25 | 68% | +0 percentage points | One lazy owned final-review phase replaces repeated full reviews within preview; complete final draft/source/scope comparison, fresh per-read authority and actual drain remain. Synthetic new-distinct preview falls 485→343 and confirmation 1,163→879; continuation 775→633 and 1,743→1,459. Both native save/recovery/reopen selections pass. Other read phases and preparation/start controls remain over budget; C22 and live acceptance stay pending. |
| 2026-09-10 / 0313 | 17/25 | 68% | +0 percentage points | Native destination inventory membership and exact nested-authorizer proofs remove redundant traversal without dropping source, target, lifecycle or final checks. Synthetic continuation preview falls 633→453 and confirmation 1,459→1,099; new-distinct remains 343 / 879. Both native save/recovery/reopen selections pass, with native/compatibility equality and negative coverage. C22 remains open; repeated current-source/draft and preparation/start controls remain next. |
| 2026-09-10 / 0314 | 17/25 | 68% | +0 percentage points | One lazy current-source review phase shares immutable initial state but freshly checks each consumer and fully reopens final draft/evidence. Synthetic preview drops by 13 attempts and confirmation by 26 in both directions; both native save/recovery/reopen selections pass. Complete final readback, late-change denial and actual callback drain remain. This small reduction leaves C22 open; action-level current-draft/authority and preparation/start composition remain next. |
| 2026-09-10 / 0315 | 17/25 | 68% | +0 percentage points | Metadata-only read-policy integration in both preparers and scope start preserves fresh policy/caller checks and full effect boundaries. Scope preparation falls 320→292, first scope start 596→406 and drafting preparation 594→532 attempts. Six new ordering/revocation/drainage tests and corrected native transport instrumentation cover the change. Development start/save counts are unchanged; C22 and live acceptance remain open. |
| 2026-09-10 / 0316 | 17/25 | 68% | +0 percentage points | Owned current-original scope-start reads share immutable state only within validation phases, with fresh independent authority and complete final records/key readback. Scope start falls 406→195 and recovery/repeat 460→221; changing observations/results are excluded. Native equivalence/revocation/drainage and current/history regressions pass alongside focused/broad/types checks and both synthetic save/reopen directions. Other starts, preparation and save actions remain above 200; C22 and live acceptance stay open. |
| 2026-09-10 / 0317 | 17/25 | 68% | +0 percentage points | Owned current-original drafting-start phases require distinct current discovery, exact source/profile/direction and fresh purpose grants through final scope/records/key closure. Drafting start falls 1,407→989, recovery/repeat 1,594→1,127. Native ordinary/owned equality, history-only denial and late-loss/drain tests cover the change; both synthetic save/reopen directions retain exact results. Ordinary first-policy order was restored after two regression failures. Counts still exceed 200; joint scope/original and caller consolidation plus the full benchmark remain. |
| 2026-09-10 / 0318 | 17/25 | 68% | +0 percentage points | Joint current-scope/original phases reduce full scope reads nine→six while retaining final development records/key comparison followed by final current scope under fresh purpose grants. Reordering alone regressed request counts; removing redundant no-IO permission calls brings final drafting start 989→938 and recovery/repeat 1,127→1,069. Native exact-source/status/subject and shutdown checks cover the joint boundary. This roughly 5% reduction is partial C22; all real-user acceptance remains separate. |
| 2026-09-10 / 0319 | 17/25 | 68% | +0 percentage points | Explicit current-source metadata queries retain every policy and fresh post-policy caller check while removing redundant pre-policy traversal only inside the exact authenticated scope window. Generic/history/different-caller paths remain full. Drafting start falls 938→699 and recovery/repeat 1,069→796, about 25%; full final records/key/scope and scheduler/drain boundaries remain. Other actions and full C22/live acceptance remain open. |
| 2026-09-10 / 0320 | 17/25 | 68% | +0 percentage points | Exact constructed current-scope readers lend one owned projection per drafting phase; final development records/keys precede complete scope records/keys with fresh policies and actual drain. Native scope-key reads halve twelve→six, drafting start falls 699→552 and recovery/repeat 796→628, about 21%. Wrapped/history paths remain unchanged. This is partial C22, not live UI or repository acceptance. |
| 2026-09-10 / 0321 | 17/25 | 68% | +0 percentage points | Exact guarded caller identity avoids a duplicate invocation at shared review boundaries; independent callers and all draft/evidence/policy checks remain. Save review falls 211→174; new-distinct preview/confirmation 330/853→293/779; continuation 440/1,073→403/999. Both native save/recovery/reopen paths pass. Partial C22 only; no full performance or live acceptance. |
| 2026-09-10 / 0322 | 17/25 | 68% | +0 percentage points | One exact current assessment lease per final review halves native key reads four→two. Final scope records/keys precede final draft/source closure; selected grants stay current through late IO. Save review falls 174→166, new-distinct preview/confirmation 293/779→285/763 and continuation 403/999→395/983. Eleven added native parity/late-denial/drain scenarios pass. Modest partial C22 improvement, not full performance or live acceptance. |
| 2026-09-10 / 0323 | 17/25 | 68% | +0 percentage points | Exact constructed review owners retain fresh before/after caller checks without extra wrapper brackets; independent, denied and unfinished checks remain fail-closed. Final review is 162, new-distinct preview/confirmation 277/747, continuation 387/967. Both native paths, 75 focused and 1,568 broad tests and types pass. This small reduction does not close C22; confirmation control outside previews still costs 193 attempts and whole-action read-graph consolidation remains. |
| 2026-09-10 / 0324 | 17/25 | 68% | +0 percentage points | Confirmation consumes preservation's verified readback without duplicate recovery; current checks and durable hold/expiry latching remain. Key lookups five→three initially and four→two on repeat, lifecycle updates four→two. Confirmation/recovery/repeat is 709/681/679 new-distinct and 929/901/899 continuation; outside-preview control 193→155. Forty-five native save checks, both native journeys, 27 focused/1,568 broad tests and types pass. C22 and live acceptance remain open. |
| 2026-09-10 / 0325 | 17/25 | 68% | +0 percentage points | Exact-parent metadata policies retain every independent purpose and one fresh caller before read-only consumption; source binding keeps that identity. Drafting start/recovery/repeat falls 552/628/628→458/521/521, about 17%, in both authenticated synthetic directions. Full final development records/keys still precede scope closure; unknown/history/different-parent callbacks retain ordinary checks. Both native journeys, nine native start checks, 58 focused/1,576 broad tests, types and kit/scope audit pass; eight new unit checks cover composition, denial and drainage. Other actions and C22/live acceptance remain open. |
| 2026-09-10 / 0326 | 17/25 | 68% | +0 percentage points | Both preparers consume one verified original restoration with separate put/read permissions and all final source/key/lifecycle checks. Native key lookups fall 11→7 initially and 10→6 on repetition. Scope preparation falls 292→280 and drafting preparation 532/487→520/475 in both synthetic journeys; other sampled counts are unchanged. Both native save/recovery/reopen directions, 26 original-store checks, 18 scope-preparation checks, 17 drafting-preparation checks, focused tests and types pass. Final regression scope is recorded in [evidence](../intent/0326/EVIDENCE.md). This modest reduction does not complete C22 or live acceptance. |
| 2026-09-10 / 0327 | 17/25 | 68% | +0 percentage points | Owned source-review draft phase retains one exact snapshot, fresh intermediate permissions and full final keys/rows/lifecycle/clock checks after dependent work. Three native reads use two key lookups instead of six. Source/save review falls 75/162→70/150; preview/confirmation is 265/685 new-distinct and 375/905 continuation. Both synthetic save/recovery/reopen directions, 18 native draft checks, 26 corrected original checks and focused/types checks pass; final regression scope is in [evidence](../intent/0327/EVIDENCE.md). Four 0326 hold/expiry cases previously passed through fixture errors and are now corrected with asserted successful transitions. This repairs evidence and advances partial C22, not live acceptance or another checkpoint. |
| 2026-09-10 / 0328 | 17/25 | 68% | +0 percentage points | Each preparation recheck owns one exact draft snapshot and full final key/row/lifecycle verification after evidence closure; separate phases precede admission, preservation and readiness. Native key lookups halve twelve→six, but request counts fall only 280→277 and 520/475→517/472. Both synthetic journeys, 39 native preparation checks including 36 successful late-change cases, 1,583 broad tests, focused checks and types pass. No new fixed checkpoint is complete; current caller-chain attribution must guide the next performance change. |
| 2026-09-10 / 0329 | 17/25 | 68% | +0 percentage points | One exact native draft phase spans nested source/final/preview reviews, with fresh consumer and draft permissions, complete final native validation and lexical close/drainage. Actual factory review/preview each use two draft-key lookups; ordinary-source parity uses ten. Final review falls 150→129, new-distinct preview/confirmation 265/685→230/615 and continuation 375/905→340/835. Both native journeys, thirteen final-key denial cases, 55 focused/1,589 broad checks and types pass. Remaining confirmation and caller/read-set costs still exceed C22; no new fixed checkpoint or live acceptance is complete. |

0328's [baseline attribution](../intent/0328/PROFILE.json) validates 45 actions and
10,445 identity attempts. At that revision, first confirmation is 685 requests: 470 identity checks
inside previews, 177 elsewhere and 38 repository requests. Neither hotspot alone
can meet 200. Next consolidate the combined review/preview and confirmation
controls while keeping separate effect phases, plus the over-budget drafting
start. No additional checkpoint or new completion forecast follows from this trace.

Next unblocked engineering checkpoint: C22, meet the documented request-load and
latency bounds without weakening current authority or recovery guarantees.
0301's [final-source follow-up](../intent/0301/FINAL-SOURCE-CLOSURE.json) rejects
source revocation after dependent records/key readback; the combined stage is now
52 attempts, including two added identity checks. Native/focused/type checks pass.
This remains partial C22: **68% (17/25; eight remaining; +0 percentage points)**.
0298 establishes that neither records-only nor body-only reductions can suffice:
the current per-file corpus protocol alone exceeds the whole-request ceiling.
Follow the [bounded correction sequence](../intent/0298/REQUEST-BUDGET-PLAN.md),
with 0299 covering corpus, 0300 records and 0301 the combined multi-revision graph.
0304 connects that primitive to the owned corpus collector and native records experiment.
0305 replaces the experiment's SQL reader with the owned production-source metadata-
first reader. Its independent per-group policies are still synthetic and its
cryptographic/SDK decoder remains a test oracle at that checkpoint. 0306 adds
canonical production decoding and invocation-owned independent key-policy access.
0307 adds production SDK/worker and exact recorded scope-to-development lineage.
0308 wires the current corpus into the actual source-review/preparation services.
0309 wires current/history scope projections with exact stage-specific discovery.
0310 wires retained development history with independent development and scope
read ownership; 0311 shares original/history reads across one private preview
phase and 0312 consolidates its repeated full final reviews. 0313 integrates native
destination membership and exact source/caller boundaries. 0314 consolidates
full source-review reconstruction with fresh per-consumption authority and full
final state/draft comparison. 0315 integrates metadata-only permission composition
in both preparers and scope start without weakening effect barriers. 0316 connects
owned current-original records reads to scope start with fresh phases around
scheduling. 0317 connects drafting-start originals with distinct current grants
and final current-scope/record/key-purpose checks in both directions. 0318 combines
scope/original phase ordering while preserving those final checks. 0319 composes
explicit current-source metadata queries inside that window; every policy and fresh
post-policy caller check remains. 0320 keeps one actual current-scope content lease
around each drafting phase, with final scope records/keys after development
records/keys, reducing drafting start to 552 and recovery/repeat to 628 attempts.
0321 preserves exact guarded caller identity in shared source-review phases; save
review falls to 174 and first confirmation to 779/999 in the two directions.
0322 keeps one native assessment lease through each final review, then closes
scope records/keys before final draft/source checks; review is 166 and first
confirmation 763/983. Selected scope record/key grants remain current through IO.
Remaining current-caller and records traversal across preparation/start/confirmation needs
consolidation before the whole-action benchmark. Preview optimization alone cannot
close C22 while the other interactive actions exceed the same ceiling.
0303 adds the actual adapter primitive for the upcoming integrated graph, with no
automatic collector switch and no reduction claimed for installed application actions.
0302 retains earliest snapshot expiry through return; it adds no provider calls
and does not establish operational hold/grant authority or application performance.
Finish complete lifecycle/authority closure, independent policy/key-provider and owned
outer-callback/effect boundaries before production integration. Preserve fresh
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
