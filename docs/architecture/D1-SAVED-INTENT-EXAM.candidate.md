# D1 saved-intent Exam amendment candidate

Revision 1 · 2026-09-10 · Independent Test Agent authorship

Status: **candidate only; not incorporated, not executed, not a passing result,
and not a gate or runtime activation decision**.

This independently assigned Test Agent authored the acceptance contract without
implementing the system under test. The assignment permits this one candidate
file. It does not permit editing the historical protected Exam, signing a gate,
running a migration or disposition, enabling application writes, deploying,
calling a model/provider, or spending. The existing D1 records/architecture
acceptance is already recorded; it must not be requested again as if missing.

## 1. Exact source and baseline binding

The approved source is revision 1 of
[`DRAFT-RECORDS-AMENDMENT.md`](DRAFT-RECORDS-AMENDMENT.md) at commit
`9442b2d212b2c47c436cbe527dd07707b3c8174c`, SHA-256
`9191831b9870da5cb632d51e8f815aa538e7a191d4ac119f2d8318a264b53ac8`.
Its historical unsigned header is preserved. Subsequent acceptance is recorded
by `D1-LOCAL-2026-09-10` for organization `steer-local-idrissenayat` in
[`operating/local-mac/records-d1-approval.json`](../../operating/local-mac/records-d1-approval.json),
SHA-256 `fd85a2abba52e365c13f1f2aa4b4ac352d14346744db90c8c7fe76b5b7558065`.
It records the user's confirmation as records and architecture owner, not a
cryptographic attestation. `activationPrerequisitesWaived`, `runtimeActivated`,
`schemaMigrationAuthorizedByThisRecord`, `deletionAuthorized`, `gateSigned`,
`applicationGithubWritesAuthorized`, `deploymentAuthorized`, `releaseAuthorized`,
and `additionalSpendingAuthorized` are all false.

The successor [`D1-ADOPTION.md`](D1-ADOPTION.md) has SHA-256
`0f32b855b95062fc133694d2eba7f374694fc98a156341a8f95a26040b32f17e`.
The synchronized schedule [`kit/policy/intent-records.json`](../../kit/policy/intent-records.json)
has SHA-256 `d5d1fbd6688f96173593e9faa7f44863e41c22e56a82d41bdad6c367a58de7a3`.
These are source bindings, not verification of an installed storage binding.

The exact Exam base is [`intent/0001/EXAM.md`](../../intent/0001/EXAM.md) as read
at commit `05f078354dfb04d4f63611085197b3e6743a7f8a`, SHA-256
`84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
Its latest path-changing commit is
`cd913b96a14323ef318749e35a79e1741cf91c70`. The read snapshot identifies the
reviewed bytes; neither commit is an assertion of a current Gate 2 approval.

The Exam preserves the Gate 1 set accepted at
`281c9736816ec22fa1209b060b58fa8164519f7c`:

| Artifact under `intent/0001/` | SHA-256 |
| --- | --- |
| `BRIEF.md` | `a5af593397de0722666baefae846b31881c6429c9691bec886f4a0771a8bc97f` |
| `SPEC.md` | `7330397f7a406b1d88d4f6a2c7205e8671d75c07bfec7840775c2b2614af54ff` |
| `ARCHITECTURE.md`, revision 2 | `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65` |
| `PLAN.md` | `92696a531e61d988a593b31e81a76cb1aae19348c23d665ed301490ac2544b5f` |
| `signatures/gate-1.json` | `63032a9b2ff0f3a41af0b38b887b648e604336156a5bcefbe32de18648556709` |
| `sources/EXAM.supplied.md` | `5823ddb26d0acbc78b7b58d931d76adfe064adeba84b9cf81fad2557d528eb7b` |

The accepted prior policy is
`intent/0001/reviews/domain/round-2/remediation/RETENTION-AND-RECORDS-POLICY.candidate.md`
at `bebbd7537c632d7c2426fdf2271d2f56a800d666`, SHA-256
`f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.
Its `human-rulings/hr-01-r2-policy-approval.json` has SHA-256
`cb55a6dc3f6048d52a7f4c80d66371581bfe3ee073ad65a6b257f7b9c0721ea6`.
D1 changes only its named private-draft/operational boundary. Existing legal,
evidence, evaluation-corpus, gate, disposition, and exact content-free PostHog
`P90D` obligations remain. No source above is edited by this candidate.

