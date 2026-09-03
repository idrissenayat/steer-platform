# STEER documentation map

Current framework version: **3.2**
Last alignment audit: **2026-09-03**

This map explains which documents govern STEER, which files the platform reads,
and which implementation evidence remains outside the repository.

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

Git is the sole system of record. The browser and platform are rebuildable
projections of these files and must not become a private source of truth.

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
