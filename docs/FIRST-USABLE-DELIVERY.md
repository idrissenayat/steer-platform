# First usable STEER journey

Delivery priority agreed by the user on 2026-09-06 in the status-report task.
This is an execution-focus document, not a replacement for the signed Brief,
architecture, Exam, gate records or retention policy. The active build task
owns implementation and incorporation into the live delivery ledger.

## Outcome

One human in one approved pod can sign in, describe real work, correct and
confirm its Brief, see the exact artifact saved to GitHub and appear on the
board, and open a decision tied to that revision inside STEER.

## Acceptance checklist

The starting-evidence column below and the original hour ranges are historical.
Use the latest development audit below and `docs/PHASE-1-DELIVERY.md` for current
implementation status; neither is an assertion that the real five-step journey passed.

| Step | Observable acceptance | Starting evidence / remaining gap |
|---|---|---|
| Sign in | The intended human signs into the configured workspace and sees the correct organization and permitted role. | Local Keycloak/browser/session integration exists; confirm approved real membership and runtime configuration. |
| Describe and confirm | Guided authoring produces a source-faithful Brief, surfaces missing facts and lets the human correct and confirm the exact proposed content. | Prototype interview logic exists; production authoring, conversation composition and provider prerequisites need a current code audit. |
| Save once | Confirmation creates the authorized Git artifact; the UI reports its actual revision. Duplicate requests, revoked permissions and stale revisions cannot silently create a second or unauthorized write. | Read-only GitHub check exists; production write contract, runtime composition and action-time authorization remain to be completed. |
| See the work | The saved artifact appears on the authenticated board; refresh/restart preserves it and its revision agrees with Git. | Ingestion, snapshots and read-only Brief library exist; connect the production board to this creation path. |
| Review | The user opens a decision with the matching Brief, evidence and current status. Any enabled decision action independently enforces applicable identity, revision and gate requirements. | Prototype decision views and internal policy checks exist; production inbox and authenticated decision-proof composition remain. |

The full journey must be demonstrated with real approved configuration before
calling it usable. Isolated test runs prove development progress only. Record
the tested commit, actual artifact revision, browser evidence and material
limitations. A read-only preview may be demonstrated earlier and labeled as such.

## Next execution sequence

1. At the next safe work boundary, audit these five steps against current code.
   List missing implementation, required verification and external dependencies
   separately. Reuse existing packages and tests.
2. Produce a bounded work breakdown for this journey, with effort ranges,
   assumptions and confidence. Separate engineering effort from review and
   user/provider waiting time; do not invent a launch date from test counts.
3. Select the first missing development slice that advances the journey and
   can proceed under existing authorization. Continue implementation without
   waiting for an additional generic instruction to continue.
4. Map each outstanding assurance requirement to this journey or its existing
   release obligations. Preserve all five formal R5 findings. Prepare a concrete
   scope-change proposal if broader lifecycle capabilities could be deferred;
   do not defer signed requirements or waive findings through this document.
5. Update the main delivery ledger with this priority and report user-visible
   progress, the next demonstrable capability and the current forecast.

## Completion and scope boundaries

Gate 2 still gates live writes; release remains subject to the existing release
and Gate 3 requirements. Required privacy, security, accessibility, retention and
authorization evidence remains required. This priority change grants no new
provider access, spending, protected edits, signatures or deployment authority.

Development should prioritize the first journey and its necessary prerequisites.
Additional assurance work should identify the specific requirement it closes
and whether it blocks development, live use or release. The 90-day outcome
measurement window follows an approved release; it does not delay first use by
90 days. Calendar commitment is pending the bounded work breakdown above.

## Code audit and bounded forecast — 2026-09-06

### Latest development audit — increment 0191