## 2. Exhaustive affected-requirements mapping

The following changes apply only to an explicitly adopted organization with a
verified binding. Outside that scope the accepted memory-only rule remains.
`Replace portion` supersedes only the quoted subject; `augment` requires both
the existing condition and the new cases. References to round-two sections and
R-numbered corrections mean their incorporated text in the bound Exam.

| Existing requirement and exact affected subject | Operation | Candidate replacement or extension |
| --- | --- | --- |
| A4.2 `OR-20`, before-save session-only storage, authoritative-save-only survivors, and abandonment erasure within 60 seconds; prior policy `Originator session boundary` | Replace portion for D1 classes only | D1-01 and D1-03: retained acknowledged drafts, current-access reopen, fixed D1 clocks, and separate disposition authority. Sign-out/session expiry revokes browser access without becoming a draft-discard trigger. |
| A4.1 `OR-02`, “destroy all Postgres schemas”; A5 `WS-13`, “Destroy every state named in OR-02” | Replace destruction target and recovery source for D1 operational state only | D1-06: destroy/replay derived projections; preserve and independently recover governed operational records. Git/code-host alone still determines canonical business state. |
| A4.1 `OR-03`, every mirror destroyable/reconstructable; Architecture ADR-02/03/04 assumption that private state is only projection | Replace classification scope only | D1-06: distinguish canonical business authority, disposable projections, and separately governed non-rebuildable operational records under the accepted architecture successor. No database approval authority. |
| A8 lifecycle-policy binding; round-two section 9 “only lifecycle state machine”; R3 16-class policy table; prior policy `Exhaustive record-class schedule` and `Deterministic boundary matrix` | Extend policy binding and class/trigger coverage | D1-03 and D1-07 add exactly `RC-INTENT-DRAFT`, `RC-INTENT-OPERATION`, `RC-MODEL-USAGE`; retain the original 16 rows and apply the composed 19-class schedule only in the adopted scope. Separate authority/receipt rules remain applicable. |
| A6.1 session currentness; A7.1 permissions as corrected by round-two section 3 and R3–R5; A14 authorization/isolation matrices | Augment at D1 surfaces | D1-02: current owner, tenant, product and purpose checks at read/write/reopen and scoped job boundaries; no admin-derived content access. |
| A8 surface inventory and canaries; round-two section 9 disposition; R6–R9 exact copy/key, receipt, replay and trust-domain controls | Augment | D1-04 and D1-05: per-draft external key boundary, every derivative/copy and backup path, restricted holds, and independently verified disposition without implied deletion authority. |
| A11.2 reservation controls; A11.3 logical-operation/idempotency and replacement/replay bounds; A11.4 reconciliation/restart, as corrected by round-two sections 6–7 | Augment; no spend or retry limit enlarged | D1-07: reset-proof operation/reservation lineage, honest unknown outcomes, separate exact retention clocks, and reconciliation before enabling post-restore model calls. |
| A12 Postgres-loss and Temporal-loss rows; complete-regional-loss recovery insofar as it includes D1 operational state | Replace projection-only treatment of D1 state; augment recovery evidence | D1-06 and D1-07: independent encrypted operational recovery and measured D1 loss limits. Existing projection RPO/RTO and canonical/evidence obligations continue; do not assign their numeric thresholds to private drafts by inference. The round-two provider-native decision-loss replacement remains unchanged. |
| A3 reproducibility/evidence and A15 technical-release evidence | Augment only with this D1 slice | Section 3 binds every D1 result to sources, implementation and exact organization/storage/schema/runtime configuration. Passing this slice proves no wider workflow or release verdict. |

