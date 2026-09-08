# Tenant projections and operational storage

## Private development requests (uninstalled)

`@steer/data/development-requests` renders explicit Architect/Test Agent contexts
from preserved original input. The Test Agent receives original source-revision
Brief/Spec separately from its actual Architect predecessor's candidate documents;
old Exam and Architect commentary fields are excluded. Exact instructions, context,
role profile and predecessor bind a domain-separated step-input digest.

`createDevelopmentRequestReader` takes the records scope, execution/draft pools,
required original/result dependencies and current role-request authority. Its only
methods are `read({operationId,inputDigest,role})` and `close`. It requires current
draft revision and actual succeeded Architect checkpoint, rejects mismatched/sent/
failed/quarantined own steps and rechecks state after source restoration. It never
claims, dispatches, reserves, renews, saves or signs anything.

The returned packet contains private text, not a workflow/status payload. Send
references through Temporal and load inside the worker. This is deterministic
preparation, not observed or persisted provider-request capture; current source/
budget authority, profile binding, acknowledged dispatch and actual provider
provenance remain required before model execution.

## Original development context (uninstalled)

`@steer/data/development-original-contracts` validates exact source/configuration,
inspected evidence/direction and separate role instruction profiles; its digest
is used when admitting the operation. `@steer/data/development-originals` captures
that envelope against actual operation and encrypted source revision readback.
One immutable encrypted row per operation is protected by owner/product RLS and
insert-only runtime grants (0017/0018, disposable only).

Construct with scoped records config, `drafts`/`execution` pools and required current
record/evidence/profile/direction, operation, draft and key authority. `put` takes
`{operationId,inputDigest,original}`; `read` takes only `{operationId,inputDigest}`.
Original instructions, evidence and execution configuration restore privately;
later draft revisions remain distinct. Lost acknowledgements stay unknown until
authorized readback. Restoring an expired config never grants execution or retry.
The historical-result reader can consume it under its own current authority.

This is neither a UI store nor provider provenance. Current evidence permissions
must be rechecked by `authorizeOriginal`; hashes alone cannot authorize source
disclosure. Rendered role requests, durable activities, verified model bounds,
all-copy/key recovery and real D1 adoption remain open. No model calls, secrets,
deployment, deletion or real migration is performed by these adapters.

## Captured development results (uninstalled)

`@steer/data/development-results` composes `intent-operations` inspection,
`draft-revisions` restoration and encrypted immutable role-result rows (0015/0016).
Construct with separate `execution` (`steer_app`) and `drafts`
(`steer_draft_runtime`) pools and required operation, draft, capture/read authority
and per-draft historical-key services. No real bootstrap installs this adapter.

- `put({ operationId, inputDigest, stepId, owner, fencingToken, result })` accepts
  only trusted worker capture. `result` is strict `{ role, output }`, with either
  Architect message/questions/nullable Brief/Spec, or Test Agent Exam. Unicode and
  whitespace remain exact. The actual step must be dispatch-committed (or an exact
  already-stored succeeded result). First capture mints the result UUID; identical
  concurrent/retried capture converges, changed reuse conflicts, lost ACK is unknown.
- `read({ operationId, inputDigest, stepId })` restores under current operation,
  draft lifecycle/source integrity, result authority and historical-key checks.
  Original/latest draft revisions are separate; the result never edits the draft
  or revives gate/execution/retry authority.
- `verifyCheckpoint(reference)` supplies the operation store's actual encrypted
  result readback port. It compares the entire input/configuration/policy/result
  binding; unknown/known-failed/undispatched states cannot satisfy it. Construct a
  separately scoped instance for each active worker/readback lane; an instance is
  single-flight and retains admission while timed-out dependencies drain.
