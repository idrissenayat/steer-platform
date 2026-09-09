# Intent workflow contract and design decisions

Companion to [the end-to-end blueprint](END-TO-END.md) · Revision 2 · 2026-09-07.
Status: **proposed integration contract**. State/event labels below are design
names, not claims of existing database tables, API tools or deployed workers.
Existing signed policy wins until an explicit amendment is recorded.

Revision 2 specifies the five review corrections; see [the correction record](REVIEW-FIXES.md).
Increment 0205 implements the first pure-contract/test layer and editor invalidation;
see [implementation evidence](../../intent/0205/EVIDENCE.md) for its bounded scope.
The integrated behaviors below are not implemented runtime guarantees. The exact
[draft-records amendment](DRAFT-RECORDS-AMENDMENT.md) remains unsigned and inactive.

## 1. Four different acknowledgements

| User-visible state | Required evidence | Does not mean |
| --- | --- | --- |
| Draft preserved | Authorized server acknowledgement of the exact draft revision under an approved records policy | Committed to Git, visible in the backlog, or approved |
| Reviewing / drafting | An identified running operation; honest failure/unknown states | A completed document or permission to retry a paid request |
| Recorded in Git | Provider readback verifies the exact bundle hashes, destination, commit and operation receipt | Projection has caught up, work is in flight, or any gate passed |
| Ready for a gate | Current required artifacts and evidence, exact revision, eligible signer and policy checks | A signature; only the explicit human decision can create one |

Use “Save candidate bundle” for the explicit Git action. Do not label draft
autosave “Saved to Git.” If Git succeeded but projection failed, show the commit
with “workspace update pending,” not an invitation to create it again.

## 2. Proposed state and event contract

Draft workflow state is separate from candidate/flight/gate business state.
Every transition names its trigger, owner and output; no UI-only status advances
the business lifecycle. Server acknowledgement, not keystrokes, marks persistence.

| From → to | Trigger / owner | Required result and invalidation |
| --- | --- | --- |
| Editing → scope checking | Human submits; API accepts an authorized source revision | Preserve source and operation ID; establish exact permitted source coverage |
| Scope checking → awaiting direction | Source reader + assessment finish | Persist citations, coverage gaps, fingerprints and recommendation; no item mutation |
| Awaiting direction → existing opened | Human selects Open existing | Reauthorize the referenced item; finish without creating or merging |
| Awaiting direction → developing | Human confirms direction/reason; API rechecks scope | Bind choice to source revision, product/home, catalog and evidence fingerprints |
| Developing → needs clarification | Architect returns necessary questions | Preserve questions and source; no fabricated bundle |
| Needs clarification → scope checking | Human replies | Append a new source revision; invalidate the old assessment and confirmation |
| Developing → candidate-scope checking | Architect and independent Test Agent outputs validate | Preserve originals; assess generated Brief/Spec scope under its own reserved step |
| Candidate-scope checking → reviewable bundle | Final-scope assessment and source/auth checks finish | Show current assessment and proposed direction alongside documents; require current human confirmation before save; Exam is NOT RUN and unsigned |
| Reviewable → edited revision | Human corrects a document | New revision; retain originals; apply the deterministic invalidation table below |
| Edited revision → needs scope review | Any Brief/Spec bytes change | Invalidate direction confirmation; do not start a paid call while the user types |
| Needs scope review → scope checking | Human explicitly requests review of corrections | Assess final edited scope, not only the original message, under current grants and budget |
| Edited revision → developing | Human explicitly requests a new revision/reconciliation | Show what will be replaced; reserve new approved usage; never overwrite the old revision |
| Reviewable/edited → saving | Human confirms exact bundle/destination; API verifies current edited-scope review and authority | Reject stale scope or consent; persist a fixed save operation and expected Git head before issuing the write |
| Saving → recorded | Adapter verifies bundle and receipt at the returned commit | Immutable saved reference; request authorized projection, not another save |
| Saving → outcome unknown | Timeout or lost acknowledgement | Preserve operation ID; read provider status/receipt before any retry |
| Recorded → projected | Worker verifies source and idempotently updates read model | Reopen exact saved bytes; backlog candidate remains not pulled |

Any step can become **blocked** by denied authority, missing configuration,
incomplete source, budget exhaustion or invalid output. Preserve safe recoverable
state and a content-free reason code. After reauthentication, reauthorize before
restoring; another user or tenant must never inherit the previous draft. Session
expiry can clear the browser without deleting a separately retained server draft.

### Revision dependencies and the save precondition

Hash exact UTF-8 bytes, without whitespace or Unicode normalization. The
`scopeInputDigest` binds organization/product/home, source revision, original text,
all clarification turns and the current Brief/Spec content hashes (null before
generation). The initial interview review and final bundle review are different
inputs: generated or edited scope must never inherit clearance from raw intent.

| Changed bytes or binding | Required invalidation | What remains intact |
| --- | --- | --- |
| Source or clarification | Scope assessment, human direction, Spec/Exam applicability and save consent | Prior text, drafts and review history |
| Brief | Scope assessment, direction, Spec conformance, Exam applicability and save consent | Human Spec/Exam edits; reconciliation proposes changes, never overwrites them |
| Spec | Scope assessment, direction, Spec conformance, Exam applicability and save consent | Brief and every original/edit revision |
| Exam | Independent Exam review and save consent | Brief/Spec scope review if their bytes and source bindings are unchanged |
| Catalog/head, product/home, current permissions or retrieval configuration | Relevant source review and direction; reauthorize before every exposure/effect | Historical receipts, never promoted to current authority |
| A role's prompt/model configuration | That role's current assessment/review applicability and downstream dependencies | Previously accepted bytes, with their original provenance |

Treat every Brief/Spec byte change conservatively; do not ask a model to silently
waive invalidation as “only formatting.” A fresh review may preserve the chosen
direction as a proposal, but the human confirms the newly reviewed bundle once.
Typing and local corrections do not silently start paid calls. Explicit review
actions and approved policy control them.

Before Git save, require the exact current `scopeInputDigest`, source snapshot,
validated assessment and confirmed disposition. Bind consent to those references,
the complete bundle manifest hash, destination and expected head. Any change
invalidates consent. Capture an immutable save snapshot: if the user creates a
newer edit while it is recording, report “previous revision recorded; newer edits
not recorded,” and preserve both rather than applying the old response to new text.

A complete candidate bundle means all three documents are present, not all three
are approved. Exam edits may be recorded with `examReview.state=stale`; no gate
or independent-authorship badge may treat them as current. Gate 2 additionally
requires Spec conformance and independent Exam review at the exact selected
Brief/Spec/Exam hashes. Changing already signed scope uses a revision proposal and
the affected gates, not this draft editor as an override.

## 3. Records and identity needed before wiring more screens

These are required contract fields, not a new schema adopted by this document.

- **Scope:** organization, product, authorized home repository and immutable user
  subject; active hat only where the action requires it. A request body cannot
  select its own authority or credentials.
- **Draft:** draft ID, revision, parent revision, original text, clarification
  history, server acknowledgement, applicable records-policy version and ownership.
- **Scope review:** source revision/digest, inspected artifact refs and hashes,
  catalog/review fingerprints, coverage gaps, assessment/configuration revision,
  citations and the separate human disposition. Do not equate lexical similarity
  with semantic coverage or claim all repositories were searched.
- **Final-scope binding:** `scopeInputDigest` above and exact Brief/Spec hashes;
  the review must cover generated scope as well as user corrections.
- **Bundle:** bundle ID/revision, Brief/Spec/Exam hashes, source/review/disposition
  refs, author role/configuration, original generation and edit lineage, independent
  Exam review status. An edit changes the digest and invalidates prior save consent.
- **Operation:** stable operation ID, type, owner, input digest, configuration
  revision, lifecycle, reservation refs and provider receipt/result refs. Same ID
  with different input must conflict; the same logical retry must not start over.