The dependency-ordered current route is `docs/JOURNEY-REMAINING-WORK.md`.
0191 exposes source coverage in the production review workspace and Brief dialog.
Checks remain manual, exact-revision and read-only, without inferred lifecycle or
approval. Verification is recorded in `intent/0191/EVIDENCE.md`.
0190 adds bounded exact-revision Spec/Exam/Plan projection coverage. This is backend
source inventory with unknown stage, not verified lifecycle inputs or a connected
board. Verification and limitations are recorded in `intent/0190/EVIDENCE.md`.
0189 adds direct read-only review-record inspection in the production workspace.
It does not claim an assigned/actionable Inbox or authoritative lifecycle stage.
Verification and remaining limits are recorded in `intent/0189/EVIDENCE.md`.
0188 joins exact signed historical selector-session evidence and both grant eras
in the held collector and HTTP runtime. Actual service ownership/issuance and full
authority remain external prerequisites; local evidence is in `intent/0188/EVIDENCE.md`.
0187 adds historical/current selector grant binding, signed issuer/type/history
coordinates, current revocation and final grant-expiry checks. This does not prove
actual selector login or approved bootstrap; held writes remain denied. See
`intent/0187/EVIDENCE.md` for verification status.
0186 adds optional signed selection evidence, bound to exact manifest/configuration,
platform/decision and independently pinned trust/proof bytes in current Git collection.
It verifies selected-key claims, not actual bootstrap approval or selector authority.
The held writer still denies. See `intent/0186/EVIDENCE.md` for verification status.
Increment 0174 adds an owned fixed-operation Temporal start/status client with
uncertain-start recovery and connection draining. It is not installed live and
does not supply dispatcher authority or automatic receipt/path admission.
0175 adds a shared current-agent dispatch/current-caller status boundary with
separate explicit grants. It is not installed in the live identity runtime and
does not grant saving, approve receipt provenance or admit new paths.
0176 supplies an explicit opt-in runtime/factory pair with exact operation binding
and request-draining ownership. No live profile/factory is installed; approved real
dispatcher/cluster binding and governed receipt/path admission remain separate.
0177 joins signed current dispatcher authorization to actual created-Brief status
readback and exact Git/PostgreSQL projection in the same disposable scenario.
Provider responses and human/gate/projector authority remain synthetic; this is not
the approved real-user journey or an actual Keycloak dispatcher pass.
0178 replaces direct dispatch in the separate actual-Keycloak browser-created
journey with the owned runtime and fresh service-account tokens/current Git grants.
Its gate authority and projector principal remain synthetic. Execution evidence is
in `intent/0178/EVIDENCE.md`; no approved real-user save or live binding is inferred.
0179 replaces the durable worker's projector principal with a distinct actual local
Keycloak client and current Git authorizer. Early cross-permission, revocation and
token-substitution negatives are part of the same journey; results are in
`intent/0179/EVIDENCE.md`. Gate authority is still synthetic in the creation fixture.
0180 checks revocation after an actual browser receipt read and, separately, failed
workflow status after owned-runtime reconstruction. Failure remains observable but
cannot be retried through normal start. Controlled projection recovery is still open;
see `docs/RECORDED-PROJECTION-FAILURES.md` and `intent/0180/EVIDENCE.md`.
0181 adds a separate internal recovery workflow tied to the exact failed original
run. It rechecks that original and current projector while reusing exact receipt/SQL
idempotency. Public recovery permission, managed client and live runtime remain absent;
see `docs/CONTROLLED-PROJECTION-RECOVERY.md` and `intent/0181/EVIDENCE.md`.
0182 supplies separate shared recovery/status permissions and an owned fixed-plan
client with one-attempt admission, uncertainty readback and draining cleanup. No
recovery service is installed by default; identity runtime integration and approved
live bindings remain open. Exact verification is in `intent/0182/EVIDENCE.md`.
0183 adds an exact optional recovery runtime profile/factory and request-drained
ownership. Signed synthetic recovery identity/current native Git grants now feed
the actual runtime/Temporal/Git/PostgreSQL integration; projector identity stays
separate. Actual Keycloak recovery and approved live configuration remain open.
Exact verification is in `intent/0183/EVIDENCE.md`.
0184 verifies this recovery path with actual disposable Keycloak recovery/projector
accounts and current Git grants, including swapped tokens and post-receipt revocation.
GitHub/receipt provenance remains synthetic in that isolated case. Joining recovery
to the browser-created recorded receipt is next; no live activation follows from
this result. Exact verification is in `intent/0184/EVIDENCE.md`.
0185 adds a separate browser recovery mode using the actual disposable browser-save
status callback. It fails the original through post-receipt projector revocation,
then joins a separate Keycloak recovery identity to the exact failed run. The normal
successful projection scenario is preserved. Verification status is recorded in
`intent/0185/EVIDENCE.md`; synthetic GitHub/full gate authority and live-use limits remain.