- `readHistorical({ operationId, inputDigest, stepId })` is disabled unless the
  separate `authorizeHistoricalResult` current-authority port is provided. It
  requires actual operation expiry, uses the original config only as an integrity
  binding, and still checks current draft/source/key/records access. It omits the
  checkpoint reference and returns historical=true, never execution/retry authority.
  Normal reads/writes/checkpoints never fall back to this route. The underlying
  `createExpiredDevelopmentStepReader` exposes only read/close, uses READ ONLY SQL
  and cannot claim, dispatch, checkpoint, extend expiry or renew a budget.
- `close()` prevents new admission and suppresses late results. No deletion,
  refund, step transition, provider dispatch or automatic retry is available.

Ciphertext authenticates source revision/scope, operation/role, input, configuration,
owner/fence/reservation, predecessor and output digests. SQL grants only SELECT/
INSERT with forced owner/org/product RLS; source and step foreign keys plus a
lifecycle/metadata trigger constrain insertion. One row per role/operation limits
this table to at most two results per admitted development operation. Each plaintext
envelope is capped at 768 KiB. There is no purge or permission to discard history.

All external key/authority calls run outside transactions. Active result access
requires the original operation configuration to remain valid (maximum 24 hours).
Historical reading after that deadline needs the separate current authority above;
neither path extends draft retention or guarantees key/record availability.
Capturing bytes against a dispatch-committed record is not proof of provider
delivery, model authorship, fresh context or semantic/Exam adequacy. Original
prompt/evidence envelopes, provider provenance, durable activities, actual current
history/records authority and UI integration remain separate work.

## Shared storage boundaries

Git-derived tables in `schema.ts` are rebuildable projections, not authoritative
business state. Authentication, usage and execution tables have separate operational
lifecycles; usage/execution records must never be discarded as a projection cache.
`withTenant` acquires one connection, checks its runtime role,
sets tenant context transaction-locally, and commits or rolls back before pool
release. Callers must already have passed the shared tool authorization boundary.

No untrusted SQL is supported: a database principal that can execute arbitrary
SQL can change custom PostgreSQL settings. RLS protects normal parameterized
application queries and prevents accidental tenant omissions; it is not a
sandbox for hostile callbacks or stolen database credentials.

## Verification

- `pnpm --filter @steer/data test`: unit checks; no Docker needed.
- `pnpm test:data:integration`: starts a uniquely named, labeled, loopback-only
  PostgreSQL 16 container with tmpfs data and generated disposable credentials,
  applies Drizzle migrations, tests real isolation/privileges, and stops/removes
  only that container. No existing database, Docker volume or host data is used.
  Missing Docker or failed checks cause a nonzero exit, never a skipped pass.
- The same integration command also verifies candidate saving with native Git and
  an owned in-memory Temporal server. It downloads the existing pinned official
  Temporal test archive and verifies its SHA-256 before execution; network failure
  fails the test rather than skipping it. No real Temporal cluster is selected.
- `pnpm --filter @steer/data db:generate`: reviews schema changes into migration
  files. The custom FORCE RLS/grant migration is not represented by Drizzle's
  table snapshot; preserve and extend its controls on future tables.

Roles `steer_app` and `steer_projector` must be separately provisioned without
superuser, bypass, role-management or table-ownership privileges before
migrations. The harness provisions them only inside its own test database.
No production migration or credential-loading command is provided here.

## Ephemeral authentication storage

`@steer/data/browser-session` implements the shared server session contract with
AES-256-GCM, an explicit secret-provider keyring, five-minute maximum TTL,
bounded capacity and atomic one-use login consumption. Separate `steer_auth`
tables use forced RLS scoped to the trusted identity binding, not a pre-auth
user-supplied organization. Provision `steer_auth_runtime` separately with
NOINHERIT and no elevated/ownership privileges before migrations 0002/0003.
The harness alone provisions that role in its disposable database.

No browser route, production connection or encryption key is configured here.
Expired-row reclamation affects only short-lived auth rows, not Git records.
Cold expired rows remain until a later insert or an approved operational purge;
expiry immediately denies authentication regardless. See `intent/0015/SPEC.md`
for boundaries, capacity/keyring configuration and remaining operational work.

