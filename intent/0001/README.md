# 0001 · Flight Deck foundation

Stage: work item scope definition for the platform itself (Phase 0-1).

| Artifact | Status | Next signature |
|---|---|---|
| 0001-BRIEF.md | Gate 1 accepted at `281c973` | Gate 2 remains separate and binds the Exam |
| 0001-SPEC.md | Gate 1 accepted at `281c973` | Gate 2 remains separate and binds the Exam |
| 0001-ARCHITECTURE.md | revision 2 accepted at Gate 1 (`281c973`) | implement and prove the walking skeleton |
| 0001-EXAM.md | protected v3.2 candidate published by `steer-test-agent[bot]` at `118302e`; round-one review returned send-back | HR-01, App-authored corrected revision, seven new domain reviews, final Critic, then Gate 2 |
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
separates technical-release from pilot-outcome completion, and remains unsigned.
Round one produced seven independent `send-back` records and one consolidated
31-finding exception brief. The unsigned remediation package has a technical
preflight PASS after independent Critic/remediation loops, but the canonical
Exam has not changed. HR-01 acceptance of the exact retention policy is the sole
current commercial human blocker. After HR-01, the authorized Test Agent App
must publish the corrected Exam, all seven domains must review that new exact
revision, and a final fresh-context Critic must pass. Actor-bound repository CI
is implemented; the external GitHub hardening checklist is
[`docs/GITHUB-EXAM-PROTECTION.md`](../../docs/GITHUB-EXAM-PROTECTION.md).

The control-only rollout is recorded at
[`evidence/github-exam-protection-rollout.json`](evidence/github-exam-protection-rollout.json).
The workflow and CODEOWNERS rules are active on protected `main`. Pull request
`#7` verified that the human Builder identity is rejected on the exact numbered
Exam, while App-authored pull request `#8` passed actor-bound CI, remained
blocked pending human CODEOWNER review, and became clean only after that
approval. Both evidence PRs were closed without merge.

The second exact-revision Critic review is
[`reviews/gate-2-critic-ab1d036.json`](reviews/gate-2-critic-ab1d036.json).
It closes four original findings and returns **HOLD / SEND BACK** on the two
remaining human/external evidence obligations. It is not a Gate 2 signature.

The seven required agent-first domain reviews are routed in
[`reviews/domain/README.md`](reviews/domain/README.md). The packets bind the
authorized revised Exam digest and revision target, separate Gate 2 Exam
review from future technical-release proof, and route humans only when a
deterministic escalation trigger fires. Their agent dispositions are not gate
signatures. Round-one records and the consolidated exception brief are preserved
there; the current unsigned candidate and complete preflight trail are under
`reviews/domain/remediation`.

The current Vite/React fixture application is the UX and domain prototype for
this item. `0001-ARCHITECTURE.md` defines the production Phase 1 foundation and
the walking-skeleton exam that must pass before that architecture is called
implemented.

Implementation started through child item `../0005`: the production
workspace and Next.js web shell. Child item `../0006` extracts the existing
provider-free domain into its owned package. The remaining slices stay
unclaimed.
