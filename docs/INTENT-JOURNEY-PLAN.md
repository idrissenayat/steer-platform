# Complete the actual intent journey

Owner: STEER implementation loop. User-approved direction: 2026-09-07.
Plan origin: `09c3ab8`; current implementation is recorded below. This plan controls delivery sequencing; it does
not replace signed requirements, alter gates or authorize model spending.

## End-to-end design checkpoint — 2026-09-07

The user requested the process flow, workflow and architecture before further
integration rework. Use [the end-to-end blueprint](architecture/END-TO-END.md)
and [workflow contract](architecture/WORKFLOW-CONTRACT.md) to connect I1–I6.
They distinguish candidate save, human pull, independent Exam and gate decisions.

Revision 2 addresses the five review findings in [the correction record](architecture/REVIEW-FIXES.md).
0205 implements the first pure-contract/test layer for final-edited scope
invalidation, contextual evidence, step ownership and candidate manifests, with
editor invalidation wired in. The next safe work is disabled adapters and integrated
tests against these contracts. D3's publication/discovery layout
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
| I1 Existing-scope review | Search permitted existing intents and their Brief/Spec scope before drafting; show exact sources, revision, matching passages, coverage and uncertainty. Distinguish already covered, partially covered, related, and no match found. Incomplete or unavailable search must never be presented as a new intent. | Lexical query/UI wired (0199–0200) and disabled same-commit source collector tested (0207); lifecycle/full-corpus assembly, live configuration, semantic judgments and orchestration pending |
| I2 Explicit disposition | Open existing, propose adding missing scope, or create a distinct linked intent with a reason. Keep original text. No automatic merge, discard, update or item creation. Record the human choice against reviewed source revisions; changed scope invalidates it. | UI proposal/recheck and server drafting consumption implemented (0201–0202); save consumption, durable recording and live acceptance pending |
| I3 Reliable drafting | Activate the configured Mastra/LiteLLM path with an approved capped budget and durable reservation ledger. Clarify conversationally, then produce source-faithful canonical Brief/Spec drafts and a fresh-context Test Agent Exam. Reject refusals, invalid outputs and invented facts; preserve unknowns explicitly. | Drafting (0198/0202), reservations/ownership (0203/0209), disabled result/original recovery (0217–0219), exact requests (0220), SQL step runner (0221), encrypted observations (0222), offline Mastra transport/journal binding (0223) and reference-only Temporal role sequencing (0224) tested; actual API/editor binding, live provider evidence/approval, cost bounds, authorized recovery and content/eval acceptance pending |
| I4 Review without loss | Show and edit all three documents, connect corrections to the source, expose conflicts/assumptions, preserve durable draft state across navigation, expiry, refresh and restart within the approved records policy. Never silently erase user work. Support retry without duplicate paid runs. | Editing/original comparison and invalidation implemented (0204–0205); disabled encrypted originals, server lifecycle and immutable source/clarification/document revisions tested (0213–0215); recorded generation checkpoints/Temporal roles (0217–0224) and uninstalled HTTP-to-SQL draft acknowledgement/readback (0225) tested; actual editor transport/state, real runtime/records activation and full live acceptance pending |
| I5 Save and reopen | Recheck scope and duplicate-review revisions immediately before an atomic, idempotent bundle write. Concurrent new intents/changes cause re-review, not two creations. Use actual granted GitHub paths and expected-head checks; uncertain saves require status/readback. Reopen exact saved versions in the application. | Disabled planner/reader, collector, bundle store, durable dispatch, candidate-save Temporal, receipt reconciliation and encrypted immutable originals implemented (0205–0213); verified lifecycle/full-corpus authority, key/recovery controls, quarantined-outcome resolution and actual UI integration incomplete |
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

0205 implements exact scope fingerprints/save comparisons and actual editor review
invalidation; bounded full-document evidence/citation validation; pure fenced step
transition planning; and candidate/amendment file plans that exclude canonical
Spec/Exam writes. [Evidence](../intent/0205/EVIDENCE.md) distinguishes each tested
contract from integrated runtime behavior. All I1–I6 acceptance remains open.

Next unblocked implementation sequence:

