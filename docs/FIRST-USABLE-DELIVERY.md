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
