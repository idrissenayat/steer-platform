# Proposed retention and records policy v2

Status: **unsigned replacement candidate; new qualified privacy/legal records-owner ruling required**

This is a complete replacement candidate for the v1 policy accepted by HR-01.
It preserves the exact Gate 1 content-free PostHog `P90D` rule and adds the
previously unenumerated `sanitized-real` evaluation lifecycle. The prior HR-01
record remains valid evidence of its historical decision but does not accept
this file or its digest. No deletion, production use, release, or spending is
authorized by this candidate.

## Canonical time and event contract

All time is UTC RFC 3339 with nanoseconds and `Z`; intervals are half-open.
`P30D` is 2,592,000 seconds and `P90D` is 7,776,000 seconds. `P1Y`, `P3Y`, and `P7Y` add calendar years in UTC,
clamping February 29 to February 28 when necessary.

Every lifecycle event is duplicate-key-rejecting RFC 8785 JSON with exactly:
`eventVersion="2"`, `eventType`, UUID `eventId`, `organization`, nullable
`itemId`, nullable `environmentId`, `recordId`, `recordClass`, 40-hex
`artifactRevision`, `actorId`, `actorAuthority`, `policySha256`,
`correlationId`, `occurredAt`, `timestampAuthority`, and `providerRecordId`,
plus the exact event-specific members below. Missing, extra, duplicated,
malformed, wrong-tenant, stale-policy, or caller-timestamp members invalidate
the event and produce `blocked-policy-conflict` without a disposition request.

| Event | Exact additional members | Durable time authority |
|---|---|---|
| `originator-session-opened` | `sessionId`, `authenticatedAt` | identity-service session commit |
| `originator-draft-saved` | `sessionId`, `commitId`, `contentSha256` | code-host commit |
| `originator-session-abandoned` | `sessionId`, `reason`, `boundaryAt` | earliest durable discard, sign-out, idle + 1,800 s, or open + 28,800 s |
| `record-committed` | `recordSha256` | system-of-record commit |
| `item-closed` | `closingRecordId`, `closingDecision` | signed terminal code-host commit |
| `environment-retired` | `releaseRailsRecordId`, `trafficDisabled=true`, `credentialsRevoked=true` | release-rails commit after both facts |
| `run-terminal` | `runId`, `terminalStatus` | Temporal close time |
| `event-committed` | `sourceEventId`, `sourceEventSha256` | source-system commit |
| `record-superseded` | `predecessorRecordId`, `successorRecordId`, `successorSha256` | successor commit |
| `corpus-source-authorized` | `sourceAuthorityId`, `sourceObjectSha256`, `purpose="originator-assistant-evaluation"`, `useAuthorizationId`, `useAuthorizationSha256`, `authorizedThrough`, `allowedDerivatives=["sanitized-corpus","baseline","failure-shrink"]` | qualified privacy/legal records-owner decision commit |
| `corpus-use-authorization-revoked` | `useAuthorizationId`, `revocationDecisionId`, `revokedAt`, `affectedCorpusVersions` | qualified privacy/legal records-owner decision commit |
| `corpus-sanitization-terminal` | `corpusId`, `sourceObjectSha256`, `sanitizerRevision`, `inspectionRevision`, `result`, `reportSha256`, `rawWorkingCopyDisposition`, `rawDispositionReceiptSha256` | isolated sanitizer transaction commit |
| `corpus-version-accepted` | `corpusId`, `corpusVersion`, `encryptedObjectSha256`, `manifestSha256`, `keyId`, `useAuthorizationId` | test-fixture registry commit after all privacy checks pass |
| `corpus-version-superseded` | `corpusId`, `corpusVersion`, `successorVersion`, `successorManifestSha256` | successor fixture-registry commit |
| `corpus-retired` | `corpusId`, `corpusVersion`, `retirementReason` | qualified records-owner decision commit |
| `hold-applied` | `holdId`, `selectorsSha256`, `reasonAuthority` | qualified records-owner signed code-host commit |
| `hold-released` | `holdId`, `releaseAuthority` | qualified records-owner signed code-host commit |
| `rebuild-requested` | `requestId`, `selectorSha256`, `authorizationRecordId` | eligible-human authorized code-host commit |
| `reference-revocation-authorized` | `authorizationRecordId`, `referenceInventorySha256`, `verificationBundleSha256`, `tombstoneRecordId` | qualified records-owner signed code-host commit |
| `raw-working-policy-grant-signed` | `policyGrantId`, `grantSha256`, `recordClass="RC-CORPUS-RAW-WORKING"`, `validFrom`, `expiresAt`, `safeguards`, `qualifiedOwnerSubject` | qualified privacy/legal records-owner signed code-host commit |
| `derived-record-deleted` | `parentCorpusId`, `parentCorpusVersion`, `derivedRecordId`, `derivedRecordClass`, `deletionReceiptSha256` | lifecycle commit after verified deletion |
| `expiry-due` | `triggerEventId`, `computedExpiryAt` | lifecycle transaction at computed expiry |
| `deletion-requested` | `expiryEventId`, `copyInventorySha256`, `dispositionAuthorizationId` | lifecycle queue commit after exact authorization |
| `deletion-completed` | `requestId`, `providerReceiptsSha256`, `allCopiesGone=true` | lifecycle commit after every copy is absent or cryptographically erased |
| `tombstone-committed` | `deletionEventId`, `tombstoneSha256` | code-host tombstone commit |
| `export-authorized` | `exportAuthorizationId`, `selectorsSha256`, `purpose`, `recipient`, `expiresAt` | qualified records-owner signed decision commit |
| `export-completed` | `exportId`, `exportSha256`, `inventorySha256`, `exportAuthorizationId` | immutable evidence-object commit |