All unlisted requirements and gate predicates remain. No generic “stricter” rule
chooses a new retention duration or authorizes disposition. This candidate does
not begin another broad review loop. Event-schema incorporation, protected Exam
incorporation and applicable exact-revision gate rulings remain later steps.

## 3. Evidence and verdict contract

All cases below are **specified, not run**. A later independent run uses the
bound Exam's A3 canonicalization, clocks, repetitions, evidence outputs and
typed side-effect ledger. Synthetic content, keys, actors, grants and external
effect fixtures must be plainly classified; they cannot establish real authority
or be reported as live storage, deletion, model or publication evidence.

Before a result can support activation, retain a content-minimized manifest
binding: this candidate's exact path/digest; the eventual incorporated Exam
commit/digest; implementation commit; all section 1 source digests; adopted
organization; actual tenant/product selectors; storage instance and schemas;
migration/version digest; runtime/adapters/configuration digests; authentication,
RLS and job-principal policies; external key-provider binding; lifecycle table
and event-schema digests; copy/backup inventory; restore runbook; and the
applicable authorization records. References and fingerprints identify bindings;
secrets and private draft bytes must not enter the evidence manifest.

Each case result names the precise fixture/input/expected-output digests, actual
observations, UTC/monotonic times, tested failure cut, side effects and outcome.
Record acknowledgement/revision readback, authorization-before-key traces,
database-role/RLS checks, permitted canary locations and crawls, independent
restored state, key accessibility, reservation/effect lineage, and measured
recovery point/time as applicable. Missing, stale, mismatched or inconclusive
evidence prevents a pass. A caller-supplied `approved`, `encrypted`, `recovered`,
`deleted` or `reconciled` boolean is not evidence of the named property.

`D1-slice-pass` requires all cases at one exact binding with complete evidence.
It is distinct from independent authorship, canonical incorporation, gate
approval, storage activation, I4/I5 acceptance, and the real-model user journey.
Each of those claims requires its own observed result and applicable authority.

## 4. D1 acceptance cases

### D1-01 — Acknowledged draft preservation and reopen

For one currently authorized owner, persist a synthetic original intent,
clarification history, generated original, correction and private review result
under one draft. Capture the server's acknowledged revision and content digest.
Exercise ordinary navigation/refresh, a new browser session after sign-out or
authentication expiry, application restart and worker restart. Before D1 expiry,
fresh authentication and current grants restore the same acknowledged revision
and its source/correction relationships without regenerating it or publishing it.

Fail on lost/changed acknowledged content, restoration from another draft or
owner, a silent new paid run, automatic Git publication, or a renewed creation
clock. Drop the response after durable acknowledgement and retry the same
request: recover its original revision, without duplicate revisions/effects.
Unacknowledged keystrokes remain visibly pending and may be absent after a
crash; they must not be represented as saved. A destroyed storage/key system has
no implied zero-loss promise; D1-06 records its actual limits.

For a separately authorized synthetic candidate-publication fixture, retain only
the exact human-confirmed bytes as the canonical artifact and apply D1-03 to
private originals. Show indefinite canonical history before confirmation.
After private expiry, reopen the exact canonical artifact if still authorized,
but label originals unavailable/expired; never reconstruct invented originals.
No publication request is performed during this authoring assignment.

### D1-02 — Current owner, tenant, product and purpose denials

At each supported UI/API/MCP read, write, discovery, history/reopen, indirect
reference and job boundary, run the following against indistinguishable
synthetic drafts. Apply the existing A14 existence/timing and direct/pooled RLS
checks, including connection reuse; schema names alone do not pass isolation.