From the workspace root, `pnpm test:auth:integration` combines this production
store with the real disposable Keycloak human-code/HTTP flow. See `intent/0018`
for exactly-once callback, ciphertext, app/store reconstruction and logout
evidence. It never selects an existing database or real encryption key.

Later increments must connect the authoritative Git ingestion, reconciliation,
grant-freshness checks, rebuild/replay, operational queues and API tools. This
package alone does not establish any of those workflows or gate authority.

## Model budget reservations (uninstalled runtime binding)

`@steer/data/model-budget` provides a `DevelopmentPermit`-compatible adapter.
Migrations 0005/0006 add a separate `steer_usage` namespace with forced RLS and
append-only integer-micro-USD reservations. Unlike Git-derived projections, these
records are accounting controls and must not be discarded or rebuilt as a cache.
The runtime can read configured budgets and append reservations, but cannot
provision/activate/raise/reset budgets, refund reservations or delete/truncate them.
An explicit operator-provisioned row must match owner, configuration revision,
approval digest, cap and per-role worst-case reservation amounts. An approval digest
is a binding identifier, not an approval verifier; independent approval/provisioning
is still required. No real budget or model access is created by the migrations.

All adapter instances serialize each budget with a transaction advisory lock and
explicit READ COMMITTED isolation. A fresh atomic insert checks validity, activity,
matching limits and total reserved amounts. Each role's conservative upper bound
is consumed before a model call; failures and unknown commit acknowledgements never
refund or authorize retry. Unknown acknowledgement returns false even when a real
commit happened. Each budget also has a technical ceiling of 10,000 reservations.
No request/response content, credentials or model-generated approval is stored.

Provisioning must follow separate spending authorization and verified conservative
input/output/pricing bounds. This adapter is not yet installed in local API startup.
It is not provider billing reconciliation, duplicate-request idempotency or backup
acceptance. Restarting clients preserves the database counter; restoring a stale
backup or using independent database copies can regress accounting, so model access
must remain disabled during recovery until all reservations/provider usage are
reconciled. There is no automatic retention/deletion or replenishment job.

RLS protects trusted parameterized operations and reused connections, not arbitrary
SQL issued with stolen runtime credentials. The adapter is the serialized admission
path; no alternative code may append an unaccounted reservation or bypass it.

## Intent operation ownership (uninstalled runtime binding)

`@steer/data/intent-operations` adds server-minted operation IDs, immutable submission
bindings and one-way fenced role steps. Migrations 0007/0008 add `steer_execution`
with forced organization/subject RLS and link model reservations to unique
`(organization, operation, step)` keys. Apply these only in disposable harnesses
until the exact records/schema adoption and recovery requirements are satisfied.
The real local workspace's `migrate` command now refuses the expanded migration
set before private-state reads or database changes; `start` does not migrate.

The factory requires trusted `authorize` and `verifyCheckpoint` ports. Configuration
binds identity, product/repository/branch, action, revision, records-policy digest,
expiry and (for development) budget. Neither a digest nor this callback signature
supplies actual policy adoption, current source/lifecycle evidence or spending
authority. No production bootstrap installs the adapter.

- `create`: identical draft/revision/action/configuration submissions converge on
  one operation. Changed input/configuration conflicts; expired IDs never recreate.
- `inspect`: reads original operation/step metadata under current authorization;
  it never returns dispatch permission.
- `claim`: atomically claims Architect, Test Agent or candidate-save. Paid steps
  reserve their worst-case cost once using the same lock/cap as legacy permits.
  Pre-dispatch takeover reuses that reservation and increments the fencing token.
