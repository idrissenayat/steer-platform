# Complete the actual intent journey

Owner: STEER implementation loop. User-approved direction: 2026-09-07.
Current base: `09c3ab8`. This plan controls current delivery sequencing; it does
not replace signed requirements, alter gates or authorize model spending.

## End-to-end design checkpoint — 2026-09-07

The user requested the process flow, workflow and architecture before further
integration rework. Use [the end-to-end blueprint](architecture/END-TO-END.md)
and [workflow contract](architecture/WORKFLOW-CONTRACT.md) to connect I1–I6.
They distinguish candidate save, human pull, independent Exam and gate decisions.

Revision 2 addresses the five review findings in [the correction record](architecture/REVIEW-FIXES.md).
The next safe work is pure contracts and non-billable negative tests for final-edited
scope invalidation, contextual semantic evidence, operation/step ownership and
candidate manifests, followed by disabled adapters. D3's publication/discovery layout
is now specified; it is not a grant to write or promote canonical Exams.

D1's [exact records amendment](architecture/DRAFT-RECORDS-AMENDMENT.md) remains
unsigned and inactive. Real draft persistence needs qualified exact-revision
adoption and enforced recovery/retention controls; live publication/promotion needs
its protection review and current authority. Do not block independent contract
development on those activation decisions, and do not treat an older “next” note
as permission to install real persistence under the existing memory-only policy.

## Completion means a demonstrated human journey

In the actual authenticated Next application at https://localhost:8443/, a person
can describe intent naturally, see whether it already exists or overlaps existing
scope, choose what to do, answer only necessary questions, review and correct a
Brief/Spec/Exam bundle, save it to the authorized repository and reopen it exactly.
No separate local preview, synthetic success, silent merging or lost work counts.

## Dependency-ordered implementation

| Step | Deliverable and acceptance | Status |
| --- | --- | --- |
| I1 Existing-scope review | Search permitted existing intents and their Brief/Spec scope before drafting; show exact sources, revision, matching passages, coverage and uncertainty. Distinguish already covered, partially covered, related, and no match found. Incomplete or unavailable search must never be presented as a new intent. | Candidate query and actual conversation UI wired (0199–0200); live read configuration, semantic judgments and intake orchestration pending |
| I2 Explicit disposition | Open existing, propose adding missing scope, or create a distinct linked intent with a reason. Keep original text. No automatic merge, discard, update or item creation. Record the human choice against reviewed source revisions; changed scope invalidates it. | UI proposal/recheck and server drafting consumption implemented (0201–0202); save consumption, durable recording and live acceptance pending |
| I3 Reliable drafting | Activate the configured Mastra/LiteLLM path with an approved capped budget and durable reservation ledger. Clarify conversationally, then produce source-faithful canonical Brief/Spec drafts and a fresh-context Test Agent Exam. Reject refusals, invalid outputs and invented facts; preserve unknowns explicitly. | Drafting composition (0198/0202) and durable reservation adapter (0203) tested; live binding/approval, cost bounds and content/eval acceptance pending |
| I4 Review without loss | Show and edit all three documents, connect corrections to the source, expose conflicts/assumptions, preserve durable draft state across navigation, expiry, refresh and restart within the approved records policy. Never silently erase user work. Support retry without duplicate paid runs. | Three-document editing/original comparison implemented (0204); durable versioned storage, restoration and full lossless acceptance pending |
| I5 Save and reopen | Recheck scope and duplicate-review revisions immediately before an atomic, idempotent bundle write. Concurrent new intents/changes cause re-review, not two creations. Use actual granted GitHub paths and expected-head checks; uncertain saves require status/readback. Reopen exact saved versions in the application. | Existing Brief-only infrastructure; bundle and live authority incomplete |
| I6 Human acceptance | In the real signed-in UI demonstrate new, exact duplicate, paraphrased duplicate, partial overlap, related-but-distinct, empty/failed/stale search, corrections, permission loss, cost exhaustion, uncertain save, concurrent creation, refresh/reopen and keyboard/narrow-screen behavior. Record real source and saved commit. | Pending |

I1's lexical retrieval is only a candidate finder, never a semantic verdict.
Explain matches using source excerpts and citations. Semantic coverage must respect
negation, excluded scope, different products/users and stale/closed intentions.
Completed and archived items can still contain relevant scope; status alone does
not mean the proposed work is a duplicate. Search must not expose other tenants.

## Execute as a loop

Read this plan and `PHASE-1-DELIVERY.md` plus current user instructions at each run.
Implement the next coherent unblocked portion, test it, update evidence and this
table honestly, then commit/push and verify the remote commit. Continue work in
dependency order; do not use another generic "continue" request as a handoff.
Prefer finishing the journey over unrelated boards, authentication redesign,
micro-increment ceremony or broad repeated Critic reviews.

Use synthetic provider responses only in clearly identified tests. They do not
complete I3 or I6. Do not claim "new" from a truncated/failed search, "saved" from
browser storage, "independent acceptance" from the drafting Test Agent, or completion
from an isolated module, status report or passing build.

If an indispensable user-only approval blocks a step, record it once, continue
independent authorized work, and keep quiet while unchanged. Never bypass a gate,
grant or budget to avoid a pause. Do not stop the loop merely after one increment.
Notify on meaningful capability delivery, failure, completion or a specific needed
decision. Disable the loop only when the plan is genuinely complete or the user
changes direction. The app must be running and able to resume scheduled work.

## Current authority and blockers

- Existing OpenAI key provisioning/reuse choice is resolved. Keep the key private;
  do not recreate it or request it in chat.
- The proposed **$5 total first-test model budget remains unapproved**. No live
  model calls until explicit approval. Continue non-billable implementation/tests.
- Real GitHub saving and gate authority remain closed. Identify the exact missing
  authority while implementing the bundle path; do not turn configuration into a
  fabricated approval or overwrite the canonical protected Exam.
- No deployment, release, deletion, subscription or infrastructure spend authorized.

## Current checkpoint

Plan and existing heartbeat updated. I1's bounded lexical candidate query is
implemented as `intent.overlap.check` with source evidence, permission checks,
coverage gaps and revision fingerprints; see `intent/0199/EVIDENCE.md`.
0200 mounts source review inside the actual conversation UI, with exact-revision
Brief links and visible coverage gaps. All six user-facing acceptance steps remain
open. 0201–0202 connect explicit direction proposals to server-rechecked drafting,
including clarification-aware invalidation and evidence for both drafting roles.
They remain unsaved. Next implement evidence-bound semantic review and
resolve the existing read-model configuration without weakening grants. Durable
draft and budget bindings can proceed without paid calls. Completion requires I6's
actual UI and repository evidence.

0203 adds a real-Postgres-tested durable reservation adapter; it is not provisioned
or installed in the actual workspace. It does not resolve the unapproved model
budget or verified upper-bound pricing/token configuration. Draft persistence,
semantic assessment and save/reopen remain open.

0204 adds editing and original comparison inside the actual conversation, preserving
per-document corrections while switching views. It remains explicitly in-memory;
durable authorized draft storage/restoration is the next I4 implementation task,
subject to the end-to-end design checkpoint above.