- **Canonical save:** product/item home, exact paths, expected head, verified
  commit, bundle/receipt hashes, human acceptance provenance and actual service
  committer. Preserve both identities; do not pretend an App commit is a personal
  cryptographic human signature.

Content stays out of tracing, metrics, URLs and notification payloads. Durable
conversation storage needs its own approved classification, access, retention,
hold/deletion and backup/restore treatment. PostHog's 90-day content-free event
retention is **not** a policy for raw intent text. Do not infer authority to delete
anything from expiry, logout, or this design.

0219 adds disabled original-input preservation under the proposed draft class:
exact source/evidence/direction, separate instruction profiles and original
execution configuration. Restoring that configuration is a records read, not an
execution grant. Current source/owner/key/lifecycle authority remains required.
Rendered role requests are prepared in 0220; observed provider provenance remains
unimplemented. No profile label proves delivery, independent authorship or pricing
bounds.

### Durable execution ownership

0220 adds disabled deterministic private request preparation over retained inputs
and actual succeeded Architect checkpoints. Both source-revision Brief/Spec and
new candidate documents remain explicit; prior Exam and Architect commentary do
not enter Test Agent context automatically. Exact request hashes bind role steps.
Preparation/readback is neither a paid dispatch permit nor observed provider
delivery; actual request capture, provider provenance and durable activities remain
open. The packet contains private bytes and cannot be a Temporal/history payload.

0221 composes these readers with actual SQL claim/reservation, one-way dispatch and
encrypted result checkpoints in an uninstalled step runner. Current authority and
source/state checks precede the model port; a lost dispatch acknowledgement cannot
reach it. Completed results are re-verified and reused; uncertain work is not
resent, and late source edits produce a superseded result. Its required recorded-
model execution/verification ports have no production implementation yet. Testing
this orchestration independently does not replace actual durable provider request,
response and usage capture. It is not a Temporal activity registration, API route,
live execution grant or I3 acceptance. See [0221 evidence](../../intent/0221/EVIDENCE.md).

0222 adds disabled encrypted request/response observation storage. The journal
separates recorded request from response, binds exact role input and actual sent
ownership/reservation, and supports fresh SQL-backed readback in the step-runner
test chain. The transport serializer/parser still must prove correspondence between
the supplied bodies, rendered packet, role result and extracted usage. The fixture
does not contact a provider. No observation row grants dispatch, retry, history
access after job expiry or a gate decision. See [0222 evidence](../../intent/0222/EVIDENCE.md).

0223 implements the uninstalled Mastra serializer/parser-to-journal binding. Only
the first acknowledged request insertion can proceed to transport after renewed
authority and source/state checks; a recovered request is not another send permit.
The exact successful raw response is parsed and compared with the SDK result, then
encrypted before returning; checkpoint verification reparses actual stored bodies.
Tests exercise the installed SDK with synthetic responses, not a live gateway or
provider. Failed-response capture/investigation, pricing/route acceptance and
real records authority remain separate. See [0223 evidence](../../intent/0223/EVIDENCE.md).

The API accepts/queries operations; an internal Temporal workflow owns the long
conversation job. Use a draft-scoped identity before an item exists:
`steer-intent-development/v1/<organizationId>/<draftId>/<operationId>` with
unambiguous escaping. Temporal carries references, not conversation bytes. Worker
activities load authorized, unexpired content from the draft store. A browser
disconnect does not grant cancellation, resend authority or another execution.
The UI observes the same authorized operation ID through status/update tools.

Each review/develop submission is immutable. A new clarification or confirmed
direction starts a linked operation at its new draft revision. The API mints the
operation ID; creating a job is unique for its organization/draft revision/action/
configuration and returns the existing job on duplicate submission. Starting an
unknown ID is rejected, never recreated after record expiry. An intentional new
paid attempt must explicitly reference the previous attempt and be authorized;
opening another tab or inventing a fresh request ID is not that instruction.

1. A database uniqueness constraint on `(organizationId, operationId)` binds the
   original caller, draft revision, input digest and configuration revision. The
   same ID/different input conflicts; the same ID/same input returns its existing
   status/result without dispatch. Org Admin grants cannot be chosen by the client.
2. Each role step has unique `(organizationId, operationId, stepId)` and immutable
   input/configuration hashes. Steps include source assessment, Architect and Test
   Agent, plus embedding only when that approved retrieval profile requires it.
   An explicit new paid attempt is a new recorded attempt linked to the previous
   one, never an automatic consequence of a transport retry.
3. In one database transaction, claim a step with an incrementing fencing token
   and insert its uniquely keyed worst-case cost reservation under the budget lock.
   A reservation remains consumed on uncertainty. All claim/result mutations
   compare the token and expected state; an old worker cannot publish over a new
   owner. Existing `DevelopmentPermit.reserve()` and random reservation IDs do
   **not** implement this operation-scoped protocol. Increment 0209 adds a separate,
   uninstalled operation/step adapter with atomic unique reservations and fencing;
   it does not retrofit the legacy permit or complete live workflow composition.
4. Commit a one-way `dispatch-committed` state before the external model call;
   only the worker that receives an unambiguous acknowledgement may dispatch it
   once. Do not hold a SQL transaction open across the model request. A lease may
   be reassigned only before this dispatch boundary; it cannot turn a possibly
   sent call into a fresh call after timeout. Lost acknowledgement or worker death
   at/after this boundary means `outcome-unknown`, even if the request never left.
5. On success, validate and store the role result plus exact input/configuration
   hashes before advancing to the next role. Reuse that checkpoint only after
   current authority/source checks. If the Test Agent fails, a permitted explicit
   retry resumes that step without buying another Architect call. Unknown steps
   remain blocked unless verified provider/local evidence resolves them; an
   idempotency key alone cannot manufacture a provider replay guarantee.
6. Hashes and status can outlive draft content only under their approved class;
   expiry revokes result access and blocks continuation. Recovery checks policy,
   ownership, current source and result availability before doing work. Restored
   accounting cannot dispatch until reconciled with external consumption.

This is at-most-one authorized dispatch per step, with explicit uncertainty—not
an exactly-once external-effect claim. Process-local `busy` flags, Temporal workflow
ID retention and the spend cap are insufficient substitutes. Read/status retries
are permitted under current grants; paid activity retries are not automatic.

Implementation note (0216, inactive): generic checkpoint readback now follows an
effect-free SQL preflight, rollback and connection release. A trusted result reader
can reconstruct bytes without holding execution locks or a pool lease. A second
transaction rechecks current state/fence/authority/budget and only consumes the
exact call-local proof within five seconds of readback start. Failed cleanup,
concurrent quarantine, stale evidence or late close denies. No committed mutation
or external effect is retried. Generation-result storage/provenance remains pending.

Implementation note (0217, inactive): captured role outputs are now encrypted and
immutable, bound to actual source revisions and dispatch-committed SQL steps. The
execution reader verifies real stored bytes before advancing a checkpoint. This
does not establish provider delivery or model/role authorship. Prompt/evidence
originals, provider provenance and durable development activities remain open.
Result access currently also requires the original operation config to remain
valid; longer-lived historical read authority must not reactivate an expired job.

Implementation note (0218, inactive): that historical path now uses a separate
current-authority port and read-only expired-step metadata reader. The original
config is only a record-integrity binding. Historical outputs retain current
draft/source/key/hold restrictions and omit checkpoint continuation references.
No active mutation/checkpoint method falls back to history; expired jobs and their
spending/dispatch grants remain expired. This is not live records-policy adoption.

Implementation note (0210, inactive): candidate admission uses a separate versioned
digest over the complete submission, exact consent and publication/provider profile,
excluding the not-yet-minted operation ID. The immutable SQL operation then supplies
that server ID to the existing v2 write-plan/receipt digest and fenced step binding.
This avoids a circular ID/hash dependency without weakening either receipt binding
or duplicate-submission uniqueness. Changed publication configuration conflicts;
configuration fingerprints still do not verify the underlying gate/records grants.