| Probe | Required result |
| --- | --- |
| Same owner, current tenant/product grants, approved purpose, unexpired draft | Exact authorized revision; only the matching draft's key and data may be accessed. |
| Same owner after tenant or product grant revocation/transfer, disabled identity, stale or expired session | Denial using current state before content/key access or protected effect; an old acknowledgement is not a grant. |
| Different user in the same tenant/product; another tenant; another product | No draft text, history, search result, existence leak, export, mutation or key access. |
| Administrator with no independent owner/purpose entitlement | Denial of draft content; the admin hat supplies no exception. |
| Worker for the exact draft/operation with current scoped read/write grants | Only its specified operation and draft revision are accessible. |
| Worker with substituted draft, operation, tenant, product, purpose or stale/revoked grant | Deny before draft/key access, workflow dispatch or model effect. |
| Grant revoked or expiry/hold applied after queueing or initial lookup | Recheck before protected access/use; no restored session, queued job or cached authorization bypass. |

Evidence includes the current decision inputs and observed denial order, not
only HTTP status. Authorization failures cause no prohibited effect or charge.
Operation status and accounting views retain their separately scoped roles;
status access does not grant prompt/output access.

### D1-03 — Immutable draft expiry, holds and disposition boundary

Use server-recorded creation time `C`, verified candidate-publication time `P`
when present, and server-recorded explicit-discard time `D` when present:
`draftExpiry = min(C + P7D, P + PT60S, D + PT60S)` over present triggers.
`P7D` is seven UTC days (604,800 seconds); `PT60S` is 60 seconds. A caller's
clock, save click, queued request, lost/unknown publication response, session
expiry, sign-out, edit, retry or sign-in cannot fabricate or renew a trigger.
Verified publication readback may recover the original server/provider time;
its later observation does not start a new 60-second window.

For each trigger, test one second before, exactly at and one second after the
derived boundary; also publication/discard at +59/+60/+61 seconds. Exercise
multiple triggers in different orders, a seven-day deadline earlier than a
publication/discard deadline, repeated edits/sign-ins, retry, restored old
snapshot, missing/forged trigger, same-time events and a read racing expiry.
Only the original derived minimum passes. At expiry ordinary owner, admin and
model use is denied immediately; a racing read may not return bytes after
revocation. Browser persistence remains prohibited throughout.

With a qualified selector-exact hold, preserve through its restricted policy,
without moving expiry or permitting ordinary user/model use. Test active,
released, overlapping, wrong-object and wrong-tenant holds; ambiguous selection
blocks action under the existing policy. Releasing a hold after expiry does not
make the draft usable again. Without separate current disposition authority or
complete verification, keep the record inaccessible and report pending;
neither a timer nor this D1 approval authorizes erase/delete or a success claim.
An operation's unknown external outcome does not extend private-draft use or
its deadline; content-minimized reconciliation records follow D1-07 instead.

### D1-04 — Per-draft encryption and complete copy inventory

Application-boundary encryption uses a distinct envelope-key identity for each
draft through the existing external secret/KMS seam. Inspect two synthetic
drafts, updates and checkpoints. Database/backup access alone cannot recover
plaintext or usable envelope keys; a key for draft A cannot decrypt draft B.
Test substituted/revoked/unavailable key bindings and failure during encrypt,
persist and acknowledgement. Missing key or incomplete persistence cannot
produce a successful saved acknowledgement or plaintext fallback.

Classify payload-bearing clarification/history, generated originals,
checkpoints, private reviews/excerpts/results and embeddings as
`RC-INTENT-DRAFT`, regardless of table or file name. Metadata-only checkpoints
must satisfy D1-07's allowlist before qualifying as operational records.
Inventory Postgres primary/WAL/archive/replica/snapshot/backup/PITR and recovery
logs, every derivative and every A8 surface applicable to the binding. Seed
canaries and probe restored copies as well as primary rows. Mark absent surfaces
with verifiable exclusion evidence. No draft keys in Git, logs, Temporal history
or database backups; no private source/output in browser persistence, telemetry,
ordinary caches or provider-retained prompts under this amendment.

