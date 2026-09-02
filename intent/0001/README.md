# 0001 · Flight Deck foundation

Stage: work item scope definition for the platform itself (Phase 0-1).

| Artifact | Status | Next signature |
|---|---|---|
| 0001-BRIEF.md | Gate 1 accepted at `281c973` | Gate 2 remains separate and binds the Exam |
| 0001-SPEC.md | Gate 1 accepted at `281c973` | Gate 2 remains separate and binds the Exam |
| 0001-ARCHITECTURE.md | revision 2 accepted at Gate 1 (`281c973`) | implement and prove the walking skeleton |
| 0001-EXAM.md | Gate 2 sent back at `a43b32a`: 3 blockers, 3 majors | independent Test Agent revision, then a new fresh-context Critic |
| 0001-PLAN.md | Gate 1 accepted at `281c973`; execution still Gate 2-bound | bind to the Gate 2 revision before further gated execution |

The authoritative Gate 1 approval is the detached, provider-recorded signature
record at [`signatures/gate-1.json`](signatures/gate-1.json). It binds Idriss
Enayat's Product Lead and Product Designer hats, in sequence, to the complete
commit hash and preserves the signed artifacts unchanged. It approves the
architecture choices but expressly does **not** authorize infrastructure
spending; any paid deployment requires a separate approval.

The first fresh-context Gate 2 review is recorded at
[`reviews/gate-2-critic-a43b32a.json`](reviews/gate-2-critic-a43b32a.json). Its
disposition is **HOLD / SEND BACK** with six unresolved findings. It is not a
Gate 2 signature and cannot be used as implementation authorization.

The current Vite/React fixture application is the UX and domain prototype for
this item. `0001-ARCHITECTURE.md` defines the production Phase 1 foundation and
the walking-skeleton exam that must pass before that architecture is called
implemented.

Implementation started through child item `../0005`: the production
workspace and Next.js web shell. Child item `../0006` extracts the existing
provider-free domain into its owned package. The remaining slices stay
unclaimed.
