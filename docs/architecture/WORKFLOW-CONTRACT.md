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
Rendered role requests and observed provider provenance remain unimplemented;
no profile label proves delivery, independent authorship or pricing bounds.

### Durable execution ownership

0220 adds disabled deterministic private request preparation over retained inputs
and actual succeeded Architect checkpoints. Both source-revision Brief/Spec and
new candidate documents remain explicit; prior Exam and Architect commentary do
not enter Test Agent context automatically. Exact request hashes bind role steps.
Preparation/readback is neither a paid dispatch permit nor observed provider
delivery; actual request capture, provider provenance and durable activities remain
open. The packet contains private bytes and cannot be a Temporal/history payload.

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
