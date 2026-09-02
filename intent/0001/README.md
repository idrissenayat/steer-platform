# 0001 · Flight Deck foundation

Stage: work item scope definition for the platform itself (Phase 0-1).

| Artifact | Status | Next signature |
|---|---|---|
| 0001-BRIEF.md | Gate 1 accepted at `281c973` | Gate 2 remains separate and binds the Exam |
| 0001-SPEC.md | Gate 1 accepted at `281c973` | Gate 2 remains separate and binds the Exam |
| 0001-ARCHITECTURE.md | revision 2 accepted at Gate 1 (`281c973`) | implement and prove the walking skeleton |
| 0001-EXAM.md | unsigned independent Test Agent candidate; incorporates the supplied Exam and Architecture revision 2 | exact-revision fresh-context Critic, domain reviews, then human Gate 2 decision |
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

The predecessor Exam reviewed there is preserved byte-for-byte at
[`sources/EXAM.supplied.md`](sources/EXAM.supplied.md). The canonical Exam is now
a new unsigned candidate bound to the accepted Gate 1 commit and Architecture
revision 2. It activates and routes all applicable default-closed domains,
separates technical-release from pilot-outcome completion, and remains blocked
on a new exact-revision Critic plus human reviews. Actor-bound repository CI is
implemented; the external GitHub hardening checklist is
[`docs/GITHUB-EXAM-PROTECTION.md`](../../docs/GITHUB-EXAM-PROTECTION.md).

The control-only rollout is recorded at
[`evidence/github-exam-protection-rollout.json`](evidence/github-exam-protection-rollout.json).
The workflow and CODEOWNERS rules are active on protected `main`; the live
unauthorized-Builder and distinct authorized-Exam-author pull-request tests
remain pending a separate GitHub identity.

The current Vite/React fixture application is the UX and domain prototype for
this item. `0001-ARCHITECTURE.md` defines the production Phase 1 foundation and
the walking-skeleton exam that must pass before that architecture is called
implemented.

Implementation started through child item `../0005`: the production
workspace and Next.js web shell. Child item `../0006` extracts the existing
provider-free domain into its owned package. The remaining slices stay
unclaimed.