- `transition`: only the first unambiguously acknowledged `commit-dispatch` yields
  `dispatchAllowed: true`. Repeated calls, sent-state status and lost COMMIT
  acknowledgements never do. Checkpoints require exact persisted-result readback;
  Test Agent requires the verified Architect checkpoint and predecessor digest.
- `close`: stops admission/withholds late results; it does not undo external work.

Transactions use READ COMMITTED, restricted `steer_app`, connection-context
scrubbing and 5-second statement/1-second lock/5-second idle-transaction limits.
Authorization, pool acquisition and read-only checkpoint verification have 3-second
bounds; at most eight calls are admitted, with slots retained while timed-out
dependencies drain. SQL is never held across a model/provider call. Configuration
expires within 24 hours; claims last at most five minutes. Each organization/subject
has a technical limit of 10,000 operations, with no automatic purge or replenishment.

Checkpoint readback is outside SQL and outside the execution pool lease (0216).
A read-only preflight resolves the exact required reference, then rolls back,
clears scope and releases its connection. After authorization, the trusted result
reader may use the same single-connection pool. A second transaction rereads the
current operation/step/predecessor and consumes only the matching, call-local
proof. Freshness starts before readback and must remain below five seconds at
consumption, COMMIT and acknowledgement. Owner/fence/state/budget checks still run;
concurrent quarantine, revoked authority, failed rollback or expired proof denies.
Only this effect-free preflight is repeated, never a committed mutation or external
effect. This boundary does not itself supply encrypted result storage or provenance.

Only hashes, identifiers, status and result references are stored—not draft/model
bytes. Result encryption/storage and authorized retention are separate requirements.
The caller must dispatch only once on a fresh positive acknowledgement and recheck
action-time authority; these internal protocol results are not public tool grants.
Unknown outcomes remain blocked. Explicit linked new attempts, verified unknown
resolution, Scout/semantic/embedding roles, Temporal activity integration and the
actual GitHub dispatch-authority composition are not implemented by this adapter.
Stale-backup/copy recovery must withhold dispatch until accounting and external
effects are reconciled. This is at-most-one authorized dispatch under the protocol,
not exactly-once external execution or a hostile-SQL security boundary.

See [0209 evidence](../../intent/0209/EVIDENCE.md) for real disposable PostgreSQL,
independent-process contention, failure injection and the synthetic authority/result
ports used in testing. No live database, budget, provider or user content is involved.

Increment [0210](../../intent/0210/EVIDENCE.md) composes these operation claims with
the existing candidate-bundle writer in an uninstalled worker-side factory.
Admission hashes bind the exact submission/publication profile before a server ID
exists; step and Git-receipt hashes bind the eventual ID as well. Sent-state recovery
always takes the read-only provider path. This does not activate a database, supply
the missing trusted authority service or implement receipt-to-checkpoint promotion.

[0211](../../intent/0211/EVIDENCE.md) adds a reference-only Temporal path around that
composition. The shared test harness verifies the actual SQL/Git/Temporal chain;
the original-payload and current-authority services remain synthetic test ports.
No new schema migration or runtime installation is introduced by that workflow.

[0212](../../intent/0212/EVIDENCE.md) uses the existing checkpoint transition for
candidate receipt reconciliation. The composed store verifies an immutable Git
observation outside SQL and supplies a short-lived exact evidence binding to the
checkpoint port. It needs separate reconciliation authority; ordinary `inspect`
never records success. Only dispatch-committed or already-succeeded steps qualify;
known failures and manually quarantined outcomes remain unchanged. No schema,
refund, retry, automatic invocation or live authority is added.

## Disabled encrypted candidate originals (0213)

`@steer/data/candidate-originals` exports `createCandidateOriginalStore` with fixed
org/subject/product/repository/branch/configuration/policy binding. Required trusted
ports are `authorize`, `verifyOriginal`, `lifecycle` and `keyForDraft`. No port has
a default, real keyring, fixture fallback or implied policy approval.