Events sort by `(occurredAt, ordinal, eventId)`: hold apply/release 10,
supersession/retirement 15, expiry 20, deletion request 30, completion 40,
tombstone 50. Equal-time events outside this order fail.

## Originator session boundary

Unsaved source text may exist only in encrypted process memory for its one
authenticated session. Browser persistence, analytics, logs, caches, provider
retention/training, crash artifacts, and backups are prohibited. The session
ends on first authoritative save, discard, sign-out, 30 minutes idle, or eight
hours open. All unsaved copies are erased and crawl-verified within 60 seconds;
failure blocks new sessions and emits only a content-free incident.

Saved product text exists only in its authoritative artifact and governed
encrypted disaster-recovery copies. The originator service keeps no copy.

## `sanitized-real` privacy class

`sanitized-real` is not a label supplied by a fixture author. It is valid only
when one accepted `corpus-version-accepted` event binds all 20 encrypted prompt
objects, the provenance/use authorization, sanitizer, independent inspection,
raw-source disposition, and this policy revision.

The sanitizer normalizes Unicode NFC and removes or replaces every direct
identifier: personal name, username/handle, email, phone, postal address,
precise location, government/account/customer/employee/device identifier,
IP/MAC, URL containing an identity token, biometric, signature, secret, token,
credential, and free-text self-identification. It generalizes dates to calendar
month, ages to 10-year bands, locations to country, organizations and projects
to stable synthetic labels, and exact monetary/volume/headcount values to
predeclared bands. A quasi-identifier tuple of `(country, age-band, role-band,
industry-band, month)` must have equivalence class `k >= 5` in the authorized
source pool or the field is suppressed.

The independent oracle tokenizes NFC-lowercase text on Unicode letters and
digits, removes the versioned public allowlist and stopword list, and fails on:

1. any direct-identifier detector hit;
2. any unapproved named entity retained from the raw source;
3. any contiguous four-token sequence shared with one and only one raw source;
4. any quasi-identifier equivalence class below five;
5. a deterministic blinded linkage attack over the authorized source pool with
   top-1 accuracy above `0.10` or Wilson 95% upper bound above `0.25`;
6. any prompt, baseline, failure shrink, log, cache, history, export, or backup
   missing a passing record for the exact sanitizer and inspection revisions.

Both sanitizer and inspector run in isolated, network-denied environments under
different service identities. The manifest freezes detector models, dictionaries,
allowlists, stopwords, tokenization code, source-pool hashes, seed, outputs, and
all per-prompt results. A fail or inconclusive result creates no accepted corpus.
Production and fixture credentials, keys, buckets, repositories, indexes,
analytics projects, and model caches are distinct; a cross-destination write is
always denied.

The raw source remains under its named source authority. Before sanitization, a
qualified privacy/legal records owner may sign one time-bounded
`raw-working-policy-grant` for exactly `RC-CORPUS-RAW-WORKING`. The grant binds
organization, tenant, item, policy digest, sanitizer/inspector revisions,
allowed temporary-copy providers, complete-copy-inventory rule, terminal event,
mandatory 60-second deadline, erase method, receipt requirement, hold/reference
denial, target digest, signer credential, expiry, idempotency key, and CAS head.
It delegates only deterministic destruction after terminal sanitization; it
cannot authorize collection, use, export, other record classes, or deletion of
the source-authority original. It is invalid before `validFrom`, at or after
`expiresAt`, after revocation, for a changed inventory/policy/target, or without
the named safeguards.