Fail on an unaccounted copy/key/derivative, a recoverable prohibited plaintext
or key, mixed classification hiding source text, provider retention assumed
authorized by D1, or an exclusion without evidence. Content-free identifiers
and hashes are still access/retention-governed, not presumed anonymous.

### D1-05 — Expired-key, backup and all-copy handling

Restore synthetic copies from each inventoried recovery path at cuts before and
after expiry, hold application/release, access revocation and separately
authorized disposition. Include an old key-reference/permission snapshot.
Current expiry, hold and external key state must govern restored copies.
Demonstrate the approved condition that expired draft keys cannot be restored
from any recovery path; restoring a key behind an ordinary-access denial flag
does not establish that condition. Separately, restricted preservation must
remain effective for holds and pending disposition, without permitting ordinary
use or authorizing destruction. Test both obligations together.

For the separately authorized disposition fixture, apply the existing section 9
and R6–R9 exact target/copy/key authorization, independent provider trust,
receipt/aggregate/tombstone bijection and idempotent reconciliation controls.
Primary-row removal alone never proves deletion. A partial/unknown provider
effect, missing receipt, omitted backup/key copy, restored reappearance,
key/resource substitution or same-key/different-request retry blocks completion.
An exact completed retry returns the verified result with no second effect.

Without disposition authority the expected result is inaccessible/pending, with
no destructive request. Do not destroy held/pending material or silently disable
backups to satisfy key tests. A binding must demonstrate the simultaneous
expired-key, restricted-preservation and accounting-recovery requirements. If
it cannot, persistent drafts remain disabled; an unresolved technical or policy
conflict must be stated, not hidden by a deletion claim or access flag.

### D1-06 — Operational records survive projection reset and recover separately

Freeze a synthetic canonical Git/code-host chain, projections and governed
draft/operation/accounting records. Inventory their exact separate roles and
reset targets. Rebuild every disposable board/inbox/search/cache/workflow
projection from its allowed source while preserving the governed schemas.
Canonical business projections remain byte/semantic-equal under OR-02/WS-13;
draft revisions, fixed clocks, keys, claims and consumed reservations remain
unchanged except independently required lifecycle transitions. An attempted
projection reset targeting governed records must be denied. A database field
cannot approve, pull, release, publish or repair a canonical decision.

Rehearse application/worker/Temporal loss and a stale Postgres backup with
independent operational recovery. Repairing canonical workflow projections from
Git cannot recreate or delete a draft, operation, reservation or unknown effect.
Reconcile those records and current key/lifecycle state before model admission.
If no sound recovery source exists, show unavailable/blocked and preserve the
incident; never fabricate missing originals, operations or available budget.

Record the actual acknowledged revision recovered, data loss window, numeric
recovery point/time, failure cut and residual loss limits for the selected D1
binding. Ordinary refresh/restart must meet D1-01. For storage/key destruction,
D1 specifies measured limits rather than new numeric RPO/RTO thresholds; do not
claim zero loss or reuse a projection threshold as a private-draft promise.
The existing canonical business/evidence/decision recovery thresholds remain.

### D1-07 — Reset-proof operation and accounting recovery

Store only allowlisted operation/step IDs, hashes, ownership/fencing,
configuration references, status, reservation/result/receipt references and
incident codes as `RC-INTENT-OPERATION`. Store approval/configuration bindings,
append-only consumed reservations and reconciliation references as
`RC-MODEL-USAGE`. Reject injected source/prompt/output/excerpt text; test nested
metadata, errors and referenced payloads as well as top-level fields. Apply
current status/audit/accounting access roles independently of projections.