1. Disabled exact bundle/pointer reading, configured-item source collection and
   CAS bundle/receipt storage are implemented in 0206–0208. The store requires a
   trusted atomic dispatch/authority service; its synthetic test port is not that
   service. 0209 implements durable ownership; 0210 composes it with the writer
   using separate immutable admission and receipt digests. Current authority still
   requires trusted external evidence ports, not fixture assertions. Verified
   canonical-versus-proposed lifecycle selection and full permitted-corpus assembly
   must be integrated before semantic clearance or actual save authority; filenames
   and configured-item coverage do not supply either.
2. Operation uniqueness, atomic step claim/reservation/CAS and verified checkpoint
   references are implemented and tested against disposable PostgreSQL in 0209.
   0210 joins candidate saves to this dispatch protocol without runtime activation.
   0211 adds reference-only candidate-save Temporal execution with explicit no-retry
   boundaries. 0212 adds separately authorized receipt-to-checkpoint reconciliation
   for sent/succeeded candidate steps. Next compose original-payload storage and
   current authority, then durable development-role activities. 0216 removes SQL
   locks and pool leases from generic checkpoint readback, with exact short-lived
   proofs and current-state rechecks before mutation. 0217 now composes actual
   encrypted role-result readback with SQL steps and source revisions; original
   prompt/evidence storage, provider provenance and durable activities remain open.
   Synthetic model/authority fixtures and stored checkpoint bytes
   do not supply approved encrypted draft storage. Explicit linked new attempts,
   verified unknown-outcome resolution and recovery reconciliation remain open.
3. Compose authorized inventory reads with the evidence envelope and a pinned,
   budgeted semantic role; add contextual batching/hybrid retrieval and evals.
   The initial full-document envelope stops at 32 sources, 32,000 bytes per source
   and 128,000 included bytes, marking omissions incomplete rather than excerpting.
4. Integrate draft revisions and final review/save UI behind those services. Real
   draft persistence still needs D1 adoption; live model usage and runtime Git
   writing still need their existing scoped approvals. Do not block steps 1–3's
   synthetic/disabled implementation while awaiting activation decisions.

0206 adds the disabled exact historical bundle/pointer reader and shared strict
manifest schemas; see [evidence](../intent/0206/EVIDENCE.md). Native-Git/synthetic-provider
checks are not a real user save/reopen demonstration. Catalog enumeration, current
lifecycle selection, the writer and actual UI/tool bindings remain incomplete.

0207 adds same-commit directory inventory and a disabled source collector that
separates root, candidate and amendment scopes, follows current pointers only and
accounts for missing/corrupt sources and limits. [Evidence](../intent/0207/EVIDENCE.md)
records native-Git/synthetic-provider checks. Lifecycle selection deliberately
remains unverified; this is not a full authoritative catalog, semantic duplicate
assessment or an enabled UI workflow.

0208 adds the uninstalled GitHub bundle store: exact confirmation-bound receipt,
seven-file candidate/revision or six-file amendment commit, native expected-head
CAS, prior-pointer checks, whole-commit readback and original-operation recovery.
It shares bounded provider I/O with the existing Brief store. [Evidence](../intent/0208/EVIDENCE.md)
separates its synthetic dispatch proof from the still-required durable one-way
claim, lifecycle/source authority and real protection acceptance. No UI save,
model call or runtime write is enabled. Next implement the atomic operation/step
claim and checkpoint adapter against a disposable database, without real provisioning.

0209 adds that uninstalled operation/step adapter, atomic cost reservation, fenced
pre-dispatch takeover and one-way acknowledged dispatch. PostgreSQL verifies
cross-process contention and reconstruction without buying/sending another step;
see [evidence](../intent/0209/EVIDENCE.md). Result readback uses a required trusted
port and stores only digest/reference metadata. Real draft persistence and policy
adoption remain open. The local migration command now holds the expanded schema
before any real private-state/database work; normal startup is unchanged. Next
compose ownership with Temporal and bundle dispatch, verified lifecycle/full corpus,
current authority and approved result storage. No live model/save capability is enabled.

0210 composes durable candidate operation admission and one-way dispatch with the
GitHub bundle writer. Concurrent adapter instances share the SQL owner; reconstructed
sent steps use read-only provider recovery, including when the receipt is absent.
Eight new checks combine real disposable PostgreSQL and native Git behind synthetic
HTTP/authority ports. [Evidence](../intent/0210/EVIDENCE.md) distinguishes the
immutable pre-ID admission digest from the actual operation-bound receipt digest.
The composition remains uninstalled. Original-payload retrieval, verified authority,
receipt checkpoint resolution, Temporal and actual UI integration remain next.