At `corpus-sanitization-terminal`, the lifecycle engine atomically verifies the
current grant and copy inventory and issues one-use delete/crypto-erase
credentials without a new per-object human decision. Any temporary sanitizer
copy is cryptographically erased and receipt-committed no later than terminal
time plus 60 seconds. A missing/invalid grant at terminal yields
`blocked-missing-raw-policy-grant`: no accepted corpus is created, the sanitizer
is quarantined, new inputs are blocked, and an incident is raised. The system
must still minimize exposure, but it must not fabricate authorization or a
deletion receipt. Deadline miss, failed, partial, timeout, unknown, or restored
copy yields `quarantined-raw-erasure-failed` and prohibits Git/object publication.

## Exhaustive record-class schedule

These fixed defaults are exhaustive. A copy in Git history, fork, pull request,
cache, object version, provider backup, replica, snapshot, export, workstation,
or disaster-recovery media inherits the source record class and expiry.

| Class ID | Records | Trigger and fixed expiry | Access/export | Disposition |
|---|---|---|---|---|
| `RC-AUTHORITATIVE-ARTIFACT` | item artifacts and learning decisions | `record-committed`; indefinite | eligible item readers; governed export | retained immutable |
| `RC-DECISION-PROOF` | gate/specialist signatures, provider proofs, attempts, denials, conflicts, retries | `item-closed + P7Y` | audit/records roles; governed export | verified deletion + tombstone |
| `RC-LEGAL-SIGNED-LOG` | legal rulings, signed-log events/keys/rotation/revocation | `item-closed + P7Y` | legal/records verification | verified deletion + tombstone |
| `RC-RELEASE-MIGRATION` | release plans/records and migration journals | `environment-retired + P7Y` | release/records roles | verified deletion + tombstone |
| `RC-REFERENCED-EVIDENCE` | referenced evidence and all versions | `item-closed + P3Y` | verification only after expiry | retain pending safe disposition until reference revocation, then delete + tombstone |
| `RC-FAILED-RUN` | unreferenced failed-run evidence | `run-terminal + P90D` | test owner; governed export | verified deletion + tombstone |
| `RC-SECURITY-AUDIT` | content-free access/audit logs | `event-committed + P1Y` | security/records roles | verified deletion + tombstone |
| `RC-POSTHOG-RAW` | content-free PostHog raw events | `event-committed + P90D` exactly | measurement role; no content export | verified deletion + tombstone |
| `RC-REBUILDABLE` | projections, indexes, workflow/cache state | earliest supersession/rebuild request | no export as authority | immediate verified deletion |
| `RC-DELETION-EVIDENCE` | receipts and content-minimized tombstones | `deletion-completed + P7Y` | records verification | verified deletion + final tombstone |
| `RC-CORPUS-RAW-WORKING` | temporary raw source copies and pre-sanitized intermediates | `corpus-sanitization-terminal + PT60S` | isolated sanitizer only; export prohibited | cryptographic erase; receipt mandatory |
| `RC-CORPUS-PROVENANCE` | source provenance, use authorization/revocation, sanitizer/inspection reports, raw-disposition receipts | later of `corpus-retired` or the maximum verified `derived-record-deleted` time over the manifest's closed derived-record inventory, plus `P7Y`; missing inventory/completion blocks expiry | privacy/legal records owner; content-minimized governed export | verified deletion + tombstone |
| `RC-CORPUS-SANITIZED` | encrypted accepted prompts; Git references/history/forks; provider copies/versions/backups | earliest `corpus-version-superseded` or `corpus-retired`, plus `P1Y` | evaluation runner only while authorization current; export requires exact corpus authorization | crypto-erase key and all residual plaintext/cache copies; tombstone |
| `RC-CORPUS-BASELINE` | generated baselines and aggregate evaluation outputs containing no prompt text | `corpus-retired + P3Y` | evaluation/records roles; governed export | verified deletion + tombstone |
| `RC-CORPUS-DERIVED-TEXT` | failure shrinks, counterexamples, debug/provider/model caches containing any prompt derivative | `run-terminal + P90D`, never later than parent corpus expiry | isolated evaluator only; export prohibited | verified deletion + tombstone |
| `RC-CORPUS-EXPORT` | authorized corpus export | `export-completed + P30D` and never later than parent expiry | exact recipient/purpose only | verified deletion + tombstone |

Use authorization is checked at every read and must be current for the purpose,
corpus version, recipient service, and derivative type. Expiry or revocation
denies access immediately; it never waits for physical deletion. Corpus keys are
one per version and unavailable to production services.

## Precedence, holds, disclosure, export, and failure

The Gate 1 PostHog rule is immutable: `RC-POSTHOG-RAW` expires at exactly
`event-committed + P90D`. Changing it requires a new governed Gate 1.