Implementation note (0211, inactive): candidate-save Temporal history contains only
organization, server operation ID and final write digest, plus bounded result
metadata. The activity retrieves original bytes outside history and checks the
exact digest before SQL/Git composition. Automatic retries are disabled; workflow
ID retention does not replace SQL fencing. Cancellation may stop an unsent operation
but cannot erase an accepted external effect. Workflow completion with an unknown
outcome is not save completion, a resolved SQL checkpoint or human gate authority.

Implementation note (0212, inactive): an explicitly authorized reconciliation can
record a verified candidate receipt as a SQL result checkpoint. Read the original
provider receipt and exact saved bundle first, then consume a short-lived immutable
evidence binding inside the existing fenced checkpoint transaction. Never hold SQL
across Git reads, accept caller checkpoint assertions or treat receipt absence as
retry permission. The result digest uses the `steer-candidate-receipt-checkpoint/v1`
domain over organization, operation/input digest, commit/head and manifest/pointer
digests. The result reference is the original operation's receipt ID. This initial
path cannot release manually quarantined outcomes or erase known failures.

## 4. Duplicate prevention and atomic save

Implementation note (0213–0214, inactive): candidate workflow tests now reload
encrypted original requests with server-owned SQL draft IDs/clocks and current
lifecycle state. Idempotent creation never renews an existing draft. Explicit
discard and independently verified publication only shorten its fixed window;
qualified holds deny ordinary restoration, including for work already queued.
Authority/evidence/key ports are still synthetic in tests. No actual UI, live
policy adoption, key/all-copy lifecycle, versioned editor or generation-checkpoint
content storage is implied by these disabled adapters.

Implementation note (0215, inactive): encrypted content revisions now store exact
source, clarification turns and editable documents under the server lifecycle.
The service selects consecutive revisions, compares the expected parent digest,
and binds a stable mutation ID to its command. An old acknowledgement after newer
edits returns the original reference plus latest revision, never replacement bytes.
Actual UI/API wiring, verified generation provenance and role checkpoints remain
unimplemented. These stored snapshots alone confer no assessment or gate state.

1. Search authorized candidates and existing Brief/Spec scope, including relevant
   completed/archived records. Resolve product, user group, exclusions and negation.
   Cite evidence and distinguish coverage from confidence.
2. Offer Open existing, amendment/extension, or distinct linked intent with an
   explicit reason. A proposed extension is not permission to update signed scope;
   it creates a revision proposal subject to affected gates.
3. Recheck the exact source, current Brief/Spec scope and human direction before model work and before
   releasing the generated output. New clarification or changed sources invalidate
   confirmation. Incomplete search never supplies duplicate clearance.
4. Before saving, read the actual authorized Git head and reconcile the searchable
   catalog to it. If the projection lags, catch up or block; do not write using a
   stale read-model fingerprint while accepting a newer Git head.
5. Write the whole accepted candidate bundle and operation receipt in one commit,
   updating the branch only if its head still equals the reviewed expected head.
   Check permitted paths, author roles and digests on the server. No partial success
   after only BRIEF.md or SPEC.md has been written.
6. If another creation wins first, re-read/review before making a new attempt. Do
   not silently rebase a second creation onto the winner. A SQL lock or matching
   title is not sufficient; Git expected-head checks protect all participating writers.
7. On lost acknowledgement, resolve the original operation receipt at the provider.
   A committed result is returned as that result. An unresolved outcome stays
   unknown, never “not saved.” Projection recovery must not repeat the Git write.

This protocol prevents two *participating concurrent saves* from both bypassing a
fresh review. It cannot guarantee semantic uniqueness across inaccessible sources,
independent branches, or direct out-of-band commits. Reconciliation must surface
those conflicts. Scoped draft retrieval can warn about the same owner's other
permitted uncommitted drafts; cross-user private draft search is not authorized
by this contract and draft retrieval is not a canonical duplicate authority.

### Retrieval and semantic assessment contract

The existing `intent.overlap.check` is lexical discovery, not the input contract
for a complete semantic assessment. Revision 2 requires a separate server-owned
evidence envelope; a model may not invent document paths, quotations or scope.

- **Source snapshot:** bind authorized repository/branch/head, product scope,
  source inventory digest and cursor completion. Enumerate canonical documents
  and current candidate/proposal manifests using the publication contract below.
  Resolve and verify each cited blob at that head. Track missing, excluded,
  inaccessible, unindexed and unassessed sources separately; do not expose private
  item identifiers while describing access gaps.
- **Candidate recall:** inspect the complete declared inventory in bounded pages.
  Use the existing Postgres full-text/pgvector seams for hybrid discovery, with
  pinned query, chunking, embedding and ranking revisions. Small corpora may use
  bounded exhaustive batches. Lexical misses must still be eligible for semantic
  retrieval; the current first-50 scan/top-10 display list is not that corpus.
  Budget and token limits stop processing with explicit incomplete coverage;
  they do not manufacture a no-overlap result. No new search vendor is required.
- **Context:** send the enclosing section and its ancestor headings, bullet/list
  qualifiers and exclusions, not an isolated 500-character match. Represent each
  part by verified artifact hash and UTF-8 byte range into original content.
  A long section may be split only with its heading path and explicit neighboring
  context references; if essential negation or qualifiers are omitted, mark that
  assessment insufficient rather than claiming coverage.
- **Output:** require assessed target IDs, relation (`already-covered`, `partial`,
  `related-distinct`, `no-match-in-assessed-scope` or `insufficient-evidence`),
  overlap/missing-scope explanations, exact evidence IDs/ranges, coverage and
  configuration revision. Validate all citations against the server envelope.
  Confidence is not authority and no relation performs a merge, save or gate.
  Material unknowns or limit exhaustion prohibit automatic newness/duplicate
  clearance; do not offer a hidden “ignore missing evidence” override.
- **Final review:** assess the exact edited Brief/Spec input, not merely the
  original message. Recheck source snapshots after model work and before save.
  Human confirmation may choose a justified distinct intent; it cannot convert
  an incomplete search into a claim of comprehensive uniqueness.
- **Acceptance:** the pinned profile must retrieve and correctly explain the
  paraphrased password-recovery case, the separate “Out of scope” heading case,
  negation, partial scope, different products/users, archived/completed scope and
  candidate amendments. All mandatory fixtures need a correct relation and valid
  citations; incomplete/abstained cases remain incomplete, never counted as passes.
  Record assessed corpus/coverage, false positives and false negatives. This is
  prospective acceptance, not a claim the current lexical implementation passes.

Every model-based assessment and embedding call needs its own approved cost
reservation and configuration. No unapproved direct-provider call, silent fallback
or external embedding upload is introduced by this contract. Draft-derived vectors
are draft content derivatives under the records amendment, not an exempt cache.

### Candidate publication, discovery and promotion

Design layout (disabled reader/store primitives now exist in 0206–0208; the actual
runtime does not install this publication path):

```text
items/<NNNN-slug>/
  BRIEF.md                         current candidate Brief or accepted canonical Brief
  CANDIDATE.json                   current pre-pull candidate pointer, if one exists
  candidates/<bundle-uuid>/
    BRIEF.md
    SPEC.md
    EXAM.md
    MANIFEST.json                  immutable accepted candidate snapshot
  proposals/<proposal-uuid>.json    current amendment pointer, when applicable
  SPEC.md                          canonical framing publication, separate authority
  EXAM.md                          canonical independent Exam, separate authority
.steer/authoring/bundle-operations/<operation-uuid>.json
```

- A **new candidate** atomically creates root BRIEF, CANDIDATE pointer, all four
  immutable bundle files and the operation receipt (seven files). Root BRIEF must
  equal the selected bundle's Brief hash. No root SPEC/EXAM is created by this save.
- A **pre-pull correction** adds a new immutable bundle and updates the pointer
  and root Brief at an expected head; it never overwrites an old bundle. This is
  a separately authorized update, not the existing create-only Brief operation.