0211 connects candidate saves to a dedicated, uninstalled Temporal activity/worker
and deterministic workflow. Only organization, operation ID and final input digest
enter history; original documents are loaded and verified inside the activity.
Actual owned Temporal/PostgreSQL/native-Git tests cover queued execution, replay,
no automatic retry, private-history exclusion and cancellation before/after the Git
effect. [Evidence](../intent/0211/EVIDENCE.md) keeps a completed workflow with an
unknown outcome distinct from a committed save. Real original-payload storage,
current authority, receipt reconciliation, development-role execution and UI
integration remain incomplete; no live activation occurs.

0212 adds explicit, separately authorized `reconcile(originalRequest)` to the
uninstalled candidate store. It reads/verifies the actual Git receipt before SQL,
then checkpoints that immutable evidence without holding a transaction over the
provider read. Lost SQL acknowledgement and repeated reconciliation cannot resend
Git work. Missing/corrupt receipts remain unknown/conflict; known failures and
manually quarantined outcomes cannot be cleared by this method. See
[evidence](../intent/0212/EVIDENCE.md). There is no automatic workflow/UI invocation,
payload storage or new authority. Original-payload persistence/current authority
and durable development-role integration remain the next independent work.

0213 implements disabled encrypted immutable candidate-original storage and supplies
it to the actual disposable candidate Temporal tests. The workflow reloads the exact
confirmed three-document request after writer-store closure, then saves once; raw
bytes and encryption keys never enter workflow history. Same-draft clocks/holds
latch across stored revisions, and wrong-owner/corrupt/expired data is unavailable.
See [evidence](../intent/0213/EVIDENCE.md). This is not conversation autosave, a
versioned editor or generation checkpoint service. D1 remains unsigned/inactive,
and real migrations stay held. Next implement those broader draft/result services,
authoritative lifecycle/key-recovery controls and durable development-role execution
before actual UI acceptance. No paid/model/Git runtime activation occurs here.

0214 supplies disabled server-owned draft creation, fixed clocks and durable
discard/hold/publication restriction metadata. The candidate workflow test uses
this actual SQL lifecycle loader; a hold recorded after queueing prevents original
restoration and Git dispatch. See [evidence](../intent/0214/EVIDENCE.md). Qualified
hold and publication verification remain required trusted services with synthetic
test ports. No real policy adoption, disposal, key recovery, runtime migration or
UI activation occurred. Versioned draft/checkpoint content and development-role
execution remain the next independent implementation work.

0215 adds disabled encrypted revision history for original text, clarification
turns and editable Brief/Spec/Exam content. Parent revision/digest CAS protects
concurrent edits; identical commands recover their original acknowledgement, even
after newer edits. Actual SQL lifecycle and historical keys govern every restore.
The candidate workflow test reads a persisted source/document snapshot before
admission and one-way save. See [evidence](../intent/0215/EVIDENCE.md). This is not
live editor autosave, generation-result provenance or lossless UI acceptance.
Next implement role checkpoints/durable development execution, current-source
authority and actual editor acknowledgements/conflict/restore. D1 remains inactive
and the real migration baseline unchanged; no live model/save activation occurs.

0217 adds disabled encrypted role-result capture bound to actual source revisions
and dispatch-committed SQL steps, consumed by the real checkpoint reader. Its test
chain advances from a preserved Architect output to Test Agent without another
Architect charge. Captured bytes/role labels are not proof of provider delivery,
fresh context or content adequacy. Prompt/evidence originals, provider provenance,
durable development activities and actual editor integration remain open. Historical
result access currently also requires the original operation configuration to
remain valid (maximum 24 hours); longer-lived scoped reads remain to implement.
See [0217 evidence](../intent/0217/EVIDENCE.md). No live persistence or model/save
authority is activated; I1–I6 remain incomplete.

0218 adds the separate disabled historical-read path for retained result originals
after actual operation expiry. It requires current historical authority, keeps
draft/source/key/lifecycle limits, omits checkpoint continuation references and
never renews jobs, budgets or expired grants. Active read/put/checkpoint paths do
not fall back to history. See [0218 evidence](../intent/0218/EVIDENCE.md). Original
prompt/evidence storage, provider provenance, durable role activities and actual
editor integration remain next; no live authority or UI acceptance is supplied.

