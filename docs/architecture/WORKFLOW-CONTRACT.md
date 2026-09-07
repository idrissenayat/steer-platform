# Intent workflow contract and design decisions

Companion to [the end-to-end blueprint](END-TO-END.md) · 2026-09-07.
Status: **proposed integration contract**. State/event labels below are design
names, not claims of existing database tables, API tools or deployed workers.
Existing signed policy wins until an explicit amendment is recorded.

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
| Developing → reviewable bundle | Architect and independent Test Agent outputs validate; final scope/auth check passes | Store immutable originals and provenance; Exam is NOT RUN and unsigned |
| Reviewable → edited revision | Human corrects a document | New revision; retain originals; dependent review/Exam status becomes stale as applicable |
| Edited revision → developing | Human explicitly requests a new revision/reconciliation | Show what will be replaced; reserve new approved usage; never overwrite the old revision |
| Reviewable/edited → saving | Human confirms exact bundle/destination; API validates current source and authority | Persist a fixed save operation and expected Git head before issuing the write |
| Saving → recorded | Adapter verifies bundle and receipt at the returned commit | Immutable saved reference; request authorized projection, not another save |
| Saving → outcome unknown | Timeout or lost acknowledgement | Preserve operation ID; read provider status/receipt before any retry |
| Recorded → projected | Worker verifies source and idempotently updates read model | Reopen exact saved bytes; backlog candidate remains not pulled |

Any step can become **blocked** by denied authority, missing configuration,
incomplete source, budget exhaustion or invalid output. Preserve safe recoverable
state and a content-free reason code. After reauthentication, reauthorize before
restoring; another user or tenant must never inherit the previous draft. Session
expiry can clear the browser without deleting a separately retained server draft.

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

## 4. Duplicate prevention and atomic save

1. Search authorized candidates and existing Brief/Spec scope, including relevant
   completed/archived records. Resolve product, user group, exclusions and negation.
   Cite evidence and distinguish coverage from confidence.
2. Offer Open existing, amendment/extension, or distinct linked intent with an
   explicit reason. A proposed extension is not permission to update signed scope;
   it creates a revision proposal subject to affected gates.
3. Recheck the exact source and human direction before model work and before
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
those conflicts. Scoped draft retrieval can warn about other permitted uncommitted
drafts without leaking private text; it is not a canonical duplicate authority.

## 5. Failure and recovery rules

| Failure | Visible response | Safe next action |
| --- | --- | --- |
| Search unavailable/truncated | “Scope review incomplete,” with coverage | Repair or explicitly narrow the permitted scope and review again; no global-newness claim |
| Model unavailable, refusal or invalid output | Specific drafting failure; retain source and previous versions | Resolve cause; a new paid attempt requires remaining authority/budget |
| Architect succeeds, Test Agent fails | Bundle incomplete; not an approved Exam or successful bundle | Retain authorized internal provenance; explicit resumable operation must be designed before reusing paid results |
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
| D1 | Clarify **Git owns canonical business truth; separately governed operational records need durable storage**. Keep Postgres/Drizzle but distinguish projection schemas from draft/operation/accounting schemas. Replay only projections; protect operational recovery and retention separately. The alternative is Git-backed draft revisions, with raw-content/history and access implications—it does not make budget accounting disposable. | **Amendment proposed.** Architecture owner + qualified records owner; signed architecture ADR-02/03/04, canon's “no private state” wording, records policy and recovery exam. Do not introduce persisted raw conversations until classification and authority are resolved. |
| D2 | Treat the early three-document bundle as a preliminary candidate. Save is not pull; pull is not Gate 1; an Exam draft is not Gate 2. Reconcile design and independent Exam after the appropriate gate. | **Clarification based on existing canon.** Product Lead/Designer and Tech Lead confirm the UX interpretation. No automatic pull or machine signature. |
| D3 | Persist an immutable candidate bundle separate from protected canonical Exam publication. Keep canonical BRIEF discovery; store versioned proposed Spec/Exam plus provenance in a designated candidate namespace. Later canonical EXAM publication requires the independent Test Agent path and current controls, never the ordinary Builder writer. Final path/manifest schema must be jointly specified with catalog coverage and atomic-save tests before coding. | **Publication contract proposed.** Tech Lead/Exam owner and code-host policy owner; I5, protection rules and catalog. Do not overwrite `intent/0001/EXAM.md` or evade its protection with a renamed “approved” file. |
| D4 | Replace manual scope-check choreography with an agent-run, evidence-bound workflow behind the same tools. Add a pinned semantic-review role/configuration; all its calls consume the same approved accounting policy as drafting. | **Requested UX direction; integration pending.** Platform Engineer owns grants/configuration/evals. No extra framework and no unbudgeted semantic calls. |
| D5 | Keep Gate 1's selected GitHub App, Keycloak adapter, LiteLLM seam, portable containers and content-free analytics. Activate model usage and runtime writes only with their separate scoped authority. | **Existing baseline, not a new purchasing decision.** Model test budget and real runtime writing remain closed; the infrastructure ceiling is not authorization. |

D1 and D3 need a recorded decision before their dependent persistence/publication
implementation. Meanwhile, source-faithful documentation, contract tests and safe
read-only integration work can proceed. An approved amendment must follow
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
| Correction and refresh/restart | All three edits and untouched originals restored exactly for the authorized owner; another tenant/user gets no content |
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