- An **extension/amendment to existing in-flight or signed work** adds the bundle,
  a proposal pointer and receipt without editing any canonical artifact or gate
  record. The proposal binds target item/revision and parent proposal, if any.
  Later corrections move only that proposal pointer via expected-head checks.
  A distinct linked intent instead gets a new item and an explicit relationship.
- `MANIFEST.json` uses `steer-candidate-bundle/v1` and contains org/product/home,
  item and bundle UUIDs, previous bundle digest or null, purpose (`new-candidate`,
  `candidate-revision`, `amendment`), target or relationship refs, three exact
  relative paths/hashes, final-scope review/disposition refs, content-minimized
  author/edit lineage, Spec conformance and Exam review states. Do not include raw
  conversation or private generated originals. Bind originator and actual service
  committer separately. The immutable bundle is what the human explicitly chose
  to publish; its signed/gate state is always absent, never inferred from Markdown.
- Pointer schema `steer-candidate-pointer/v1` contains item, bundle ID, manifest
  path/digest and proposal target when relevant. Paths are server-derived from
  validated IDs; reject traversal, symlinks, arbitrary URLs and extra files.
  Resolve same-commit content; obtain the commit ID from provider readback, not
  a self-referential “this commit” field inside that commit. Receipt binds the
  operation/input digest, expected head, pointer and manifest hashes. The 0208
  bound write plan also records a digest of the exact schema-canonical save binding
  (including draft ID/revision and human subject). Its input hash domain is
  `steer-candidate-save-input/v2`. An inert pre-confirmation plan has a null binding
  digest and cannot be submitted directly to the store. No raw private draft or
  conversation is added to the receipt. This strengthens byte binding, not authority.
- **Discovery** enumerates canonical roots and candidate/proposal pointers at the
  same head. A pre-pull pointer selects its bundle Brief/Spec for intake review;
  signed work retains canonical scope and separately exposes pending amendments
  as proposed, not adopted. Follow every current proposal pointer, not old bundle
  directories. Missing/malformed/mismatched pointers are coverage failures, not
  permission to fall back to an empty canonical SPEC and claim no overlap.
- **Reopen** reads the stored commit + manifest hash and all three verified files;
  opening a historical bundle never silently follows the latest pointer. Show
  canonical, candidate or amendment status explicitly. Legacy `intent/` chains
  stay readable; no automatic move or rewrite of supplied/signed artifacts.
- **Promotion** is a different action: publish selected Spec through its current
  framing authority; publish canonical Exam only through the registered independent
  Test Agent path after validating authorship/review evidence against exact
  Brief/Spec/Exam bytes, configuration and Builder independence. A human correction
  requires a new independent review of those bytes. Candidate-writer permission
  cannot promote, edit canonical EXAM, create a gate record or manufacture an
  independent-review record. Gate 2 remains a separate human signature.

Candidate publication records accepted artifacts under the existing authoritative
artifact retention class; warn that Git history is retained. Temporary source and
unaccepted originals stay out of Git. A candidate manifest may retain hashes of
private lineage only under the records owner's approved classification; raw hashes
are not automatically anonymous. A changed gate-selected bundle requires current
review and a new applicable decision, even though older signed snapshots remain.

## 5. Failure and recovery rules

| Failure | Visible response | Safe next action |
| --- | --- | --- |
| Search unavailable/truncated | “Scope review incomplete,” with coverage | Repair or explicitly narrow the permitted scope and review again; no global-newness claim |
| Model unavailable, refusal or invalid output | Specific drafting failure; retain source and previous versions | Resolve cause; a new paid attempt requires remaining authority/budget |
| Architect succeeds, Test Agent fails | Bundle incomplete; not an approved Exam or successful bundle | Preserve the verified Architect checkpoint under approved policy; explicitly retry only a known-failed Test Agent step under the execution-ownership protocol |
| Model call times out / outcome unknown | Uncertain generation, consumed reservation | No automatic refund, fallback or blind retry; recover only from verified operation evidence |
| Budget exhausted | Show cap-related stop, no further model call | Human may approve a new bound; code must not increase/reset the cap |
| Source changes during generation | Draft no longer current | Preserve provenance under approved policy; re-review; already consumed cost is not refunded |
| User edits while an old response arrives | Keep the newer revision | Compare-and-set revision ownership; discard/quarantine stale publication, not newer work |
| Permission or session lost | Clear unauthorized browser content; explain sign-in/access requirement | Reauthorize before server restore; do not expose content in failure logs |
| Git head conflict | Preserve candidate edits; show changed sources | Re-review and reconfirm; do not auto-merge signed artifacts |
| Git result unknown / projection down | Checking original save / recorded but update pending | Receipt readback, then idempotent projection repair under current grants |
| Worker restart or restored backup | Resume only verified operations; mark uncertain effects | Reconcile external receipts and consumed budgets before enabling further effects |

Do not wrap non-idempotent model or Git operations in generic Temporal automatic
retries. Keep the model provider, budget permit, durable operation owner and workflow
adapter separate. Existing budget reservations survive client restarts, but a
restored old database must not replenish spent allowance; disable and reconcile
accounting first. Rebuilding projections must never touch operational records.

## 6. Decisions before dependent implementation

These are explicit recommendations for review, not approvals hidden in a design.

| ID | Decision and recommended resolution | Status / owner / affected boundary |
| --- | --- | --- |
| D1 | Keep Git as canonical business authority; explicitly distinguish durable operational records from rebuildable projections. Apply the exact proposed classes, retention and activation conditions in [the records amendment](DRAFT-RECORDS-AMENDMENT.md). This is a real amendment, not merely clarification of existing memory-only rules. | **Specified, unsigned and inactive.** Architecture owner + qualified records owner; signed ADR-02/03/04, canon, records schedule and recovery exam must be incorporated through their owners before live persistence. |
| D2 | Treat the early three-document bundle as a preliminary candidate. Save is not pull; pull is not Gate 1; an Exam draft is not Gate 2. Reconcile design and independent Exam after the appropriate gate. | **Clarification based on existing canon.** Product Lead/Designer and Tech Lead confirm the UX interpretation. No automatic pull or machine signature. |
| D3 | Use the fixed candidate/proposal/receipt layout and manifest-driven discovery/reopen/promotion contract above. Publish new candidates atomically; extensions never overwrite canonical signed scope. | **Design specified; protection acceptance pending.** Tech Lead/Exam owner and code-host policy owner; I5 catalog/writer/promotion changes need integrated negative tests and current grants. `intent/0001/EXAM.md` remains untouched. |
| D4 | Replace manual scope-check choreography with an agent-run, evidence-bound workflow behind the same tools. Add a pinned semantic-review role/configuration; all its calls consume the same approved accounting policy as drafting. | **Requested UX direction; integration pending.** Platform Engineer owns grants/configuration/evals. No extra framework and no unbudgeted semantic calls. |
| D5 | Keep Gate 1's selected GitHub App, Keycloak adapter, LiteLLM seam, portable containers and content-free analytics. Activate model usage and runtime writes only with their separate scoped authority. | **Existing baseline, not a new purchasing decision.** Model test budget and real runtime writing remain closed; the infrastructure ceiling is not authorization. |