The production UI now supports deterministic describe/correct, exact local review,
manual prior-operation status and opening the exact recorded Brief. Disposable
integration connects actual Keycloak/encrypted PostgreSQL sessions, native Git
operation history, receipt-to-source verification and curated projection ingestion.
An owned single-flight job now joins authenticated human status readback to a
separately authorized projector, with current-identity checks and draining shutdown.
An explicit lazy runtime now owns the real bounded PostgreSQL projector pool for
that connection; live dispatch and automatic path admission remain absent.
The existing Brief library now exposes a revision-linked projected work list with
exact source metadata. It is not an authenticated lifecycle board or decision inbox.
These capabilities do not establish a real authorized save or agent conversation.

An additional opt-in integration now starts with actual HTTP preview/save calls,
creates the Brief/marker in disposable native Git, reconstructs status and projects
that receipt into PostgreSQL. It does not seed the saved pair. This closes a
mechanical integration gap, but its identity/full-authority callbacks are explicit
test doubles. Increment 0167 separately adds actual browser-created operation history,
with real local Keycloak membership but explicitly synthetic full gate authority.
Neither substitutes for an approved real-member, fully governed save journey.

The Brief dialog now also offers manual read-only decision inspection. The shared
tool re-reads the exact Brief, discovers only configured sibling gate-record paths
and verifies each selected source's bytes. The UI shows recorded signers and
artifact references, including exact-match and mismatch labels. These are unverified
source claims, not authenticated human signatures, gate outcomes or lifecycle stages.
No arbitrary evidence URL is followed, and no new live read grants are installed.

Decision-referenced evidence can now be inspected within that view when its exact
path is independently curated. Every read rechecks the Brief, selected decision,
reference and current grants. Source text remains inert and explicitly unverified;
stale/missing exact selections never open a replacement revision. This completes
read-only navigation from Brief to recorded decision to permitted evidence, not
human approval or an actionable decision Inbox.

The recorded projection job now runs through a dedicated durable worker, bound to
one exact save reference. An owned pool, current callback/agent checks, content-free
history, one-attempt execution and duplicate/no-rewind behavior are exercised with
actual local Temporal, native Git and PostgreSQL. Its test readback provenance is
synthetic. An additional actual local test now joins HTTP-confirmed creation (not
seeded saved data), lost-acknowledgement status recovery, queued durable projection
and the exact curated catalog/Brief tools. It checks one Git mutation/event across
reconstruction and duplicate handling. The current human/projector and gate authority
in that integration remain test doubles. The additional opt-in browser test now joins
actual authoring, exact confirmation, native Git creation, manual status recovery and
the exact projected Brief. Increment 0168 now replaces that scenario's owned API job
with the actual Temporal worker and tests queued reconstruction, one current browser
status read outside history, replay and duplicate rejection. This closes the isolated
browser-to-worker integration gap, not the missing real authority or live dispatch.

Remaining engineering includes the complete governed evidence-selection/action-time
writer composition, trusted live receipt dispatch and source admission, authenticated lifecycle
and decision projections, and the model-backed agent conversation. The current
live save button stays disabled by default. Its guarded opt-in implementation now
enforces one immutable attempt and exact receipt binding, independently of the
destination display lifetime. The prototype's supplied signature arrays cannot be
promoted to verified board stages merely by importing its read-model code.

Real membership/runtime configuration, complete live-write authority, all five R5
findings, independent/qualified protected review and human gate decisions remain
separate outstanding dependencies. No live writer/scheduler, deployment or spending
is authorized by this audit. The server-owned `STEER_WEB_BRIEF_SUBMISSION` display
switch is used only in an owned disposable browser-test process. It does not grant
authority or install an API writer. No live environment has been enabled.
The held source/policy assessment is now an optional configured runtime composition
with explicit separate observer identity and request-bound human identity. Its internal
last-assessment diagnostic remains historical; every authority/mutation path stays
denied, even when normalized policy is satisfied. The focused proof uses signed
synthetic OIDC/App JWTs and native Git, not a real-person or Keycloak held-profile demo.

Increment 0171 additionally connects the held profile to actual disposable Keycloak
and encrypted PostgreSQL browser sessions. Production authoring confirms exact bytes
and reaches the denied save without a synthetic successful authority callback.
Runtime reconstruction preserves manual not-found status; refreshed local review
cannot unlock a second submission. Current observer loss and committed human
revocation deny access. Historical gate evidence and the observer remain synthetic;
this closes a browser-session composition gap, not real governed write authority.

