# Initial intent completion ledger

Source of truth: `intent/BRIEF.md`, `intent/SPEC.md`, and `intent/EXAM.md`.
Last implementation audit: 2026-09-02.

## Outcome status

The local prototype now demonstrates the complete human journey against a fixture
repository: computed workspace, role-specific decisions, Gate-specific review,
revision-safe sign/send-back, evidence assembly, continuous work-item threads,
interview-first brief authoring, scope checks, aging-band huddle signals, and
the v3.1 agent-first organization setup flow. The Phase 0 kit is independently
adoptable.

This is not yet a production completion claim. Gate 1 is accepted for the exact
`281c9736816ec22fa1209b060b58fa8164519f7c` snapshot, with its provider-recorded
signature in `intent/0001/signatures/gate-1.json`. The first fresh-context
Gate 2 Critic review at `a43b32a` returned HOLD / SEND BACK with three blockers
and three majors. An independent Test Agent has prepared a revised canonical
Exam and actor-bound CI candidate while preserving the supplied Exam. The
second exact-revision Critic closed four findings and returned HOLD / SEND BACK
on one blocker and one major. GitHub code-owner enforcement is active on
protected `main`; live unauthorized-Builder and distinct authorized-Exam-author
pull-request tests remain pending a separate identity, as do all seven human
domain-review records.
The production Phase 1
walking skeleton in `intent/0001/ARCHITECTURE.md` is not implemented. The intent
also requires Gate 2, live identity/code-host configuration, Gate 3 and
specialist manual evidence, and a 90-day pilot window. None can be replaced by
fixture data.

## Numbered item audit

| Item | Artifact chain | Implemented now | Completion boundary |
|---|---|---|---|
| 0001 · Flight Deck foundation | supplied README and EXAM retained; revised supplied BRIEF and SPEC replace the prior revisions exactly in `intent/0001`; architecture revision 2 and plan accepted at Gate 1 through a detached record | Phase 0 kit, derived workspace, decisions, evidence, role home, authoring, controls, v3.1 organization setup, local gauntlet, and first two production slices | UX/domain prototype green and Gate 1 recorded; remaining production slices, Gate 2, Phase 1 walking skeleton, live connectors, Gate 3 and specialist evidence, and pilot outcomes remain |
| 0002 · Backlog instrumentation and baselines | supplied README and BRIEF preserved verbatim in `intent/0002` | typed v1 contract, kit JSON Schema, transient platform adapters, privacy rejection, source-exit distinction, two baseline computations, sample gate, and dry-run | production figures remain pending until a representative window is approved and observed; fixture figures are never promoted |
| 0003 · Full brief detail view | supplied README, BRIEF, SPEC, and EXAM preserved verbatim in `intent/0003` | complete rendered panel, deep links, provenance variants, cluster/back navigation, revision history, WIP/stale controls, all four actions, external-exit telemetry, and automated accessibility | outcome comparison awaits the 0002 production baseline; manual accessibility record remains |
| 0004 · Learn STEER hub | supplied README and BRIEF match the existing chain; SPEC and EXAM already canonical in `intent/0004` | repository-source reader, search, section links, glossary peeks, governed correction flow, stateless role paths, agent slices, coarse telemetry, and version guard | onboarding comparison awaits the 0002 production baseline; manual accessibility record and optional Whitepaper URL remain |

The implementation therefore contains every locally buildable capability in
0001-0004. It does not mislabel unavailable production observations or human
signatures as complete.

Phase 1 production delivery began with item 0005. Its pnpm/Turborepo
workspace and Next.js shell are implemented and verified, while formal Gate
2 and Gate 3 records and the remaining API/worker/tool/service foundations
remain open. It is not evidence that the Phase 1 walking skeleton exists.

Item 0006 also completes the provider-free domain extraction: the original
modules were moved atomically into `packages/domain`, all consumers use the
workspace package, and stricter optional/index checks were resolved without
weakening the shared compiler baseline. API, worker, data, and provider
foundations remain open.

That statement covers the requested feature artifacts in the present
prototype, not the newly adopted production architecture. The thirteen-case
walking-skeleton exam must pass before the Phase 1 foundation can be marked
implemented.

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
| LRN-D | Five-step stateless accountability orientations | eight human-hat manifest paths and live action links | green locally |
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

## Operating Model v3.1 amendment reconciliation

The supplied amendment is integrated into the canonical Operating Model and
the platform rather than stored as a detached note. Organization → Portfolio →
Product → Pod declarations, explicit hats, registered tenant-scoped agents,
one operating repository plus product home repositories, non-weakening policy
inheritance, person-level WIP, cross-pod specialist SLAs, commercial and
regulated signer rules, Stack Packs, readiness scans, greenfield measurement,
mission-fit bootstrapping, recorded handover, tenant isolation, and the
conversation-first setup flow all have machine-readable policy and automated
domain coverage. The revised 0001 Brief and Spec are exact source copies; the
existing Exam was not rewritten without a supplied replacement.

The complete human-readable document set is now version-aligned at v3.1. The
Framework includes the organization layer and current signer/greenfield rules;
the three practice notes carry person-level WIP, greenfield measurement, and
pre-mission unscored behavior where applicable. Their Markdown Learn
projections match, and `DOCUMENTATION-MAP.md` records the authority and update
path. Numbered intent sources remain unchanged.

## Human-owned completion gates

1. **Decided at Gate 1:** commercial pilots use provider-recorded approvals;
   any regulated pilot requires a cryptographically signed-log record before it
   begins.
2. **Decided at Gate 1:** GitHub App is the first code-host binding.
3. Approve the notification rule: ambient by default; push only at SLA risk.
4. Approve assistant data handling: session-only originator text, committed
   artifact as the only retained copy.
5. **Gate 1 recorded; second Gate 2 Critic HOLD:** four findings are resolved.
   Complete the two-identity live tests in
   `docs/GITHUB-EXAM-PROTECTION.md`, run required CI over the actual Exam diff,
   and obtain all seven human domain reviews before another Critic or Tech Lead
   signature request.
6. Run the ten-to-twenty-item pilot and retain 90 days of outcome evidence.

“Complete” means every machine row is green and each human-owned row has an
explicit, revision-bound ruling. Code alone cannot manufacture those records.