D1 needs a qualified exact-revision ruling before real draft persistence. D3 now
has a concrete implementation contract; tests and disabled adapters can be built
against it, but canonical promotion or live writes remain gated. Source-faithful
documentation and safe read-only integration can proceed. An approved amendment must follow
[the documentation synchronization rule](../DOCUMENTATION-MAP.md#publication-and-synchronization-rule),
update the affected specification/Exam through their owners, and bind any required
new gate decision to an exact revision. This proposal does not rewrite signed files
or claim to amend the root Operating Model Word document.

## 7. Acceptance before calling the journey complete

| Scenario | Observable proof in the actual app |
| --- | --- |
| New intent | One natural-language submission triggers source review; focused clarification leads to source-faithful Brief/Spec and independent NOT RUN Exam |
| Exact/paraphrased duplicate | Existing scope cited; Open existing creates no new item; no lexical-score-only verdict |
| Partial/related/negated/different-product scope | Explanation identifies what is shared and what is distinct; human direction preserved without silent merge |
| Missing facts or source coverage | Unknowns remain visible; failed/empty/truncated search is not authoritative clearance |
| Correction and refresh/restart | Before publication, acknowledged edits/originals restore exactly within the approved retention window; another tenant/user gets no content. After publication, reopen the accepted manifest bytes and label expired private originals unavailable. |
| Changed input/source/configuration | Prior confirmation or review cannot authorize a newer revision; stale responses do not overwrite current text |
| Concurrent save and lost response | Exactly one intended participating creation; fixed receipt resolves uncertainty; no duplicate paid call or second Git save from retry |
| Successful save and reopen | Real authorized repository commit and exact hashes for the whole accepted candidate bundle; truthful projection lag; no forged human signature |
| Protected Exam and gates | Candidate corrections do not modify canonical Exam or mark tests run; save does not pull or sign; affected gate resets on scope revision |
| Access and budget denial | No cross-tenant source/output leak, no provider call without a reservation, no cap reset/refund on uncertainty |
| Human UX | Keyboard and narrow-screen completion, readable document review, focus/error recovery, no data loss on navigation, no mandatory eight-question form |

Synthetic tests establish contract behavior, not live quality. Final evidence must
identify actual app/build, source revisions, human-confirmed destination, provider
commit, model configuration and consumed budget without exposing secrets or private
source. Passing this journey is necessary but not sufficient for the full Phase 1
walking-skeleton exam and ten-real-item pilot.

0224 implements an uninstalled reference-only Temporal development workflow over
the recorded SQL runner. Architect precedes Test Agent; clarification, supersession
or uncertain/busy state stops the attempt. One attempt per role, content-free
heartbeats and cancellation are explicit. Questions/documents remain in encrypted
SQL records, not workflow history. Progress queries are historical metadata and
cannot replace current API authority/source checks. See
[0224 evidence](../../intent/0224/EVIDENCE.md). This does not install live persistence,
authorize model usage, sign gates or complete the actual UI journey above.

0225 supplies shared `intent.draft.create/append/read` contracts and an uninstalled
owner-bound encrypted SQL service. Reference creation explicitly acknowledges no
content; append acknowledges one exact mutation/revision, possibly older than a
separate latestRevision. Readback does not restore review, authorship or gate
authority. Every response says savedToGit:false. The actual HTTP handler allows
document-sized append requests within 256 KiB without changing other tool limits.
See [0225 evidence](../../intent/0225/EVIDENCE.md). Records-policy authority remains
independent of tool grants; the editor and live identity runtime are not activated.

0226 adds actual editor transport/state integration without activating those real
bindings. Preserve/retry/read/replace are explicit; unknown writes keep one exact
request, and stale acknowledgements do not replace newer typing. Preview dismissal
does not clear a conflict. Restored documents/clarification remain exact and inert,
with fresh review required and no invented generation provenance. See
[0226 specification](../../intent/0226/SPEC.md) for the default-off display hints,
response limits and memory-only lifecycle. Recorded-development result retrieval,
multi-turn continuation and owned-draft discovery remain next. D1, current runtime
authority and actual signed-in journey acceptance are not implied by these controls.

0227 provides shared `intent.development.read` and an uninstalled current-authority
SQL reader. The API independently verifies recorded role exchanges through the same
codec as generation, without taking a gateway secret or dispatch capability. Source
and step snapshots must remain coherent before private candidate content is released.
Expiry returns only currently authorized source metadata, never old execution
authority or result history. Supersession identifies the older source without
replacing newer human text. See [0227 specification](../../intent/0227/SPEC.md).
Read status cannot start/retry work, sign gates, save Git or count an Exam as run.
Recorded-development submission and editor progress/results are still unconnected;
the real service remains inactive pending its existing records/runtime authority.

0228 supplies `intent.development.start` for an already admitted, retained operation
and exact expected source revision. The uninstalled data/Temporal composition checks
current records, source and execution authority, and recovers only the same verified
reference-only workflow start. Retention must cover the bounded operation lifetime;
an absent/mismatched record, stale source or unknown start cannot authorize a new
operation, workflow replacement or model retry. A scheduling receipt is not document
readiness; 0227 remains the separate authorized SQL results query. See
[0228 specification](../../intent/0228/SPEC.md). Reviewed-draft assembly/admission
and the actual editor connection remain upstream work, with live activation closed.

0229 supplies `intent.development.prepare` to assemble exact stored draft content,
reviewed direction, evidence and fixed profiles/configuration before 0228 start.
Incomplete declared coverage admits no operation. SQL uniqueness plus immutable
original readback distinguishes prepared, conflicted, unavailable and unknown work;
retry cannot silently renew expiry or replace retained inputs. Prepared is not a
semantic-clearance or execution/save/gate grant. See
[0229 specification](../../intent/0229/SPEC.md). Actual editor integration and the
production full-corpus/evidence/authority binding remain unconnected; synthetic
preparation-to-Temporal tests do not complete the live acceptance journey.

0230 connects that editor path and adds the read-only `intent.development.review`
query. It binds the current encrypted draft, permitted whole source bytes and
mandatory provenance authority to server-owned configuration/snapshot metadata,
without preparing an operation or asserting semantic clearance. The editor uses
this reviewed evidence, not an invented bridge from lexical review fingerprints.
Preserve-and-review is one human action; explicit direction then enters prepare,
start and read. A lost request retains the same recovery identity. Verified terminal
result readback can resolve uncertainty without another start; no query authorizes
dispatch. Questions preserve earlier turns; document adoption is explicit and
requires unchanged source, and edits/undo invalidate stale review. See
[0230 specification](../../intent/0230/SPEC.md). Owned-draft/run discovery,
production source/lifecycle/semantic binding and authorized live activation remain
open. The existing D1, runtime, model and Git authority boundaries are unchanged.

0231 adds explicit `intent.draft.discover`: current owner/configuration metadata
pages, no ciphertext, keys, writes or execution authority. The actual editor uses
find → preview → explicit restore → exact retained-run status read. A completed
run can be recovered with no replacement preparation/start; pending exact recovery
remains a separate explicit command under current authority. The query excludes
held/discarded/published/expired records and does not claim full run history,
orphan-preparation recovery, repository duplicate coverage or content validity.
Content/results still pass their independent authenticated readers. See
[0231 specification](../../intent/0231/SPEC.md). Live D1, source/model and Git
composition remain inactive; this does not complete the human acceptance journey.

0232 adds same-commit repository-wide `intent/`/`items/` enumeration and an
uninstalled evidence-to-recorded-review composition. Current trusted inventory,
product/lifecycle and per-source authority is required before selecting canonical,
pre-pull or proposed scope. Schema-valid evidence is not real authority verification.
Unsupported/missing/restricted/unassessed roots remain incomplete; changed head,
reader binding or authority suppresses output. The current whole-document/read
bounds still require contextual batching for larger corpora. See
[0232 specification](../../intent/0232/SPEC.md). Real verifier binding, semantic
assessment and live records/model/save acceptance remain outstanding.

0233 plans whole-target batches over that declared corpus. All listed Brief/Spec/
amendment sources for a target stay together; missing or oversized context is an
explicit gap. The parent manifest binds global coverage and exact local envelopes.
Combined receipt validation recomputes the plan, verifies configured assessments
and byte-exact citations, and keeps absent/abstained results incomplete. Structural
coverage is not semantic accuracy, independence, provenance or action authority.
The actual review API/editor display verified planning metadata only. Existing
single-envelope generation gates remain unchanged, even when more documents fit
the plan. See [0233 specification](../../intent/0233/SPEC.md). No model dispatch,
records activation or runtime save is introduced; durable semantic execution,
larger-corpus context, real authority and human acceptance remain next work.

0234 adds exact per-batch scope-role preparation and an uninstalled recorded Mastra
adapter/verifier at the existing provider edge. Current edited scope, evidence and
full profile policy bind the private request; inherited Exam/role conversation is
excluded. Actual SDK serialization is verified before request ACK/current dispatch
authority; raw response, citations and usage are verified and acknowledged before
return. Combined structural coverage still asserts no semantic quality or action
authority. No SQL role/budget enum or Temporal behavior changes; the distinct scope
batch/records/reservation composition remains mandatory before activation. See
[0234 specification](../../intent/0234/SPEC.md). Fixture hooks and provider responses
are not real durable ownership, budget approval, source authority or live acceptance.

0235 adds distinct scope run/batch ownership and reservations, without changing the
Architect/Test Agent permit contract. One exact preparation has one immutable run;
each batch has one reservation in the same transaction as its fenced claim. Scope
cost terms are separate, default inactive and bound to the full profile; all roles
consume the same existing cap. A replayed/ambiguous dispatch or read supplies no call
authority. Both current-authority checks run without a leased SQL connection.
Metadata excludes private prompts/findings and cannot record success yet. See
[0235 specification](../../intent/0235/SPEC.md). Next integrate encrypted originals,
observations/results, verified checkpoints and reference-only Temporal execution;
real authority, D1, model approval and signed-in/save acceptance remain outstanding.

0236 supplies immutable encrypted scope originals for that admitted review. Exact
intent/edited Brief/Spec, corpus and profile reconstruct the full manifest; Exam and
prior role history are excluded. Authenticated indexed parts preserve larger bounded
inputs atomically without changing the document envelope primitive. Capture requires
the current durable source revision. Historical read requires current records/source/
key/lifecycle authority but does not renew expired execution or replace later edits.
See [0236 specification](../../intent/0236/SPEC.md). This is input recovery only;
recorded observations, verified successful results, Temporal and live acceptance
remain next. No actual records, grants, model calls or runtime saving are activated.

0237 supplies immutable encrypted request/response observations for an admitted,
dispatch-committed scope batch. The trusted recorded SDK codec verifies the exact
request before acknowledgement and the saved request/raw response/citations/usage
before response acknowledgement or readback. Link the response to the digest returned
by request storage. SQL serializes observation inserts with batch-state transitions;
the narrow guarded trigger does not grant general execution-schema access. Current
records, source, owner, key and lifecycle authority remain required. A quarantined
or failed batch may yield verified evidence requiring outcome resolution, not a retry,
success, semantic-quality or clearance claim. Observation access after review expiry
and successful checkpoints remain unimplemented. See
[0237 specification](../../intent/0237/SPEC.md). No real migration, D1 activation,
model call, runtime Git saving or gate is enabled by these development adapters.

0238 changes development-role exchange verification, not scope-review authority.
The recorded model reads both immutable observation stages through one initial
source/execution context and a final current-context recheck. Match every common
binding; authenticate both stages with their own historical keys; preserve payload
limits, predecessor/result checks, final records/source/model authorization and
lifecycle/row rereads. No cross-call cache or recorded exchange grants dispatch,
retry, gate, semantic quality or checkpoint authority. The pinned SDK still verifies
the exact rendered request, wire response, usage and result after storage readback.
Timeouts and no-retry behavior are unchanged. The test-only focused latency runner
is bounded and explicitly not the full suite. See
[0238 specification](../../intent/0238/SPEC.md). Real records/model/save activation
and signed-in acceptance remain outside this increment.

0239 connects scope response observations to durable batch checkpoints. A strict
reference binds the complete response payload digest, exact execution/preparation,
records policy, product, source binding, owner, fence and reservation. It references
existing ciphertext, not a second result copy. The normal checkpoint path accepts
only dispatch-committed or exact already-succeeded work. Preflight releases its SQL
lease before mandatory current encrypted/SDK readback; a bounded fresh proof must
match the second transaction's current owner and state. Post-commit authority runs
after lease release. Exact replay re-verifies without rewriting success; lost ACKs
never authorize another provider call. Inspection alone remains metadata, not proof.

SQL preserves the original transition guard and adds a narrow scope-checked trigger
for response/original/lifecycle binding. Lifecycle locking uses NOWAIT so a writer
blocks completion without reverse-order waiting or skipped-row success. Readback
still requires current keys/source/records authority. Quarantined/failed evidence
has no checkpoint reference; normal completion cannot promote or reset it. A
completed batch is not combined semantic coverage, quality, disposition, execution,
save or gate authority. See [0239 specification](../../intent/0239/SPEC.md).
The development migration remains outside real-local activation; completed-batch
consumption, reference-only Temporal and actual human/save acceptance remain open.

0240 composes completed scope observations into a read-only combined result. Restore
the original and exact current batch set, verify every contributing succeeded
response through encrypted storage and the pinned SDK, and validate citations and
whole-corpus coverage against the original evidence. Uncheckpointed, unknown and
failed responses do not enter the success set. Reinspect the snapshot and source;
changed steps deny release, newer human edits are superseded and expired reviews
release records-authorized metadata only. Incomplete inventory/access/context or
abstention stays incomplete even when all recorded relations say no match.

All authority/key/codec callbacks retain current identity/query-grant checks. The
reader exposes no mutation, scheduling, key creation, dispatch or retry interface;
close and bounded admission prevent late private output. It grants no semantic
quality, uniqueness, disposition, execution, save or gate authority. See
[0240 specification](../../intent/0240/SPEC.md). Query/API/UI binding, reference-only
scope Temporal, real authority and actual I1–I6 acceptance remain separate work.

0241 exposes `intent.scope.read` through the shared typed registry and normal
authenticated HTTP endpoint. Require an explicit human query grant and exact
current identity plus service owner/organization/product/repository binding, before
and after awaited reads and before response release. Portable strict contracts
cross-check state, source revision, checkpoint/result and pending batch membership,
coverage/source/citation accounting and the combined digest. These checks cannot
grant uniqueness, semantic truth, save authority or provider authorship.

The explicit API factory supplies the current exact scope profile and pinned SDK
codec, never a caller-selected verifier, gateway credential or model transport.
Current records/source/key authority remains mandatory, including void source
authorization ACKs. Missing configuration and revocation are errors, not no-match.
The factory is not installed by flags or this increment. See
[0241 specification](../../intent/0241/SPEC.md); scope preparation/Temporal, actual
editor integration and real I1–I6 acceptance remain pending.

0242 connects one exact scope batch to actual SQL ownership and the pinned recorded
SDK. Restore the retained original/profile/manifest under current authority, claim
the existing shared budget, and require both a fresh acknowledged dispatch and a
newly inserted verified request before transport. Recheck current source revision,
owner/fence/reservation immediately before sending. Record response bytes and
usage, verify the SDK result, then checkpoint its complete payload through the
existing readback protocol. No separate private result storage or retry path.

Reconstruction reads succeeded work without dispatch credentials or another charge.
Sent, unknown and failed work cannot be resent or normally promoted. A newer edit
before dispatch stops the old request; an in-flight result may remain a superseded
historical checkpoint without replacing human corrections. Current identity loss
withholds completion, even when durable success must remain intact. Cancellation
attempts metadata quarantine under current authority; if denied, sent state still
blocks retries. The runner keeps admission while underlying keys, transport, body
reads/cancellation or other dependencies drain and never releases late success.
Receiving response headers does not release the body-cleanup resource slot.
Outcomes contain references only, not findings, private errors or authority. See
[0242 specification](../../intent/0242/SPEC.md). Reference-only scope Temporal and
source preparation/editor integration remain next; this is not live activation or
combined semantic quality/uniqueness acceptance.

0243 starts scope Temporal work with organization/review/preparation references
only. An identity-bound plan activity reads the exact verified retained manifest;
callers cannot submit a shortened batch list. Planning shares the runner's active/
draining slot, performs no mutation/reservation/model call, and releases no batch
references on expiry, supersession or denied authority. The frozen runtime binding
must match the activity's fixed target before any records access.

`reviewIntentScope` schedules one plan read and at most eight sequential batch
activities, stopping at uncertainty, busy, supersession or non-ready planning.
Activities have one attempt, payload-free heartbeats and acknowledged cancellation;
the dedicated worker is never registered by default. Workflow identity excludes
preparation digest, and trusted internal starts reject duplicate reuse. History and
progress contain only references/counts/checkpoints, not source, findings or keys.

Completed batch recovery still uses current SQL/original/SDK verification without
another model call. `attempt-complete` and Temporal COMPLETED mean this attempt has
finished, not semantic coverage, uniqueness, disposition, execution/save permission
or a gate. Use the current-authority combined reader for findings and completeness.
See [0243 specification](../../intent/0243/SPEC.md). Actual source preparation and
authorized start/lost-ACK recovery into the editor remain subsequent work; no real
records/source/model/save binding or I1–I6 acceptance is enabled.

0244 connects the preparation stage through `intent.scope.prepare`. An explicitly
granted current human supplies exact saved-draft and reviewed-corpus references,
not private source bytes, a batch list, profile, budget or a new review ID. The
server restores the current draft, excludes its Exam, verifies current repository
evidence, admits the immutable review, encrypts its original and verifies readback.
An explicit composition connects the actual repository-wide collector; current
product/lifecycle/per-source authority is still mandatory and never caller-supplied.

Rechecks surround admission, preservation and acknowledgement. Exact replay recovers
the same identity and original without renewing expiry or reserving model cost.
Unknown acknowledgements do not grant start or retry permission. Partial evidence
remains visibly partial even when its available batches can be prepared; empty or
entirely unavailable evidence starts no work and never establishes uniqueness.
The final awaited authority check is followed by an expiry check before readiness.
See [0244 specification](../../intent/0244/SPEC.md). Authorized start/recovery and
actual editor binding remain next; no real runtime or authority is activated.

0245 connects `intent.scope.start` to the exact encrypted prepared review and latest
saved draft. A current explicitly granted human and separate execution/records
authority are rechecked before, around and after scheduling. The command cannot
admit source, select batches, change expiry/profile/budget or reserve model work.
Corrections, holds, expiry and authority loss withhold acknowledgement while
preserving any already scheduled operation.

The explicit scheduler fixes namespace and queue, verifies registered namespace
retention of at least 24 hours, and acknowledges only an exact initial start event
for the described run: reference input, workflow type, queue, 30-minute execution
timeout and no retry/cron/parent/continuation. Missing history is not an absent
workflow. Only a missing description permits the existing duplicate-rejecting
starter; concurrent starts and lost responses recover the same retained run.
Deadlines, bounded admission and drainage checks suppress late scheduling.

Receipts carry metadata only. RUNNING or COMPLETED is neither verified semantic
coverage nor permission to retry, draft, save or sign; use `intent.scope.read` for
current authorized findings. See [0245 specification](../../intent/0245/SPEC.md).
Factories remain uninstalled by default. Actual editor scope preparation/start/
read/progress/recovery, real authority and live acceptance remain subsequent work.

0246 binds the actual editor to those scope tools through a reference-only,
same-origin authenticated transport. An explicit assessment prepares/starts one
review; pending progress polls only reads. Unknown preparation/start retains exact
recovery inputs and blocks conflicting source-review/generation controls. Edits,
including edit-then-undo, invalidate the old source binding. Schema field ordering
does not count as a content change. Known result reads remain independent of model
dispatch capability and cannot send replacement work.

The browser verifies owner/source revision and recomputes combined findings against
the exact reviewed corpus bytes/plan before display. Partial, incomplete, unavailable,
superseded and expired states cannot become a newness claim. Findings are inert text
with source status, commit, digest and citation ranges. Supported Brief paths use
the existing reader; proposed paths retain citations without expanding that reader.
Hidden/expired/changed sessions close the controller and clear findings. Polling and
transport/body cleanup are bounded, and no browser storage is introduced.

See [0246 specification](../../intent/0246/SPEC.md). This is synthetic-HTTP-tested
production UI composition, not live records/model activation or semantic quality.
Scope-specific refresh discovery and server-side evidence consumption by direction/
drafting remain open; the legacy generation-envelope gate is not bypassed by a
completed larger scope assessment. Full human save/reopen acceptance remains open.

0247 adds the separate human query `intent.scope.discover`: exact latest saved draft
plus owner/product/repository/records configuration, bounded UUID keyset pages and
current metadata/per-entry permission. The data service selects no encrypted
content, acquires no keys or execution pool, releases leases before authorization
callbacks and repeats lifecycle/source/page checks before release. Discovery errors
are not empty pages. The existing table has no creation timestamp, so order is
explicitly non-chronological. The references may cover different corpus/profile
versions; metadata is not content provenance or authority to execute.

The actual editor restores a draft, reviews sources and can discover/select a
retained review for a read before any start. Read findings must match the current
reviewed corpus; terminal observations cannot offer retries. Pending observations
can offer explicit exact-reference start recovery under separate current authority.
No browser storage, automatic preparation/start, text replacement, inferred
newness, generation clearance or save follows discovery. Scope discovery covers
captured originals of the exact latest draft, not orphan admissions or older
revisions. Historical-corpus display remains separate. See
[0247 specification](../../intent/0247/SPEC.md). Factories remain uninstalled and
server-bound assessment consumption by direction/drafting remains next.

0248 completes that development handoff through the separate uninstalled
`createAssessedRecordedDevelopmentPreparer`. The browser supplies only the exact
review/preparation/result reference with explicit human direction. The server's
pinned current reader must verify recorded observations and full current corpus
coverage/citations before encrypting the complete binding inside the immutable
development original. Both role contexts include this direction and assessment;
the fresh Test Agent never inherits prior Exam or Architect commentary.

The new factory refuses omitted assessment. Optional v1 fields preserve historical
originals/hashes only; the legacy preparer is not a substitute for new live journey
wiring. Pass the pinned reader through original-store ports for preparation, start,
worker requests and result consumption. Missing/revoked/changed/expired/superseded
assessment fails closed. Historical expired-scope display needs a separate current
records-authorized path, not execution renewal. Explicitly complete empty inventory
can bind its exact plan digest with no scope model call; failed search cannot.

The actual editor checks owner, exact draft and current plan before enabling
direction and revalidates findings before preparing. Retry preserves exact inputs.
Larger scope coverage cannot override the legacy smaller generation envelope or
record/request limits. See [0248 specification](../../intent/0248/SPEC.md).
This does not activate records, model budget, execution, saving or gate authority.

0249 adds `steer-development-context/v1` for the explicit assessed drafting path.
It reconstructs whole verified sources across assessment batches without widening
the legacy 32-source assessment envelope. Up to the existing 50 acquired documents
can fit, but each source remains limited to 32,000 UTF-8 bytes and aggregate source
content to 128,000 bytes. Whole-target acquisition gaps and aggregate overflow stay
incomplete; no truncation, auto-summary or partial-context generation is permitted.

The reviewed snapshot digest remains stable and distinct from the new context
digest, which pins full coverage, source metadata/bytes, plan and source fingerprint.
The actual editor supplies `draftingContextDigest`; the assessed factory now requires
and independently recomputes it alongside the recorded assessment. Immutable
originals retain it under direction, and both role contexts reconstruct the full
source set. Existing originals that omit it keep the old rendering and hashes.
Start inputs remain reference-only. See [0249 specification](../../intent/0249/SPEC.md).

No increase to acquisition, record/request/wire, token or model-budget bounds.
Fitting source content alone is not proof that every downstream bound fits. This
does not complete arbitrary-corpus context, semantic quality, real activation or
human acceptance. Beyond-bound evidence requires separate design and verification.

0250 adds an offline quality-evaluation boundary, not an execution stage. The
versioned synthetic corpus rebuilds production scope inputs and verifies supplied
recorded SDK exchanges before scoring candidate relation, coverage and decisive-
citation expectations. Suite/case/profile changes invalidate replay bindings;
missing cases/batches remain failures in the full denominator. No oracle enters
the role request. See [the evaluation contract](../../intent/0250/SPEC.md).

Label agreement cannot prove explanation quality, independent adjudication or
live provider provenance. Reports always keep those acceptance/authority flags
false and require explanation review. No report digest or candidate-check result
is a grant, runtime admission, save confirmation or gate decision. The command has
no provider/gateway/key/records wiring and no live mode. Synthetic SDK replies
prove harness behavior only; signed-in user and repository acceptance remain open.

0251 exposes exact preserved draft revisions through the existing authenticated
`intent.draft.read` query. Numbered navigation sets a distinct read-only history
mode. Even a numbered read of the latest snapshot cannot be accepted into the
editor; a fresh `latest` read and the existing explicit replacement are required.
Previewing/closing history does not change the current text or optimistic save
base and cannot resolve a conflict, bypass an unknown mutation, or restore agent
provenance/approval. See [the history contract](../../intent/0251/SPEC.md).

Every read retains current records/owner/product/key checks. Invalid, denied or
expired responses clear the preview, not current edits; absent versions are never
reconstructed. Close/hide drops private bytes and late replies. This concerns draft
snapshots only, not historical access to expired scope observations or superseded
assessed originals. No new storage, retention, execution or save authority.

0252 connects exact candidate reopening through `intent.candidate.read`, a shared
reference-only HTTP/MCP query. The subject/scope-bound explicit server factory
uses the existing regular Git-blob reader and current read authority. Per-request
identity is revalidated around every provider read and before delivery, without
replacing source authority or granting access. See [0252 contract](../../intent/0252/SPEC.md).

The result retains exact manifest bytes and all three documents. Server/browser
checks bind paths, references, SHA-256 and Git blob hashes; they cannot independently
establish provider provenance or current branch state. The actual signed-in view
accepts canonical metadata links, labels candidate content and does not adopt it
into the current draft. Denial, closure, navigation, hiding and expiry clear the
preview; late responses cannot restore it. No write, gate or retry follows a read.

This is the exact-link reading surface, not final-save consent consumption or a
live successful-save receipt. Save preparation/confirmation/status, receipt-link
integration, current authority and human acceptance remain pending.

0253 adds reference-only `intent.candidate.save.status` to HTTP/OpenAPI/MCP and the
actual signed-in workspace. The explicit API factory recovers encrypted original
documents/confirmation under current owner/records/key/lifecycle authority, then
rebuilds the exact operation plan and uses a read-only native Git inspector. It
restores and compares that original again after provider inspection before
releasing metadata. Identity and fixed scope are also revalidated throughout.
See [0253 contract](../../intent/0253/SPEC.md).

Only a verified original receipt yields a commit-bound reopen reference. Missing,
unknown and conflicting outcomes carry no reference and never authorize retry.
The query cannot admit a new operation, start a workflow, dispatch, checkpoint,
reconcile or clear quarantine. Existing original-store monotone lifecycle denial
is not bypassed. A verified Git save is not completed workflow bookkeeping, Spec/
Exam acceptance, gate approval or execution authority.

The status view offers explicit same-operation recheck and separate-authorized
exact bundle opening. It never replaces the draft, polls automatically or stores
private browser state. Hide/navigation/expiry/denial/closure clear results and
links; late responses cannot restore them. Preparation/confirmation/start still
must supply original recovery references under real authority and human acceptance.

0254 adds human-only `intent.candidate.save.review`: exact final draft/revision and
selected recorded-scope references plus explicit direction in, inert review and
document digests out. The request cannot supply source prose, findings, authorship,
operation/item allocation, profile or authority. The read service recomputes the
preserved Brief/Spec scope, checks all three nonempty documents and current whole
source context, validates selected target/assessment, then rechecks draft/source/
assessment and records/key/lifecycle before release. See [0254 contract](../../intent/0254/SPEC.md).

The actual conversation exposes final review independently from generation.
Source/choice changes immediately invalidate the displayed result; denial,
hide/expiry/closure clears it. Exact editor bytes and selected evidence must match
the server response. No browser storage, replacement, polling or save follows.
The versioned review digest is not durable consent, authorship, a manifest or an
admission reference. Future preparation must reconstruct current review and bind
verified destination/lifecycle/lineage before exact human confirmation and start.

## Retained assessment history is not current clearance — 0255

`intent.scope.history` has its own current human query grant and a distinct
`steer-scope-review-history/v1` output. It restores retained source inventory and
verified succeeded SDK findings under separate historical operation/observation
authority, exact profile, current records, lifecycle and historical-key checks.
The old execution callback is not reused. Expired normal reads remain content-free.

History exposes neither checkpoints nor mutation/dispatch capability; incomplete
and uncertain batch states cannot be promoted. The real editor opens history
explicitly, labels source revisions/expiry, preserves human text and never passes
this output into current disposition/drafting/save admission. See [the guide](../SCOPE-ASSESSMENT-HISTORY.md)
and [0255 specification](../../intent/0255/SPEC.md).

Generation-original history and final-save lineage are separate contracts. Do not
loosen current-only scope selection or original admission to accept this read.

## Historical generation inputs are not output authorship — 0256

`createDevelopmentOriginalStore.readHistorical` requires its own present history
permission and verifies captured scope history against the immutable original's
owner, exact assessment/source references, inventory and findings. Current source,
records, key and draft lifecycle permissions remain mandatory. Expired execution
and later human revisions are historical metadata, never renewed authority.

Ordinary reads, writes, start and worker reconstruction retain current-only scope
validation. The historical read changes no records or reservations and returns no
checkpoint or execution capability. Complete empty inventory and legacy missing
assessments cannot become invented model evidence.

Raw originals contain private source/profile material and remain server-side.
0257 adds per-role SDK output verification; a combined human-facing lineage projection
and immutable save preparation remain separate work. See [the input-history
guide](../GENERATION-INPUT-HISTORY.md) and [0256 specification](../../intent/0256/SPEC.md).

## Retained role exchanges are not a new execution or accepted bundle — 0257

Separate retained-step/result ports cover historical records before or after
execution expiry under present history authority. Existing expired-only ports
remain expired-only. The historical exchange reader requires a succeeded role,
exact encrypted original/result/request/response bindings and the pinned SDK
verifier. Test Agent input is reconstructed from the exact retained succeeded
Architect result, not current human edits or a prior Exam.

Current historical observation/input/result, source, key and lifecycle checks
remain mandatory. Row and result-reference rechecks prevent mixed snapshots;
unresolved roles never become successful history. Raw per-role exchanges remain
private server material with inert provenance references and no checkpoint or
dispatch. A combined bundle view must verify all required roles and their exact
relationship; per-role readback is not independent provider or semantic acceptance.

Response acknowledgement now validates its predecessor request within the same
verified source context without recursive source-graph reconstruction. Both request
key checks, read permission, ciphertext/lifecycle checks and caller final context
revalidation remain. Deadlines are unchanged. See [the guide](../GENERATION-OUTPUT-HISTORY.md)
and [0257 specification](../../intent/0257/SPEC.md).

## Combined historical documents and read-only human comparison — 0258

`intent.development.history` is a separate current-human query, not a current
development result, candidate-save preparation or execution grant. Every completed
role's recorded SDK exchange and exact predecessor result must be verified. One
read-only operation snapshot and final source/latest-revision and role snapshots
prevent mixing states while work completes or a person edits.

Final readback verifies both roles' current records/source/key permissions after
all SDK callbacks. Only exact deterministic SDK verification is memoized within
one read; authorization and content are never cached across calls. Unknown,
failed or missing roles remain explicit and cannot provide a completed pair.

The public projection contains parsed document output and inert digests, never raw
SDK bodies, source/profile packets, keys or continuation checkpoints. The actual
editor can compare original documents with its selected preserved snapshot but
cannot adopt, generate, retry or save through this view. Context/identity/expiry/
visibility changes clear private data and invalidate delayed responses. All-revision
discovery, immutable final save and actual human/provider acceptance remain open.
See [the comparison guide](../GENERATION-HISTORY-COMPARISON.md) and
[0258 specification](../../intent/0258/SPEC.md).