- `put(originalRequest)` accepts only the exact admitted candidate request and
  returns `stored`, `conflict`, `unavailable` or `unknown`. It encrypts before SQL,
  inserts once and verifies recovery; retry cannot overwrite prior ciphertext or
  renew its clock. An uncertain COMMIT never returns stored.
- `read({organizationId, operationId, inputDigest})` retrieves and verifies the
  exact request or raises a content-free unavailable error. Reads also latch any
  observed lifecycle restriction in SQL; they are not status-only operations.
- `close()` rejects new work and suppresses late output. It does not delete content,
  destroy keys, cancel an already committed row or claim complete memory erasure.

Migrations 0009/0010 introduce `steer_drafts.candidate_originals` with forced
owner/org/product RLS and dedicated `steer_draft_runtime` identity. It gets only
SELECT/INSERT and UPDATE(use_until, held); the trigger prevents content/clock
rewrites, deadline extension and hold release. Other ordinary runtime roles have
no schema/table access. The draft role has no execution/projection access. The
adapter is a trusted service boundary, not isolation against an administrator or
a compromised service capable of arbitrary role-scoped SQL/GUC impersonation.

AES-256-GCM authenticated metadata binds immutable request/owner/draft/operation/
configuration digests and creation/deadline. Serialized plaintext is limited to
768 KiB. Nonces are fresh; per-draft key leases and historical key IDs come from
the external secret seam, never SQL, Git or Temporal. Same-draft operations
serialize retention observations; fixed expiry is server creation + 168 hours,
shortened by trusted earlier deadlines. Observed holds/earlier clocks latch across
stored revisions. Restricted hold preservation, key destruction and all-copy
backup/restore enforcement remain required, unimplemented activation controls.

Authority, lifecycle, key and pool acquisition calls have five-second bounds.
Single-flight admission remains held while timed-out dependencies drain. SQL uses
restricted role checks, scope scrubbing and normal statement/lock/idle timeouts;
no transaction spans lifecycle, key or operation-verification calls. Current
authorization/key/lifecycle is checked again before restored content is returned.

[0213 evidence](../../intent/0213/EVIDENCE.md) covers disposable SQL/Git/Temporal
and synthetic authority/lifecycle/key ports. This is immutable candidate-original
storage, not general editor autosave or generation checkpoint persistence. D1 is
unsigned; the real seven-migration baseline rejects the expanded development
journal before touching real private state. Nothing is installed in application
startup, and no actual user draft, key, role, provider or policy is changed.

## Disabled server-owned draft lifecycle (0214)

`@steer/data/draft-lifecycle` exports `createDraftLifecycleStore`, scoped by the
same organization/owner/product/home/configuration/policy tuple as original storage.
Every action needs a trusted `authorize` service. Configuration is not adoption.

- `create({requestId})`: server-minted draft ID and database creation/expiry, unique
  for the same org/owner/request UUID. Retry returns the original, even if expired;
  a new UUID or restored session does not refresh an existing draft clock.
- `inspect({draftId})`: current bounded lifecycle metadata. It is not permission
  to read content. `lifecycle(configAndDraftId)` implements 0213's loader contract.
- `discard({draftId})`: separately authorized explicit discard observation with
  a server-clock + 60-second use cutoff. No deletion and no retry renewal.
- `hold({draftId,holdReference})`: requires distinct `verifyHold` evidence service
  for the exact qualified decision. Sticky; no release method is provided.
- `recordPublication({draftId,operationId,inputDigest})`: requires trusted
  `verifyPublication` to return the exact verified effect and publication time.
  Callers cannot submit timestamps. The first binding is immutable; missing,
  mismatched, future or pre-creation observations cannot shorten/alter the record.
- `close()`: stop admission and withhold late results without erasing metadata.