Increment 0172 replaces the direct observer principal with an actual disposable
Keycloak service account verified by the existing OIDC adapter against current Git
grants. Revocation, missing gate.observe and invalid tokens deny independently; a
fresh verified observer is restored before human revocation is tested. The current
human and observer now both cross actual local provider checks. This still does not
authenticate historical gate reviews or establish approved live trust/selection.

Increment 0173 adds an explicit exact-source preview to each projected Brief row.
The current-authorized read shows bounded literal Problem and Proposed outcome
excerpts before opening the full document. Missing, empty, ambiguous and truncated
source remains explicit. One in-memory summary clears on refresh, navigation,
pagination, session lifecycle and denial. This advances candidate inspection, not
mission-fit, provenance, measurement verification or authenticated board stages;
no backend permission, endpoint or background read was added.
Optional policy selection is now bound to the complete matching current Git manifest,
with exact source/configuration fingerprints and mismatch rejection. This is a source
binding, not proof of approved selection, trusted runner ownership or truthful review.
Next resolve governed selection and review-provenance composition against explicitly
authorized trust roots and current source evidence. Indispensable trust roots,
qualified evidence and human decisions must stay explicit, not simulated as approvals.
Keep real saving and live scheduling disabled; never derive permission from a local
checkbox or an inspected decision record. See `docs/BRIEF-SUBMISSION.md` for recovery
limits: no browser persistence or automatic retry, and the original operation ID
must be retained before leaving/hiding the page.

The **68–132 hours below is the original baseline estimate**, not current remaining
effort. Re-estimation must use these implementation gaps and separate engineering
from external review/configuration waits; cumulative test counts are not a forecast.

### Historical baseline estimate

Audited from candidate baseline `299159d6f6350c128d237dd175970f435ad9f4c8`.
These are engineering estimates, not elapsed calendar promises or a forecast for
all Phase 1 obligations. Existing isolated identity evidence has not been rerun
against real membership in this audit. No provider access was performed.

| Journey step | Current code evidence | Missing development / verification | Engineering effort, confidence |
|---|---|---|---|
| Sign in | `apps/api/src/runtime.ts` composes OIDC, encrypted sessions, Git grants and optional read model; `apps/web/app/page.tsx` displays the authenticated session. Default `server.ts` remains deny-all. | Validate the intended profile/membership and combined local journey; keep opt-in bootstrap and secure ingress. | 4–8 hours, medium; excludes real configuration/access waits. |
| Describe, correct, confirm | Domain `brief-author.ts` and `intent-interview.ts` exist. Production page only exposes the Brief library. Item 0121 adds the stateless authenticated preview contract. | Connect production interview and rendered correction; trusted system context; exact-version confirmation contract; accessibility and session-expiry tests. Model conversation remains a separate required seam, not replaced by deterministic drafting. | 12–20 hours, medium-low, including the preview slice. |
| Save once | `packages/adapters/src/code-host/github.ts` is read-only; no Brief-save tool exists. Ingestion and reconciliation already exist. | Implement a disabled-by-default write adapter and durable idempotency/CAS result lookup; recheck human, scope, exact confirmed bytes and gate immediately before write; test retries, lost acknowledgement, revoked grants and stale revision. | 20–40 hours, low; excludes GitHub write permission and Gate 2 waits. |
| See the work | Curated Brief library, artifact reads, snapshots/change consumer and durable projection job exist. Board is explicitly not connected on production page. | Feed committed artifacts into production board with revision links, reconnect/restart and dropped-event repair tests. Do not treat projection state as gate authority. | 12–24 hours, medium-low. |
| Review | `packages/tool-registry/src/gate-policy.ts`, gate observations and prototype inbox exist. Production inbox is not connected. | Read-only revision-bound decision view first; full authenticated proof composition for any enabled action, stale/revoked/mismatched proof denials. No signature inferred from confirmation. | 12–24 hours, low; excludes human gate decisions. |
| Combined journey | Separate package/provider/browser harnesses exist, not a demonstrated real five-step journey. | One approved-pod scenario across the actual composition, evidence at an exact revision, security/accessibility negatives and clean restart. | 8–16 hours, low; excludes provider configuration, manual audit and independent review waits. |

