# End-to-end design review corrections

Revision 2 · 2026-09-07 · Review target: `6bc681840f1c35cb6f56824721bc9e1a5c680256`

The user requested corrections before implementation. This record distinguishes
specified design fixes from implemented software and formal gate acceptance.
The technology baseline is unchanged; no new framework/provider is selected.

| Review finding | Revision 2 correction | Required acceptance / remaining boundary |
| --- | --- | --- |
| R1 — Edits could retain a stale duplicate review | [Dependency table and final-scope binding](WORKFLOW-CONTRACT.md#revision-dependencies-and-the-save-precondition) make every Brief/Spec byte change invalidate source assessment, direction and downstream applicability. Generated scope also gets assessed. | Introduce an already-existing requirement only through a Spec edit; old review/consent must fail. Exam-only edits become unreviewed proposals, never fresh independent acceptance. Design specified; runtime pending. |
| R2 — Lexical excerpts miss meaning and exclusions | [Semantic evidence contract](WORKFLOW-CONTRACT.md#retrieval-and-semantic-assessment-contract) requires complete inventory accounting, hybrid/exhaustive recall, enclosing sections/headings, verified byte-range citations and explicit abstention. | Paraphrased password recovery must be retrieved and explained; a separate Out-of-scope heading must survive. Current lexical code still fails these probes; no model-quality pass is claimed. |
| R3 — Operation IDs did not prevent repeated paid steps | [Execution ownership](WORKFLOW-CONTRACT.md#durable-execution-ownership) adds unique step claims, fencing, transaction-bound cost reservations, a one-way dispatch boundary and persisted role checkpoints. | Competing workers, lost dispatch acknowledgement and process death cannot repeat a possibly sent call. Known Test Agent failure resumes without regenerating the Architect result. Design specified; runtime pending. |
| R4 — Durable drafts contradict the accepted memory-only policy | [Exact proposed records amendment](DRAFT-RECORDS-AMENDMENT.md) states the actual conflict, finite classes/clocks, ownership, encryption, backup/hold treatment and adoption sequence. | Qualified exact-revision approval and demonstrated controls remain required before activation. No original signed policy is overwritten or treated as implicitly amended. |
| R5 — Candidate paths and canonical Exam protection were unresolved | [Publication/discovery contract](WORKFLOW-CONTRACT.md#candidate-publication-discovery-and-promotion) fixes bundle/pointer/receipt paths, new-vs-amendment writes, catalog resolution, exact reopen and independent promotion. | Atomic new candidate, amendment discovery, missing/malformed pointers and forbidden canonical Exam writes must be tested together. Existing readers/writers are not relabeled compatible. |

## First implementation checkpoint — 0205

The pure-contract/test layer now includes exact edited-scope and save bindings,
whole-document verified evidence with incomplete coverage states, fenced step
transition planning and inert candidate/amendment file plans. Editor invalidation
is wired into the actual conversation component; prior source review is historical
once documents exist. See [0205 evidence](../../intent/0205/EVIDENCE.md).

This is partial implementation of R1/R2/R3/R5, not closure of their integrated
acceptance. In particular, current lexical retrieval is unchanged, no semantic
model quality is proven, step plans do not commit database transactions, candidate
plans do not write Git, and catalog/reopen adapters are still missing. R4 remains
an unsigned policy proposal. The Spec-edit invalidation row explicitly includes
Spec conformance because that review must bind the exact selected Spec bytes.

## Implementation order after this correction

1. Pure contracts and synthetic negative tests for final-scope invalidation,
   evidence envelopes, operation ownership and publication manifests.
2. Disabled storage/worker/reader/writer adapters against those contracts; do not
   persist real private text under an unapproved policy.
3. Qualified adoption/incorporation of the records/architecture amendment, required
   protection review and exact runtime grants. This is separate from approving
   the design direction or a model budget.
4. Authorized real-source binding and approved capped model profile, then the
   actual UI save/reopen acceptance in I1–I6. Whole Phase 1 acceptance stays separate.

The [current journey plan](../INTENT-JOURNEY-PLAN.md) uses this sequence. This is
not an independent Critic report, Test Agent signature or closure of protected
Gate 2 findings. The original documentation correction changed no production code,
service, grant, secret or paid model call; the subsequent 0205 implementation is
separately recorded above.

## Verification of this revision

- All three Mermaid diagrams rendered; the changed sequence and architecture
  images were visually inspected.
- All 182 local links/heading anchors across the ten changed documents resolved.
- `pnpm kit:check` passed (95 required artifacts); `pnpm security:check` and
  `git diff --check` passed.
- Signed architecture, protected Exam and accepted HR-01-R2 policy hashes were
  rechecked and unchanged. The two pre-existing untracked user paths were preserved.
- These checks verify document integrity, not runtime enforcement, independent
  assurance, live model quality or the actual UI save/reopen journey.