| Failure or retention case | Required result |
| --- | --- |
| Concurrent claims; crash before/after claim or reservation; lost acknowledgement | One durable logical operation and reservation lineage; one fenced owner. Retry recovers identical request/result binding; stale owner and same-ID/different-request lose without prohibited effect. |
| Cut immediately before dispatch, after dispatch, after external acknowledgement but before local result, and after local result before UI acknowledgement | Recorded dispatch/effect identity survives. A known result is recovered, never regenerated. Unknown dispatch/outcome remains retained and blocked for reconciliation; no invented failure, replacement operation or duplicate paid request. This case does not enlarge A11's retry/replacement spending allowance. |
| Projection replay/reset, worker replacement, Temporal recreation, stale DB/backup restoration | Consumed reservations stay consumed; unknown effects stay unresolved; no refund/reset through old authorization or ledger state. Reconcile independent operation/reservation/provider observations before enabling model calls. Missing evidence blocks calls. |
| Verified terminal operation time `T` | Operation expiry is `T + P1Y`; test before/at/after and leap-day year addition. A local timeout or absent response is not verified terminality. No terminal trigger while any external effect remains unresolved. |
| Budget expiry/revocation time `B` and verified resolution of all associated external outcomes `R` | Usage expiry is `max(B, R) + P1Y`. Bind `B` to the verified applicable budget-expiry/revocation event, not a caller-selected date. Missing budget-ending or complete-resolution evidence yields no expiry trigger. Unresolved outcomes stay retained. |
| Operation/usage expiry and old request replay after its disposition or restore | Expiry or missing old rows cannot make an old paid action admissible again or reset a consumed approval. Use verified durable reconciliation/lineage under the approved classes, otherwise deny. Do not invent an extra indefinite record class. |
| Wrong tenant/product, superseded/revoked budget, exhausted reservation tree, or caller reset/restart request | Existing cost authorization and checked nanoUSD controls deny before credentials or charge; a draft's records acceptance is not spend authority. |

`P1Y` uses the prior policy's UTC calendar-year addition and February 29 clamp.
Test changed trigger timestamps, stale restore, same-time transitions, missing
outcomes and repeated reconciliation. A11's existing arithmetic, scope limits,
idempotency, paid-replay prohibition and authorization/restart conditions remain.
The separately approved local $5 total model cap described in D1 adoption is not
renewed by a session, run, recovery, this candidate or its future test results.

## 5. Remaining prerequisites and authoring review

The D1 approval supplies the schedule and records/architecture decision. No
additional duration or ordinary-access ambiguity was found that must be
invented or resolved by re-requesting that decision. The binding must still
materialize exact D1 creation/publication/discard/terminal/budget-resolution
events and selectors in the composed lifecycle schema. An old closed 16-class
oracle or an arbitrary database timestamp cannot supply that evidence.

Activation remains blocked until the independent Exam owner incorporates the
affected requirements through the protected authorship process, applicable
gate rulings bind the new exact revision, and complete D1 evidence verifies the
actual adopted organization/storage/schema/runtime binding and measured recovery
limits. This candidate is not a canonical Exam commit and cannot be named as
one. Preserve historical signed revisions throughout incorporation.

External key/backup behavior is not established by the approved prose or this
review. If the selected binding cannot both prevent expired-key restoration and
preserve held/pending material with accounting recovery, record the exact
conflict and keep persistence disabled. Do not resolve it by changing a clock,
erasing without authority, re-enabling ordinary use or weakening backups.
Any actual policy departure needs its specific governed decision; a missing
implementation proof calls for proof, not another acceptance of unchanged D1.

This authoring review checked the approved commit bytes against the supplied
SHA-256, compared the detached decision's limits, read the bound Exam's effective
retention/recovery amendments and historical baseline, and checked the mapping
above against them. It establishes provenance and a focused definition of done.
It does not establish a passing implementation test, live provider/key lifecycle,
gate approval, canonical incorporation, runtime activation or workflow completion.
No real migration, deletion, application/provider call, deployment or spending
is authorized or performed by this file.
