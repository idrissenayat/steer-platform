# Initial intent completion ledger

Source of truth: `intent/BRIEF.md`, `intent/SPEC.md`, and `intent/EXAM.md`.
Last implementation audit: 2026-08-28.

## Outcome status

The local pilot now demonstrates the complete human journey against a fixture
repository: computed workspace, role-specific decisions, Gate-specific review,
revision-safe sign/send-back, evidence assembly, continuous work-item threads,
guided brief authoring, scope checks, and aging-band huddle signals. The Phase
0 kit is independently adoptable.

This is not yet a production completion claim. The intent itself requires
human policy rulings, live identity/code-host configuration, specialist manual
evidence, and a 90-day pilot window. Those cannot be replaced by fixture data.

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