Planning envelope: **68–132 focused engineering hours** for this bounded journey,
assuming reuse of the current stack, one pod/repository and no new agent/model
provider integration within this estimate. This excludes the broader R5 backlog,
full M6 conversation/operations, release qualification and the 90-day pilot.
Re-estimate after the first browser authoring and save-contract slices. It is not
honest to derive a launch date from the assurance test counts.

### Immediate slice and near-term demo target

Item 0121: explicit-grant, human-scoped, stateless `intent.brief.preview` in the
shared registry, inherited HTTP/MCP discovery and execution, exact SHA-256,
missing-fact display data, and pre/post-computation identity rechecks. It performs
no model call or storage and returns saved/confirmed/executionAuthorized false.
This directly advances the describe/correct step. It is not a confirmation token.

Next demo target: **the following production authoring UI increment**, estimated
4–8 focused engineering hours within the authoring row, shows a signed-in synthetic
human entering facts, reading a draft, correcting it and observing a changed
fingerprint. Missing facts and “not saved / not signed” stay visible. Reuse the
pink/orange design and safe Markdown renderer; do not add a fake GitHub-success
state. Browser verification is required before claiming that demo. A real-member
demo additionally needs approved runtime configuration; no live writes are needed.

### Assurance obligations and waiting dependencies

0122 development update: the near-term guided preview screen is implemented and
has passed the 39-check isolated browser integration, including its new correction,
revocation and expiry checks. It uses deterministic prompts, not the model-backed
agent conversation. Saved artifacts, confirmation, real membership and the complete
five-step journey remain unproved. See `intent/0122/EVIDENCE.md`; this does not
change the broader effort envelope or remove the excluded agent/model integration.

The next bounded slice is exact-content confirmation and disabled save orchestration,
followed by the Git write adapter. Keep machine drafting/context resolution visible
as remaining work; do not relabel this interview preview as full agent-first delivery.

0123 development update: exact confirmation/create/readback orchestration now exists
behind an absent trusted-writer dependency. Synthetic ports cover duplicate/CAS and
unknown outcomes; actual GitHub atomicity, durable operation readback and full
source-verified write/Gate 2 authority are not implemented by those tests. These are
the next adapter/composition slices. Canonical new artifact paths follow architecture
ADR-02 (`items/NNNN-slug/BRIEF.md`); the legacy-only library also needs explicit
canonical-path support before it can show those new artifacts. No live save or
confirmation button is enabled. See `intent/0123/PLAN.md` for the remaining route.

0124 development update: the uninstalled GitHub storage primitive now issues the
exact-head two-addition mutation and verifies the resulting Git record through
bounded commit/tree/blob/history reads. Its isolated transport uses native Git
fixtures, including restart and lost-acknowledgement recovery. Fifteen focused
groups and full repository verification pass; see `intent/0124/EVIDENCE.md`.
No real write occurred. Full authenticated writer and source-authority composition,
historical lookup beyond the bounded linear profile, canonical discovery and UI
save/status connection still remain. The actual runtime App stays read-only.

0125 development update: canonical-path discovery is now implemented through the
shared read/create schemas, curated data catalog, transports and browser links.
The isolated browser fixture uses `items/0125-synthetic-outcome/BRIEF.md` rather
than relying on root-path compatibility; all 39 isolated browser checks pass.
See `intent/0125/EVIDENCE.md` for verification and desktop/mobile evidence.
This closes path recognition, not real saving, dynamic projection
admission, board rendering, source authority or the complete first usable journey.

0126 development update: a separate exact-head membership verifier now binds the
human session/issuer and current Git grants for the future writer composition.
Nine focused checks and the final full repository check pass. It does not produce Gate 2/write authority or verify an
OIDC session by itself; the trusted callback and full provider-backed gate/source
composition still need implementation. No live enablement follows from this result.
See `intent/0126/EVIDENCE.md` and `intent/0126/PLAN.md`.

0127 development update: the actual OIDC verifier and browser broker now retain
internal context that composes with membership verification. Exact bindings prevent
same-time credential/session substitution; public responses still exclude this
metadata. See 0127/EVIDENCE for tests and limits. The full gate/provider/source
verifier and request-bound writer remain unfinished, and no live write is enabled.

0128 development update: the existing gate observer can now collect immutable
record/artifact bytes pinned to the expected source head and decision digest.
It preserves provider metadata for the missing verifier rather than substituting
normalized claims. Full provider/policy proof and request-bound writer composition
remain required. See `intent/0128/EVIDENCE.md`; no live write or gate is enabled.

