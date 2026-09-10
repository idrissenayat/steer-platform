# STEER documentation map

Current framework version: **3.2**
Last doctrine update: **2026-09-10 — D1 records amendment incorporation**.
The prior complete v3.2 alignment audit remains dated 2026-09-03.

This map explains which documents govern STEER, which files the platform reads,
and which implementation evidence remains outside the repository.

## Current development navigation

Development route refreshed 2026-09-07; this does not change the doctrine alignment
audit above, the signed execution plan or formal gate status.

- [End-to-end blueprint](architecture/END-TO-END.md) and
  [workflow contract / open decisions](architecture/WORKFLOW-CONTRACT.md): process,
  sequence, architecture, owners, storage/recovery and current implementation
  boundaries. D1 operational-state semantics were accepted on September 10;
  candidate-publication activation remains separate. Signed historical artifacts
  and the protected Exam remain unchanged.
- [Revision 2 correction record](architecture/REVIEW-FIXES.md) maps all five review
  findings to concrete design contracts and acceptance cases. The separate
  [draft-records amendment](architecture/DRAFT-RECORDS-AMENDMENT.md) preserves the
  exact approved bytes. Its [D1 adoption successor](architecture/D1-ADOPTION.md)
  records the September 10 decision, architecture data boundary and incorporation;
  the root Word documents and their Learn projections now include that amendment.
- [Current intent journey plan](INTENT-JOURNEY-PLAN.md): I1–I6 implementation and
  the design checkpoint before dependent persistence/publication work.
- [Phase 1 delivery ledger](PHASE-1-DELIVERY.md): completed development increments
  and the full milestone sequence.
- [First usable journey](FIRST-USABLE-DELIVERY.md) and
  [remaining work packages](JOURNEY-REMAINING-WORK.md): integrated capability,
  unfinished engineering and separate governance/provider dependencies.
- [Recorded Brief dispatch](RECORDED-BRIEF-DISPATCH.md): fixed-operation start,
  manual recovery and connection ownership; no live scheduler activation.
- [Authorized recorded dispatch](AUTHORIZED-RECORDED-DISPATCH.md): separate current
  dispatch/status grants and shared HTTP/MCP contracts, without live configuration.
- [September 7 morning handoff](overnight/2026-09-07-HANDOFF.md): verified overnight
  outcomes, exact candidate commits, tests, preview availability and remaining boundaries.
- [Controlled projection recovery](CONTROLLED-PROJECTION-RECOVERY.md): internal
  fixed-failed-run workflow, current guard, idempotent SQL, separate shared grants and
  owned dispatch client, optional authenticated runtime and disposable Keycloak recovery;
  browser-created receipt integration and live binding remain open.
- [Recorded projection failures](RECORDED-PROJECTION-FAILURES.md): post-receipt
  revocation and terminal status at the historical 0180 boundary; normal start still
  refuses retry, with the separate internal recovery primitive linked above.
- [Projector identity journey](PROJECTOR-IDENTITY-JOURNEY.md): separate actual local
  projector identity and current grant/token-substitution denial in durable ingestion.
- [Keycloak recorded journey](KEYCLOAK-RECORDED-JOURNEY.md): actual disposable
  service-account dispatch in the browser-created Brief/receipt/projection path.
- [Authenticated recorded journey](AUTHENTICATED-RECORDED-JOURNEY.md): joined signed
  dispatch, actual local operation readback and exact Git/PostgreSQL projection.
- [Recorded scheduler runtime](RECORDED-SCHEDULER-RUNTIME.md): explicit profile/
  factory ownership, exact binding and request-draining shutdown.
- [Gate 2 corrections](GATE-2-CORRECTIONS.md): all five R5 findings remain open.

## Authority and purpose

| Layer | Purpose | Authoritative project files |
|---|---|---|
| Methodology | Why STEER exists and the principles that govern it | `STEER-Methodology.docx`; Learn projection `kit/canon/methodology.md` |
| Framework | What the structure is: organization topology, artifact chain, plays, gates, measurement, and sizing | `STEER-Framework.docx`; Learn projection `kit/canon/framework.md` |
| Operating Model | How organizations run STEER | `STEER-Operating-Model.docx`; Learn projection `kit/canon/operating-model.md` |
| Practice Notes | Detailed operating guidance | the three root `STEER-*.docx` practice notes and `kit/practices/*.md` |
| Product intent | What this platform must implement and how it is examined | canonical numbered chains under `intent/0001` through `intent/0006` |
| Production architecture | The Phase 1 foundation, stable seams, phased end state, and architecture exit exam | `intent/0001/ARCHITECTURE.md`, its Gate 1 record at `intent/0001/signatures/gate-1.json`, and `docs/architecture/STEER-platform-end-state-phased.png` |
| Execution plan | The Gate-bound implementation sequence, evidence route, stop conditions, and pilot closure | `intent/0001/PLAN.md` |
| Integration design and accepted amendment | End-to-end workflow, D1 authority/recovery successor and remaining activation boundaries; historical signed bytes remain unchanged | `docs/architecture/END-TO-END.md`; `docs/architecture/WORKFLOW-CONTRACT.md`; `docs/architecture/D1-ADOPTION.md`; `operating/local-mac/records-d1-approval.json` |
| Machine policy | Rules enforced by the kit and platform | `kit/policy`, `kit/guardrails`, `kit/bands`, `kit/metrics`, `kit/stack-packs`, and `kit/readiness` |
| Implementation record | What exists locally and what evidence is still missing | `docs/IMPLEMENTATION.md` and `docs/INTENT-COMPLETION.md` |