An active, signed, selector-exact hold changes an expired record to
`retained-on-hold` without changing computed expiry and never permits new use or
collection. Any other law, contract, customer, or policy conflict yields
`blocked-policy-conflict` until an Exam author names the exact superseded row and
an eligible human signs the replacement. Missing bytes, hash mismatch,
overlapping selectors, or more than one result also block.

Access is least-privilege and logged. Disclosure/export requires a named lawful
or policy basis, current authorization, exact inventory, recipient, purpose,
expiry, and immutable completion receipt. Export does not reset retention.

At expiry the lifecycle engine re-evaluates policy, tenant/object, parent corpus
and parent expiry, holds, references, use authorization/revocation, the closed
derived-record inventory, and complete copy inventory. `RC-CORPUS-DERIVED-TEXT`
and `RC-CORPUS-EXPORT` always use the earlier of their own expiry and the parent
corpus expiry. A referenced object without exact revocation and a retained verification bundle remains
`retained-pending-safe-disposition` and emits no delete. Otherwise one atomic
transaction records `expiry-due` and `deletion-requested`, yielding
`quarantined-deletion-pending`. Only schema-valid provider-signed receipt bytes for every
primary, replica, version, history/fork, cache, backup, provider, export, and DR
copy, whose independently derived digests and ordered rows exactly equal the
aggregate receipt, plus a durable tombstone yield `deleted-tombstoned`. Unknown, partial,
timeout, corrupt, or reappeared copies remain quarantined and block success.

## Deterministic boundary matrix

The executable policy table is the exact 16-row class-to-trigger/duration map
exported by `semantic-oracles.candidate.mjs`; its RFC 8785 SHA-256 digest is
bound into every lifecycle event and signed trigger-history record. The oracle
derives `boundaryAt` from those signed events and rejects any supplied boundary
that differs. `P30D`, `P90D`, and `PT60S` use the fixed seconds above; `P1Y`,
`P3Y`, and `P7Y` use UTC calendar-year addition with February 29 clamping.
Provenance requires a closed derived-record inventory exactly equal to its
signed deletion events, and derived/export rows require the signed parent-expiry
event for their earlier-of cap.

The complete-copy inventory is signed, target-bound, duplicate-free, captured
no more than five minutes before evaluation, and rechecked immediately before
reservation. Completion receipts cannot predate the derived boundary;
tombstones cannot predate receipts. Delete/erase and tombstone commits each
traverse the same protected-action oracle with authoritative CAS head, replay
ledger, and atomic winner/loser result. A stale inventory, replay drift, race
loss, early receipt, or early tombstone has zero lifecycle effect.

Provider receipts bind stable provider receipt/request/transaction IDs,
provider identity and proof, the exact request and copy/key tuple, terminal
effect, and a timestamp strictly after the request and strictly before the
aggregate receipt. The lifecycle event, selected inventory tuple, protected
request, provider receipt, aggregate receipt, and tombstone also bind the
immutable provider-key-registry digest and independently selected provider
binding. Verification selects the sole current non-revoked public key from
that binding and never trusts receipt-controlled provider, key, account,
tenant, proof-type, or issuer claims. Exact same-key and same-request-byte committed replays
reconcile these receipts, the aggregate receipt, and the tombstone and return
the completed state without a second destructive effect. Different bytes,
missing or incomplete evidence, a conflicting tombstone, in-progress timeout,
or race loss remains blocked or quarantined with zero effect.

Every record class is tested one second before, exactly at, and one second after
expiry; with no hold, active hold, released hold, overlapping/mismatched hold;
current/expired/revoked use authorization; missing/false/incomplete/ambiguous/
hash-mismatched reference revocation; wrong tenant/object; stale policy; partial,
timeout, retry, restored backup, missing receipt, export, and race with read.
Exactly one state is allowed: pre-expiry scheduled state,
`blocked-policy-conflict`, `retained-on-hold`,
`retained-pending-safe-disposition`, `quarantined-deletion-pending`, or
`deleted-tombstoned`. Authorization and delete requests use one idempotency key;
two simultaneous workers yield one request and one tombstone. A read racing the
expiry transaction either completes entirely before revocation or is denied
before object credentials; it may never return bytes after access revocation.

`RC-CORPUS-RAW-WORKING` additionally runs at terminal, terminal plus 59 seconds,
exactly terminal plus 60 seconds, and plus 61 seconds with current, missing,
not-yet-valid, expired, revoked, wrong-class, wrong-policy, wrong-target, and
inventory-changed grants. The only success path is one erase request and one
receipt by the deadline. Missing authorization never becomes implicit success;
it yields `blocked-missing-raw-policy-grant`, while a missed or unknown effect
yields `quarantined-raw-erasure-failed` and zero accepted-corpus effects.