0129 development update: before writer integration, reproduced gate-policy timing
errors are corrected with exact UTC comparisons instead of millisecond rounding.
This validates chronology only, not provider identity or a human second look.
The full source/provider proof and request-bound writer remain unfinished. See
`intent/0129/EVIDENCE.md` for before/after regression evidence.

0130 development update: a read-only provider-attestation signature primitive now
binds expected record/identity/session facts under an explicitly selected trust
snapshot. This does not fetch or authorize a production key/provider, validate
qualified hats or replace the existing openai-codex approval record. Full proof
retrieval/source verification and writer composition remain; see `intent/0130`.

0131 development update: signed-envelope trust/proof files can now be read through
an authenticated exact-head Git adapter and passed to the real verifier. Synthetic
tests cover revocation, changed sources, serialization and bounded hung reads.
Actual production-provider compatibility, authorized trust roots, full human/
qualification/policy evidence and request-bound writer composition remain open.
See `intent/0131/EVIDENCE.md`; no live source binding or write is enabled.

0132 development update: the registry save contract now has a request-bound GitHub
writer composition. Tests exercise exact preview/confirmation/save/status through
real storage into disposable Git, with fresh session/grant/proof checks and no
duplicate mutation after recovery. Actual full authority verification is still a
required unfinished dependency. Runtime binding, save/status UI, board and decision
review remain due; this is not an enabled real writing journey. See `intent/0132`.

0133 development update: reproduced partial-clock rollbacks now reject in current
membership and gate-source observations. Gate collection also rejects at its real
deadline while retaining outstanding-work ownership and safe draining shutdown.
This corrects prerequisites for authority composition, not the full verifier or
live saving. See `intent/0133/EVIDENCE.md` for before/after and timeout evidence.

0134 development update: request-service wiring is prepared with lazy per-invocation
writer factories, verified cookie/bearer context and awaited cleanup. HTTP/MCP and
Git-backed revocation checks are covered without installing a default factory.
Full authority verification still precedes runtime binding and the actual save UI/
board/decision journey. See `intent/0134/EVIDENCE.md` for exact coverage and limits.

0135 development update: actual Git membership is now built into the managed
writer factory before and after gate verification. HTTP/MCP integration exercises
confirmed native-Git creation and status recovery through that factory and store.
The full gate verifier remains a mandatory synthetic dependency in tests, not a
production implementation or approval. Runtime/UI/board/review remain due; see
`intent/0135/EVIDENCE.md` for exact implementation and fixture boundaries.

0136 development update: the provider-source reader now verifies historical and
current recorded human hats, including exact signed authorization digests and
nanosecond grant windows. Native Git tests demonstrate later revocation denial.
This removes a source-verification gap for signed-envelope development, not the
remaining identity/session, specialist, existing-provider and full gate composition.
No runtime/UI change is claimed; see `intent/0136/EVIDENCE.md`.

0137 development update: a dedicated reader mode now verifies the signed identity/
session evidence referenced by the gate proof and joins it with historical/current
Git hats. Native Git and real ephemeral signatures exercise the composition. This
does not create an approved real identity attestor, issue receipts or convert the
existing commercial approval format. Qualification/full gate and runtime/UI/board/
review remain unfinished. See `intent/0137/EVIDENCE.md` for exact scope.

0138 development update: scoped specialist qualification is now verified alongside
the provider/identity proofs and historical/current Git roles. A derived specialist
signature feeds the actual gate-policy evaluator in development tests; all other
policy facts in that test remain synthetic. Full governed-source gate composition,
real authority/receipt bindings and commercial compatibility remain before live
writer enablement. No UI change is claimed; see `intent/0138/EVIDENCE.md`.

0139 development update: exact canonical gate/artifact sources now join verification
of every recorded signer, without allowing a passing first signer to conceal a bad
second one. The collector preserves non-approval decisions and requires downstream
policy verification and current signer revalidation. Real attestor bindings and
existing commercial compatibility remain open; see `intent/0139/EVIDENCE.md`.

0140 development update: individually verified signer evidence must now remain
within all known key/role/qualification validity bounds at one common completion
instant. A reproduced expiry gap is corrected, with exact nanosecond comparisons
and no false requirement for an old signing login to remain active today. Fresh
source checks and full policy/authority composition still precede live writer
enablement; see `intent/0140/EVIDENCE.md`. No UI change is claimed.