The unnumbered intent files are compatibility paths. They do not replace the
numbered source chains. Supplied intent artifacts remain source-faithful and are
not rewritten merely to restate a later implementation decision.

## v3.1 amendment trace

| v3.1 rule | Human-readable canon | Machine-readable or platform location |
|---|---|---|
| Organization → Portfolio → Product → Pod topology and specialist pool | Framework; Operating Model | `kit/templates`, `kit/policy/organization.json`, organization domain and setup experience |
| Explicit hats, tenant-scoped agents, handover, and isolation | Operating Model | organization policy and domain contracts |
| One operating repository plus a product home repository | Framework; Operating Model | organization policy and setup proposal |
| Non-weakening policy inheritance | Operating Model | `kit/policy/organization.json` and validation tests |
| Person-level WIP across pods and hats | Framework; Sizing Note; Three Surfaces Note | `kit/policy/surfaces.json` and intent-backlog domain |
| Commercial and regulated minimum-distinct-signer rules | Framework; Operating Model | `kit/policy/gates.json` and signature domain |
| Stack Packs and brownfield readiness scans | Framework; Operating Model | `kit/stack-packs` and `kit/readiness` |
| Greenfield leading indicators and unscored pre-mission fit | Framework; Providing Intent Note; Three Surfaces Note; Operating Model | surfaces policy, templates, organization and intent-backlog domains |
| Agent-first first run | Operating Model | setup agent experience and organization domain |

## v3.2 agent-first assurance trace

| v3.2 rule | Human-readable canon | Machine-readable or platform location |
|---|---|---|
| One independent agent review per activated domain | Framework; Operating Model; ADR 0001 | `kit/policy/gates.json`, domain review template and packets |
| Builder and reviewer independence | Framework; Operating Model; ADR 0001 | gate policy, GitHub Exam controls, kit validation |
| One consolidated exception brief | Framework; Operating Model; Glossary; ADR 0001 | gate policy and Gate 2 review packet |
| Commercial human specialists only on deterministic triggers | Operating Model; Glossary; ADR 0001 | `kit/policy/gates.json` and required-role projection |
| Regulated human review remains mandatory | Framework; Operating Model; ADR 0001 | gate policy and signer-policy tests |
| Agents cannot waive, sign, suppress escalation, or authorize external effects | Methodology; Operating Model; ADR 0001 | gate policy, signature boundary and review template |

## Publication and synchronization rule

1. Update the relevant root Word document when doctrine changes.
2. Update its Markdown projection in `kit/canon` or `kit/practices` in the same
   change so the Learn hub and agent slices receive the same rule.
3. Update machine policy and tests when the rule is enforceable.
4. Update `docs/INTENT-COMPLETION.md` with the implementation boundary.
5. Run `pnpm check`, render every changed Word document, and inspect every page.

An architecture change must also update the 0001 architecture record, its
diagram, the relevant seam contract, Stack Pack, and implementation boundary in
the same commit. The current fixture-backed prototype cannot satisfy the
production walking-skeleton exam merely by reproducing the intended screens.

Git is the canonical system of record for published business artifacts and
decisions. Under an adopted and verified D1 binding, Postgres may separately retain
encrypted private drafts and operational/accounting records, which are not
rebuildable projections. Projection replay must not erase those records or reset
spending. Browser persistence remains prohibited. See the accepted
[data-boundary successor](architecture/D1-ADOPTION.md) and
`kit/policy/intent-records.json`; neither document activates a runtime by itself.

## Completion boundary

The repository contains the complete v3.2 framework document set and the
requested fixture-backed UX/domain prototype. The production architecture
snapshot at commit `281c9736816ec22fa1209b060b58fa8164519f7c` was accepted at
Gate 1 by the Product Lead and Product Designer hats; its detached signature
record preserves that snapshot unchanged. The architecture is not yet
implemented. Production completion still requires Gate 2, the walking-skeleton
exam, Gate 3 and triggered specialist evidence, live identity/code-host configuration,
and an approved production measurement window. Fixture data is never promoted
as production evidence.
