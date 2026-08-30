# Initial intent completion ledger

Source of truth: `intent/BRIEF.md`, `intent/SPEC.md`, and `intent/EXAM.md`.
Last implementation audit: 2026-08-30.

## Outcome status

The local pilot now demonstrates the complete human journey against a fixture
repository: computed workspace, role-specific decisions, Gate-specific review,
revision-safe sign/send-back, evidence assembly, continuous work-item threads,
interview-first brief authoring, scope checks, and aging-band huddle signals. The Phase
0 kit is independently adoptable.

This is not yet a production completion claim. The intent itself requires
human policy rulings, live identity/code-host configuration, specialist manual
evidence, and a 90-day pilot window. Those cannot be replaced by fixture data.

## Numbered item audit

| Item | Artifact chain | Implemented now | Completion boundary |
|---|---|---|---|
| 0001 · Flight Deck foundation | supplied README, BRIEF, SPEC, and EXAM preserved verbatim in `intent/0001` | Phase 0 kit, derived workspace, decisions, evidence, role home, authoring, controls, and local gauntlet | local/automated scope green; live connector, specialist evidence, and pilot outcomes remain |
| 0002 · Backlog instrumentation and baselines | supplied README and BRIEF preserved verbatim in `intent/0002` | typed v1 contract, kit JSON Schema, transient platform adapters, privacy rejection, source-exit distinction, two baseline computations, sample gate, and dry-run | production figures remain pending until a representative window is approved and observed; fixture figures are never promoted |
| 0003 · Full brief detail view | supplied README, BRIEF, SPEC, and EXAM preserved verbatim in `intent/0003` | complete rendered panel, deep links, provenance variants, cluster/back navigation, revision history, WIP/stale controls, all four actions, external-exit telemetry, and automated accessibility | outcome comparison awaits the 0002 production baseline; manual accessibility record remains |
| 0004 · Learn STEER hub | supplied README and BRIEF match the existing chain; SPEC and EXAM already canonical in `intent/0004` | repository-source reader, search, section links, glossary peeks, governed correction flow, stateless role paths, agent slices, coarse telemetry, and version guard | onboarding comparison awaits the 0002 production baseline; manual accessibility record and optional Whitepaper URL remain |

The implementation therefore contains every locally buildable capability in
0001-0004. It does not mislabel unavailable production observations or human
signatures as complete.

## Exam reconciliation