Migrations 0011/0012 force owner/org/product RLS and immutable/monotone guards in
`steer_drafts.draft_lifecycles`. The draft role has only SELECT/INSERT and limited
restriction-column UPDATE, not deletion or clock/configuration rewriting. This
assumes the trusted service role boundary, not hostile-SQL or administrator isolation.
IDs/hashes/clock metadata are not anonymous data or exempt from records governance.

Authority, evidence and pool calls are bounded to five seconds; evidence checks
complete outside SQL and are freshness-checked before commit. Late denial/lost
acknowledgement yields unknown even when restriction metadata committed. A technical
10,000-row creation cap applies within the authorized owner/product scope; expiry
does not delete records or reset capacity. The metadata service is not a complete
retention, backup or disposal implementation.

Actual candidate Temporal tests load lifecycle state from SQL and deny original
retrieval when a hold is recorded after queueing. See [0214 evidence](../../intent/0214/EVIDENCE.md).
The expanded development migration set remains held against its seven-entry baseline.
Qualified publication/hold evidence sources, all-copy/key controls, D1 adoption,
versioned editor/checkpoint persistence and actual UI/runtime activation remain open.

## Disabled encrypted draft revisions (0215)

`@steer/data/draft-revisions` exports `createDraftRevisionStore` with the same
fixed organization/owner/product/home/configuration/policy tuple as the lifecycle
store. It requires current `authorize` and external per-draft `keyForDraft` ports;
there is no fixture or credential fallback. Its actual lifecycle row is required.

- `append({draftId,mutationId,expectedRevision,expectedDigest,content})` preserves
  original text, ordered clarification turns and nullable Brief/Spec/Exam content.
  Parent zero/null denotes the first snapshot. Subsequent parents must match the
  current revision and digest. The server assigns consecutive revision numbers.
- Exact command retries acknowledge the same revision. Different payload under
  the same mutation ID or competing parents conflict. Repeating an old command
  after a newer edit returns its old reference plus `latestRevision`, not a rewrite.
- `read({draftId,revision})` accepts an exact number or `latest`, resolves one fixed
  snapshot, verifies it and returns content/reference/latestRevision. A concurrent
  newer append may be reported separately; it never silently replaces the selected
  snapshot. There is no bulk cross-owner history search or export endpoint.
- `close()` rejects new admission and withholds late content. It does not destroy
  keys, delete old snapshots, cancel a committed insert or promise memory erasure.

Content has no trusted authorship/review/consent/signature/Git-success fields.
The server derives source revision from original/clarification changes and reuses
the existing final-scope hash for Brief/Spec bytes; Exam-only edits leave that scope
unchanged but do not validate Exam review. Matching bytes/undo never grant approval.
Generation originals and role checkpoints still need verified provenance services.

Migrations 0013/0014 bind `steer_drafts.draft_revisions` to the exact lifecycle
owner, force RLS and grant only SELECT/INSERT. The insert guard checks current use,
fixed metadata fields and contiguous parent chain under the lifecycle-row lock.
Application CAS repeats after encryption; no transaction spans authority or key IO.
AES-GCM metadata binds content, scope, parent, mutation, configuration and original
creation. Historical key access/current authority/current lifecycle and immutable
stored bytes are checked before releasing a snapshot. Source bytes and keys are
absent from SQL params/records outside encrypted envelopes.

Limits: 1,000 immutable revisions per draft and 768 KiB serialized plaintext per
snapshot; five-second authority/key/acquisition calls with retained admission during
timeouts. Expiry/holds deny every old revision without deletion. There is no silent
pruning, reset, conflict merge or zero-loss guarantee for unacknowledged keystrokes.

[0215 evidence](../../intent/0215/EVIDENCE.md) covers real disposable SQL and a
stored-revision-to-candidate/Temporal/native-Git chain with synthetic authority/key
ports. The actual editor/API is not wired to this service. D1 stays unsigned; the
real baseline of seven migrations rejects the fifteen-entry development journal.
No live content, migration, key, grant, spending, provider write or policy changes.
