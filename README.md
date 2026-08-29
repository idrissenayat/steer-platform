# Flight Deck — the STEER platform pod

This folder is the intent home of the pod building the STEER platform.
The platform is built using STEER itself: every feature enters as a brief,
carries an exam, and passes the gates. The pod's own metrics, recorded from
item one, are the framework's pilot evidence.

## The chain so far

| Artifact | Status | Next signature |
|---|---|---|
| intent/BRIEF.md | draft | Gate 1 — Product Lead + Product Designer; Tech Lead feasibility |
| intent/SPEC.md | draft | signed with the brief at Gate 1; flagged concerns routed first |
| intent/EXAM.md | draft | Gate 2 — Tech Lead, after Critic findings resolved |
| PLAN.md | not yet | produced by an agent in a read-only planning pass after Gate 2 |

## Item: intent-detail-view (candidate, not yet pulled)

| Artifact | Status | Next signature |
|---|---|---|
| intent/intent-detail-view.md | candidate in the intent backlog | pull by Product Lead |
| intent/intent-detail-view.SPEC.md | draft | Gate 1, after pull; accessibility flagged |
| intent/intent-detail-view.EXAM.md | draft | Gate 2; section D approved before code (default-closed) |

Sequencing note: the instrumentation baseline item precedes this one per
the spec; the outcome contract's baseline must exist before this ships.

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
- `STEER-Operating-Model.docx` — accountabilities and organizational operation.
- `STEER-Sizing-and-Scoping.docx` — Practice Note 1, with the complete guidance
  for exam-writability, splitting, aging bands, and percentile forecasting.
- `STEER-Providing-Intent.docx` — Practice Note 2, defining the interview-first,
  no-invention path from natural language to committed artifacts.
- `STEER-The-Three-Surfaces.docx` — Practice Note 3, defining the intent
  backlog, pull boundary, role home, and protected attention hierarchy.

## Implementation evidence

The active implementation and its intent-by-intent ledger are documented in
`docs/IMPLEMENTATION.md` and `docs/INTENT-COMPLETION.md`. Run `pnpm check` to
validate the Phase 0 kit, scope policy, TypeScript, automated exam cases, and
production build.