| Case | Requirement | Evidence | State |
|---|---|---|---|
| A1 | Correct computed board across chain states | representative and generated artifact/signature/evidence combinations | green locally |
| A2 | Destroy and replay identically | deterministic replay and reconciliation tests | green |
| A3 | No private authoritative status/signature | no status field; fixture decisions append to chain events | green locally |
| B4 | Decision iff ready, assigned, unsigned | generated gate/readiness/role combinations | green locally |
| B5 | Identity, sequence, revision; stale click voided | `domain-contracts.test.ts` and live Gate flow | green locally |
| B6 | Send-back note, correct route, unsigned gate | `domain-contracts.test.ts` and live flow | green locally |
| B7 | Tagged specialist seat and visible SLA breach | default-closed role derivation and decision urgency | green locally |
| C8 | Current exam cases, ranked findings, conformance | `assembleEvidence`; stale element test; Gate 3 UI | green locally |
| D9 | Guided session creates valid attributed BRIEF without tool terminology | deterministic authoring, validation, revision, live form | partial: live connector attribution pending |
| D10 | 20-prompt assistant eval and regression gate | 20-scenario originator eval; exact system-name containment | green for deterministic adapter; live model revalidation pending |
| D2-9a | Pull refuses at the visible WIP limit | `intent-backlog.test.ts`; Product Lead candidate pane | green locally |
| D2-9b | Measurable-today resolves against telemetry | exact metric-resolution fixture tests and badges | green locally |
| D2-9c | Duplicate clustering separates unrelated intents | seeded cluster-count tests | green locally |
| D2-9d | Decay expires without deletion | expiry projection retains the original record | green locally |
| D2-9e | Decline reason becomes Scout tuning input | deterministic decline record | green locally |
| D2-9f | Inbox, candidates, ambient flight; breach-only push | DOM order, notification-domain tests, responsive UI | green locally |
| IDV-A | Complete rendered candidate detail and provenance variants | intent-detail fixtures and panel UI | green locally |
| IDV-B | Revision-safe pull, decline, merge, and send-back | domain contracts and WIP-blocked live flow | green locally |
| IDV-C | Deep link, current truth, no private view state | hash-driven panel and ephemeral session model | green locally |
| IDV-D | Labeled, trapped, keyboard-complete detail panel | axe and browser walkthrough | partial: manual specialist record pending |
| IDV-E | Detail action and external-exit instrumentation | event-schema and outcome-summary tests | green locally |
| LRN-A | Canon fidelity and framework-version build guard | kit manifest, raw corpus imports, seeded mismatch test | green locally |
| LRN-B | Page navigation, search, glossary peek, and governed corrections | deep-link/search/focus tests and change-intent flow | green locally |
| LRN-C | Per-role agent corpus slices and Builder invariant | manifest resolver and byte-identity tests | green locally |
| LRN-D | Five-step stateless accountability orientations | four manifest fixtures and live action links | green locally |
| LRN-E | Accessible Learn surfaces | axe and focus tests | partial: manual specialist record pending |
| LRN-F | Coarse Learn telemetry and first-action computation | event-shape and median tests | partial: 0002 production baseline pending |
| E11 | Read + approval-write token scopes only | workflow scope audit and runtime scope policy | green for CI; live connector pending |
| E12 | No secrets/tokens/problem text in logs | seeded canary scrub tests | green |
| E13 | Authentic webhook; reject forged/replayed events | HMAC and replay-guard tests | green at control layer |
| E14 | Originator text cleared after save | ephemeral session retention test | green at control layer |
| F15 | Zero critical/serious automated accessibility defects | axe structural gauntlet plus WCAG AA token contrast tests | green locally |
| F16 | Keyboard and screen-reader manual gate | keyboard/focus/browser walkthrough | partial: 81-checkpoint specialist record pending |
| G17 | Inbox under 2s at p95 for 50 decisions/10 repos | 50-decision projection budget test | green for projection; network p95 pending |
| G18 | Event latency and 5% dropped-webhook healing | deterministic 100-event chaos run repairs 5% drop | green for reconciliation; live event p95 pending |
| G19 | Self-hosted container, no SaaS core dependency | multi-stage container and health endpoint | partial: full connector service smoke pending |

## Sizing practice-note reconciliation

`STEER-Sizing-and-Scoping.docx` is included as Practice Note 1 and is reflected
in the Framework guide, repository templates, machine-readable sizing policy,
brief composer, Flight Board aging state, and automated tests. The platform now
enforces one outcome / one exam / one shape at Frame, raises the configured
20-file or 4-system plan-sprawl alarm at Engineer, escalates historical
cycle-time band breaches to a huddle, and provides P85 forecasting functions.
These are flow controls; they do not create production cycle-time history.

## Providing-intent practice-note reconciliation

`STEER-Providing-Intent.docx` is included as Practice Note 2 and is reflected in
the Operating Model, Framework document set, adoption playbook, machine-readable
intent policy, and platform composer. The originator now answers one question at
a time, corrects a rendered draft, and never sees raw Markdown. Unverified system
names move to Open Questions, accepted drafts bind the pilot identity, and the
domain exposes the two-correction threshold for versioned context promotion.

## Three-surfaces practice-note reconciliation

`STEER-The-Three-Surfaces.docx` is included as Practice Note 3 and is reflected
in the Framework, Operating Model, adoption playbook, machine-readable surfaces
policy, authoritative SPEC/EXAM revisions, and platform home. The Product Lead
sees candidate intents as distinct from work items, the visible WIP limit blocks
automatic promotion, and all roles receive the inbox-first, triggered-candidate,
ambient-flight attention order.

## Human-owned completion gates

1. Decide whether regulated pilots require cryptographically signed events in
   Phase 1 or may use provider-recorded approvals until Phase 2.
2. Confirm GitHub as the first host binding and approve publication of the seam
   contract in `kit/seams/contracts.md`.
3. Approve the notification rule: ambient by default; push only at SLA risk.
4. Approve assistant data handling: session-only originator text, committed
   artifact as the only retained copy.
5. Provide Gate 1 and Gate 2 signatures for the intent revisions.
6. Run the ten-to-twenty-item pilot and retain 90 days of outcome evidence.

“Complete” means every machine row is green and each human-owned row has an
explicit, revision-bound ruling. Code alone cannot manufacture those records.