0141 development update: pinned policy/review sources now feed the actual policy
evaluator alongside every actual verified signer set in the prerequisite chain.
A passing target cannot conceal an earlier policy failure. This is source/policy
observation, not verification of the review's origin or its pass/fresh-context claims.
Governed normalization of actual formats, approved real authority and current-source
checks remain before live writer binding. See `intent/0141/EVIDENCE.md`.

0142 development update: existing native domain records can be read without rewriting
their bytes, with every pinned evidence link checked at the original reviewed revision.
Adverse decisions and unresolved escalations cannot be normalized into approval.
Reviewer authenticity, native Critic/exception integration and governed source
selection remain before live authority. See `intent/0142/EVIDENCE.md`.

0143 development update: native exception Briefs now reconstruct against their
complete pinned review records before feeding gate policy. Omitted findings,
substituted reviewers and inconsistent ready/hold labels reject. Native Critic,
review provenance and governed selection remain before actual authority binding;
see `intent/0143/EVIDENCE.md`. No frontend or live-write change is claimed.

0144 development update: the two existing canonical native Critic HOLD layouts
can now feed exact-source, counter-checked failed verdicts into policy. Local R5
preflight and unknown passing formats are deliberately not treated as canonical
passes. A supported passing native contract, reviewer authenticity, prior-finding
history and governed source/Builder selection remain before full live authority.
See `intent/0144/EVIDENCE.md`; this is backend compatibility, not a frontend change.

0145 development update: exact domain-review source bytes can now be checked
against a selected runner's cryptographic execution assertion through actual Git
collection. This advances provenance plumbing only: approved runner selection,
demonstrated isolated execution, native Critic provenance, actual provider bindings
and action-time authority remain required before live saving. No real attestor or
writer is enabled. See `intent/0145/EVIDENCE.md`.

0146 development update: native Critic follow-ups now account for every finding
in a complete selected predecessor chain, including resolved findings omitted
without affecting local counters. This verifies linked accounting, not truthful
closure, authoritative history or review approval. The read-only frontend audit
also confirms that artifact snapshots cannot yet supply truthful lifecycle board
states; those projections remain unfinished. See `intent/0146/EVIDENCE.md`.

0147 development update: current native Critic reports can now bind to a selected
runner's cryptographic assertion through actual Git source reads, with final
expiry/revocation checks alongside domain runners. This is receipt verification,
not approved runner configuration, isolation evidence, truthful findings or a
passing gate. No real provider or writer is installed; see `intent/0147/EVIDENCE.md`.

0148 development update: authenticated read-only destination/head discovery is
implemented across the registry and HTTP/MCP, with opt-in identity-runtime
composition using the existing Git reader. Actual native Git tests verify moving
heads without write calls. UI consumption and real configuration remain; the
observation is neither path availability nor write/gate authority. See
`intent/0148/EVIDENCE.md`.

0149 development update: the authoring screen now includes an explicit read-only
destination check. Its display controller validates the shared contract, clears
stale/hidden/expired data and suppresses late responses without automatic refetch.
This is UI implementation, not verified live configured access or save enablement.
Combined authenticated browser-journey evidence remains due; see
`intent/0149/EVIDENCE.md`.

0150 development update: an isolated composed test now follows cookie login and
cryptographic token validation through native Git grants/source reads into the
actual destination display controller. It exposed and fixed premature session-store
closure during browser-only shutdown. Provider/session/browser fixtures are explicit;
durable runtime-profile and real browser journey evidence remain due. See
`intent/0150/EVIDENCE.md`.

0151 development update: the actual runtime profile now has isolated PostgreSQL 16
reconstruction evidence. Original login state, encrypted sessions and logout survive
service replacement while destination reads use current native Git grants/heads.
Provider HTTP and the cookie jar are synthetic; actual Keycloak/browser and live
provider evidence are not claimed. See `intent/0151/EVIDENCE.md`.

0152 development update: the explicit browser suite now connects the actual
Keycloak-authenticated cookie and PostgreSQL session to the production destination
runtime/Git reader. It exercises current-head display, reconstruction, committed
grant denial/restoration, real display expiry and unsaved draft preservation.
GitHub HTTP remains a read-only native Git fixture; this does not authorize saving
or close the remaining findings. Validation is recorded in `intent/0152/EVIDENCE.md`.