0219 adds disabled encrypted original-operation context: exact source/clarification,
evidence bytes/omissions, declared direction, both instruction profiles and original
execution configuration. Scoped records authority can restore that configuration
without an in-memory copy; expired result history then consumes it under separate
current authority without renewing the job. See [0219 evidence](../intent/0219/EVIDENCE.md).
Rendered role requests and provider provenance, durable activities, real authority
and editor integration remain open; no D1 activation or I1–I6 acceptance occurred.

0220 adds exact private role-context rendering and its current-authority reader.
Original source/Brief/Spec corrections and evidence remain visible; prior Exam and
Architect commentary fields are excluded from Test Agent input. Actual succeeded
Architect readback must bind the true rendered request digest before Test Agent
preparation, with current source/state checks. See [0220 evidence](../intent/0220/EVIDENCE.md).
This is not persisted/observed provider-request capture, paid dispatch, independent
agent execution or UI acceptance. Provider provenance, durable role activities and
actual editor/API integration remain next; D1/live authority stays inactive.

0221 composes exact request preparation, atomic reservations, acknowledged dispatch
and encrypted role checkpoints in an uninstalled step runner. Completed Architect/
Test Agent results can be reused without another model call; unknown outcomes stay
blocked, and newer human edits stay intact. This orchestration is independently
testable behind mandatory recorded-model ports; the production request/response/
usage recorder and independent readback are still absent. See
[0221 evidence](../intent/0221/EVIDENCE.md) for actual versus synthetic boundaries.
Complete that recording binding before activation, then reference-only Temporal
development activities and actual editor/API acknowledgement/recovery. No live
model authority, D1 adoption, migration or I1–I6 acceptance is inferred.

0222 adds separately immutable encrypted request/response observations and actual
SQL readback in the step-runner integration. Bodies, nullable usage and provider
references stay private and bind the actual sent step; only synthetic transport
observations were tested. The real serializer/parser and usage capture must still
bind those bodies to the exact rendered request and result before provider
provenance is established. See [0222 evidence](../intent/0222/EVIDENCE.md).
Next finish that transport binding, then Temporal development activities and actual
editor/API recovery. Twenty-one development migrations remain held against the
seven-entry real baseline. D1 and all live/I1–I6 acceptance remain inactive/open.

0223 binds the installed Mastra/OpenAI-compatible serializer and parser to actual
SQL observation recording in an uninstalled worker factory. It verifies exact
request/response/result/usage correspondence; only a new acknowledged request can
reach transport, and final source/state checks follow authorization waits. Existing
records cannot trigger another send. Synthetic transport is still the only provider
used in tests; see [0223 evidence](../intent/0223/EVIDENCE.md).
Next implement reference-only Temporal development activities/workflow and actual
API/editor recovery. Live profile/pricing validation, cost approval, failed-response
investigation, D1 adoption and runtime saving remain separate requirements. No
actual UI or I1–I6 acceptance is claimed, and no migration or live binding is enabled.

0224 adds reference-only Temporal development sequencing and dedicated activity/
worker factories over the actual SQL/recorded-model composition. It stops for
clarification, supersession or uncertainty, rejects duplicate starts and supports
checkpoint reuse without generation. Questions/documents never enter normal
workflow messages or history. See [0224 evidence](../intent/0224/EVIDENCE.md).
Actual API/editor acknowledgement, status, restoration and conflict handling remain
next, alongside authoritative full-corpus assembly and semantic assessment. No
runtime registration, D1 adoption, real database change or model/save grant was
enabled. I1–I6 live acceptance remains open.

0225 connects the shared create/append/read draft tools to an uninstalled service
over actual encrypted lifecycle/revision stores. It distinguishes a reference from
preserved content and from Git saving; exact mutation replay and CAS conflicts
preserve later edits. HTTP handler-to-SQL tests cover large documents and private
restoration with synthetic identity/records authority. See
[0225 evidence](../intent/0225/EVIDENCE.md). Actual editor transport/state integration
and current-authority development progress/result retrieval remain next. D1 adoption,
real runtime binding and all live I1–I6 acceptance remain outstanding.
