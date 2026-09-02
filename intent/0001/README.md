# 0001 · Flight Deck foundation

Stage: work item scope definition for the platform itself (Phase 0-1).

| Artifact | Status | Next signature |
|---|---|---|
| 0001-BRIEF.md | draft | Gate 1: Product Lead + Product Designer; Tech Lead feasibility |
| 0001-SPEC.md | draft | signed with the brief at Gate 1; flagged concerns routed first |
| 0001-ARCHITECTURE.md | Gate 1 draft | approve the production foundation, seams, phase boundaries, and owned open decisions |
| 0001-EXAM.md | draft | Gate 2: Tech Lead, after Critic findings resolved |
| 0001-PLAN.md | planning draft; read-only | bind to the Gate 2 revision before execution |

The current Vite/React fixture application is the UX and domain prototype for
this item. `0001-ARCHITECTURE.md` defines the production Phase 1 foundation and
the walking-skeleton exam that must pass before that architecture is called
implemented.

Implementation has started through child item `../0005`: the production
workspace and Next.js web shell. Child item `../0006` extracts the existing
provider-free domain into its owned package. The remaining slices stay
unclaimed.