0153 development update: selected Critic histories can opt into bounded, merge-aware
target ancestry through the current source head. The configured Git reader supplies
parent edges; missing or unrelated paths cannot count as successful evidence. This
does not choose authoritative history, verify findings or clear a HOLD. Governed
selection, approved bindings and full write authority remain unfinished. See
`intent/0153/EVIDENCE.md` for validation and limits.

| Obligation | Relation to this journey | Boundary |
|---|---|---|
| R5-001 lifecycle | Retention, holds, complete copy evidence and provenance remain required for stored records. Items 0117–0120 build offline provenance prerequisites; retained retirement archive and full composition are still missing. | Does not block stateless preview development. Remains part of the open Gate 2/live-use and release package. |
| R5-002 authority/time | Exact identity, revision, freshness, independent evidence and human authority affect save and decision actions directly. | Development may proceed closed; live actions require the applicable accepted gate/authority evidence. |
| R5-003 migration | Durable schema evolution/recovery affects the actual stored journey, not a stateless draft. | Real adapter/restart/compatibility evidence remains required before the gated rollout; no migration runs are authorized here. |
| R5-004 reconciliation | Complete accounting and observation semantics remain acceptance obligations; no new spending is authorized. | Independent/protected review remains open. |
| R5-005 Unicode phone | Privacy handling matters when real content enters the system. | Independent review and production data evidence remain open; synthetic drafts do not clear it. |

All five findings remain open. Engineering can proceed on the journey while
external enablement stays closed. Waiting items are recorded separately: independent
review/protected incorporation; exact human gate decisions; approved real Keycloak
membership/configuration; explicit GitHub write installation scope; manual audit;
and any separately authorized hosting/model cost. None has a promised duration.

### Scope-change proposal — not approved or applied

Propose a separately labeled, non-writing **local authoring preview checkpoint**
before full Phase 1 acceptance, with synthetic data, stateless drafts and read-only
repository views. All signed Phase 1 requirements and five R5 findings remain due.
An approved real writing pilot cannot be relabeled as that checkpoint.

Any later proposal to defer broader corpus lifecycle, automated migration or
operational services must identify exact signed requirements/Exam IDs, affected
record classes, compensating restrictions and revised acceptance evidence, then
obtain the required scope and gate approvals. No such deferral is adopted here.
The immediate decision is execution order only: journey-enabling development now,
with unfinished archival/provenance work retained in `intent/0120/PLAN.md`.
0154 development update: the actual membership and gate-source collectors now join
the shared preview/save/status path through a held writer factory. Even a satisfied
policy evaluation cannot replace missing governance/provenance or mint write
authority. The next overnight priority is the exact-content confirmation/save-status
interface, with real writes disabled. See `intent/0154/EVIDENCE.md`; this is not a
live runtime installation or completion of full action-time authorization.

0155 development update: the authoring screen now includes configured-path choice,
exact-target local review and manual previous-operation status feedback. Live saving
remains disabled. Prior receipts are explicitly separate from the current draft;
unknown/not-found results cannot trigger automatic resubmission. This is UI progress,
not a live writing pilot or Phase 1 acceptance. See `intent/0155/EVIDENCE.md` for
test evidence and the browser-fixture versus actual-provider distinction.

0156 development update: actual native Git operation history now feeds the browser's
status query through the shared store and request-owned authenticated writer. The
receipt survives later branch commits and composed-service reconstruction, while
current grant denial blocks provider reads. This replaces intercepted successful
status replies for that integration, but its history is seeded test data, not an
authorized platform save. Live writer composition and full action-time authority
remain unfinished; see `intent/0156/EVIDENCE.md`.

0157 development update: a validated prior receipt now links directly to the existing
exact-revision Brief reader. Current catalog/access checks still decide availability;
newer projected content cannot silently replace the recorded revision. This completes
the non-writing prior-receipt inspection path in disposable integration, not a live
save or Phase 1 acceptance. See `intent/0157/EVIDENCE.md` for verification and limits.

0165 development update: exact recorded-Brief projection now has a bounded durable
worker path with current readback outside history, exact operation binding and no
automatic retries or projection rewind. Actual Temporal/native-Git/PostgreSQL tests
pass, alongside the separate real disposable creation regression. Creation-to-worker
dispatch-to-browser refresh remains to be demonstrated as one isolated journey;
there is still no enabled live save/scheduler or Phase 1 acceptance.
