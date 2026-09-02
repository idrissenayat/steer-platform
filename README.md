# Flight Deck — the STEER platform pod

This folder is the intent home of the pod building the STEER platform.
The platform is built using STEER itself: every feature enters as a brief,
carries an exam, and passes the gates. The pod's own metrics, recorded from
item one, are the framework's pilot evidence.

## The numbered implementation chain

| Item | Canonical artifacts | Platform implementation | Remaining evidence |
|---|---|---|---|
| 0001 · Flight Deck foundation | `intent/0001/README.md`, revised `BRIEF.md` and `SPEC.md`, existing `EXAM.md`, Gate 1 `ARCHITECTURE.md`, and read-only `PLAN.md` | Phase 0 kit and the fixture-backed UX/domain prototype, including the v3.1 organization/onboarding model, are implemented | nine authorized production slices, Phase 1 walking skeleton, live connector, human accessibility record, pilot window, human signatures |
| 0002 · Instrumentation and baselines | `intent/0002/README.md`, `BRIEF.md` | versioned content-free event schema, adapters, privacy validation, and both baseline computations are implemented | Product Lead-approved production window and representative figures |
| 0003 · Full brief detail view | `intent/0003/README.md`, `BRIEF.md`, `SPEC.md`, `EXAM.md` | rendered, deep-linkable, revision-safe detail panel and all four actions are implemented | 0002 production baseline and manual accessibility record |
| 0004 · Learn STEER hub | `intent/0004/README.md`, `BRIEF.md`, `SPEC.md`, `EXAM.md` | source-faithful reader, search, glossary, role orientation, agent slices, and corpus build guard are implemented | 0002 production baseline and manual accessibility record |

The unnumbered `intent/BRIEF.md`, `SPEC.md`, and `EXAM.md`, plus the
`intent/intent-detail-view*` files, remain compatibility paths for earlier
revisions. The numbered 0001 Brief and Spec match the revised supplied sources;
the existing Exam remains unchanged because no revised Exam was supplied.

## Item: 0003 · Full brief detail view

| Artifact | Status | Next signature |
|---|---|---|
| intent/0003/BRIEF.md | candidate in the intent backlog | pull by Product Lead |
| intent/0003/SPEC.md | draft | Gate 1, after pull; accessibility flagged |
| intent/0003/EXAM.md | draft | Gate 2; section D approved before code (default-closed) |

Sequencing note: the instrumentation baseline item precedes this one per
the spec; the outcome contract's baseline must exist before this ships.

## Item: 0004 · Learn STEER hub

| Artifact | Status | Next signature |
|---|---|---|
| intent/0004/BRIEF.md | candidate in the intent backlog | pull by Product Lead |
| intent/0004/SPEC.md | draft | Gate 1; content governance and peek UX flagged |
| intent/0004/EXAM.md | draft | Gate 2; accessibility cases are default-closed |

Implementation is present from the requested candidate. Its outcome
comparison remains dependent on the 0002 first-login baseline.

## Before Gate 1 (human actions, in order)

1. Resolve the flagged concerns in SPEC.md with their policy owners
   (signature weight, single-host binding, notification design,
   assistant data handling).
2. Answer the brief's open questions or carry them forward explicitly.
3. Confirm the outcome contract is measurable on day one: gate-wait
   baseline captured, decision instrumentation defined.
4. Run the naming search; "Flight Deck" is a working title.

## Working rules for this pod

- Git is the sole system of record; the platform never stores state the
  chain does not hold.
- Organization, portfolio, product, pod, human hats, and registered agents are
  versioned declarations, not private platform state.
- WIP protects each human across every pod and hat they hold.
- The exam is write-protected from Builders (hook enforced).
- Accessibility, security, and privacy are default-closed domains.
- Changes to these operating files are eval-gated like any fleet config.
- Work is sized by exam-writability and brief shape, never by story points.
- Scope freezes at Gate 1; aging bands and P85 cycle time replace rollover and
  velocity forecasts.

## Framework documents

- `STEER-Methodology.docx` — why the system exists.
- `STEER-Framework.docx` — structure, lifecycle, gates, measurement, and the
  sizing/scoping rules that connect Frame to forecasting.
- `STEER-Operating-Model.docx` — the integrated v3.1 accountabilities,
  organization topology, signer policy, and agent-first first-run model.
- `STEER-Sizing-and-Scoping.docx` — Practice Note 1, with the complete guidance
  for exam-writability, splitting, aging bands, and percentile forecasting.
- `STEER-Providing-Intent.docx` — Practice Note 2, defining the interview-first,
  no-invention path from natural language to committed artifacts.
- `STEER-The-Three-Surfaces.docx` — Practice Note 3, defining the intent
  backlog, pull boundary, role home, and protected attention hierarchy.
- `intent/0001/ARCHITECTURE.md` — the Gate 1 production foundation, stable
  seams, phase boundaries, and walking-skeleton acceptance exam.
- `docs/architecture/STEER-platform-end-state-phased.png` — the visual
  projection of that phased architecture.
- `kit/learn-manifest.json` — the v3.1 human and agent corpus map used by the
  Learn hub, role slices, orientation paths, and build-time version guard.

## Implementation evidence

The active implementation and its intent-by-intent ledger are documented in
`docs/IMPLEMENTATION.md` and `docs/INTENT-COMPLETION.md`. The authority,
projection, and v3.1 synchronization rules for the full document set are in
`docs/DOCUMENTATION-MAP.md`. Run `pnpm check` to validate the Phase 0 kit,
scope policy, TypeScript, automated exam cases, and production build.
