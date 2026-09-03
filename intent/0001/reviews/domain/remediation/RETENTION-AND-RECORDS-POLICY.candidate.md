# Proposed retention and records policy v1

Status: **unsigned candidate; privacy/legal records-owner ruling required**

This candidate supplies mechanically exact conservative defaults for testing. It is
not organizational policy until the qualified human owners sign its exact
digest. Binding laws, contracts, investigations, holds, or customer policies are
handled only by the enumerated precedence rule below; no duration is presumed
stricter. Any unenumerated conflict blocks disposition and release.

## Time and canonical trigger events

All timestamps are UTC RFC 3339 with nanoseconds and `Z`. Intervals are half-open.
`P90D` is exactly 7,776,000 seconds. `P1Y`, `P3Y`, and `P7Y` add 1, 3, or 7 to
the UTC calendar year while preserving month/day/time; February 29 clamps to
February 28 in a non-leap target year.

Every trigger is RFC 8785 canonical JSON with exactly `eventVersion="1"`,
`eventType`, `eventId` (UUID), `organization`, nullable `itemId`, nullable
`environmentId`, `recordId`, `recordClass`, `artifactRevision` (40-hex),
`actorId`, `actorAuthority`, `policySha256`, `correlationId`, `occurredAt`,
`timestampAuthority`, and `providerRecordId`. Duplicate, missing, null-where-
non-null, unknown, or malformed members invalidate the trigger. `occurredAt`
must equal the named authority's durable timestamp; client time is never valid.

| Event type | Additional exact members | Timestamp authority and occurrence |
|---|---|---|
| `originator-session-opened` | `sessionId`, `authenticatedAt` | identity service durable `authenticatedAt` when session creation commits |
| `originator-draft-saved` | `sessionId`, `commitId`, `contentSha256` | code host immutable commit `committedAt` |
| `originator-session-abandoned` | `sessionId`, `reason`, `boundaryAt` | lifecycle scheduler transaction time exactly at the earliest of explicit-discard commit, identity sign-out commit, last authenticated input + 1,800 seconds, or open + 28,800 seconds; `occurredAt=boundaryAt` |
| `record-committed` | `recordSha256` | system of record immutable `committedAt` acknowledgement |
| `item-closed` | `closingRecordId`, `closingDecision` | code-host commit `committedAt` for signed `outcome-complete` or signed terminal cancellation; exactly one per item; reopening requires a new item ID |
| `environment-retired` | `releaseRailsRecordId`, `trafficDisabled=true`, `credentialsRevoked=true` | release-rails immutable record `committedAt` after both booleans are verified; partial shutdown is invalid |
| `hold-applied` | `holdId`, `selectorsSha256`, `reasonAuthority` | code-host commit `committedAt` of qualified-records-owner signed hold |
| `hold-released` | `holdId`, `releaseAuthority` | code-host commit `committedAt` of qualified-records-owner signed release |
| `run-terminal` | `runId`, `terminalStatus` | Temporal closed-workflow `closeTime` bound to immutable workflow history |
| `event-committed` | `sourceEventId`, `sourceEventSha256` | source system immutable event `committedAt` |
| `record-superseded` | `predecessorRecordId`, `successorRecordId`, `successorSha256` | system-of-record successor `committedAt`; successor must reference predecessor |
| `rebuild-requested` | `requestId`, `selectorSha256`, `authorizationRecordId` | code-host commit `committedAt` of eligible-human authorized rebuild request |
| `reference-revocation-authorized` | `authorizationRecordId`, `referenceInventorySha256`, `verificationBundleSha256`, `tombstoneRecordId` | code-host commit `committedAt` of an eligible records owner decision naming every Git reference, retained verification bytes, and future tombstone ID |
| `expiry-due` | `triggerEventId`, `computedExpiryAt` | lifecycle engine transaction time where `occurredAt=computedExpiryAt` |
| `deletion-requested` | `expiryEventId`, `copyInventorySha256` | lifecycle engine durable queue commit `committedAt` |
| `deletion-completed` | `requestId`, `providerReceiptsSha256`, `allCopiesGone=true` | lifecycle engine commit time after every inventory copy verifies absent/cryptographically erased |
| `tombstone-committed` | `deletionEventId`, `tombstoneSha256` | code-host immutable tombstone commit `committedAt` |
| `export-completed` | `exportId`, `exportSha256`, `inventorySha256` | evidence store immutable object `committedAt` |

An originator session ends on the first of successful authoritative save,
explicit discard, verified sign-out, 30 minutes of inactivity, or 8 hours after
opening. Unsaved text lives only in encrypted process memory for that session;
browser persistence, analytics, logs, caches, model-provider retention, crash
artifacts, and backups are prohibited. At session end it is erased within 60
seconds and verified by the complete storage crawl. A failed erase blocks new
originator sessions and emits a content-free incident record.

Saved text exists only in the authoritative committed artifact and governed
encrypted disaster-recovery copies. The originator service retains no separate
copy. The signed Gate 1 PostHog rule remains independent: content-free raw
events are retained exactly 90 days; no originator text or artifact content may
enter those events.

## Retention-rule precedence

The signed Gate 1 rule for content-free PostHog raw events is immutable here:
expiry is the `event-committed.occurredAt + P90D`. Neither “stricter,” a longer
duration, this candidate, nor residual Exam inference may alter it. Changing it
requires an explicit governed Gate 1 change by an eligible human.

The only enumerated duration exception is an active signed legal/operational hold
under this policy; it changes state to `retained-on-hold` without changing the
computed expiry. Any other signed law, contract, customer, or organizational
rule that conflicts with a trigger, duration, state, disposition, or selector in
this schedule yields `blocked-policy-conflict`. It may govern only after an Exam
author names the exact superseded row and an eligible human signs the exact rule,
path, SHA-256, authority, selectors, effective interval, and replacement result.
Missing bytes, hash mismatch, overlapping selectors, unenumerated conflict, or
more than one result also yields `blocked-policy-conflict`; no deletion, Gate 2,
release, or pilot may proceed.

## Record-class schedule

These are exact defaults, not open-ended minimums:

| Class | Canonical trigger | Default expiry | State at/after expiry without hold |
|---|---|---|---|
| authoritative item artifacts and learning decisions | `record-committed` | `retain-indefinitely` | `retained-immutable` |
| gate/specialist signatures and provider proofs | `item-closed` | trigger + `P7Y` | `deletion-due` |
| decision attempts, send-backs, denials, conflicts, timeouts, retries | `item-closed` | trigger + `P7Y` | `deletion-due` |
| legal determinations, signed-log events, public keys, rotations, revocations | `item-closed` | trigger + `P7Y` | `deletion-due` |
| release plans, release records, migration journals | `environment-retired` | trigger + `P7Y` | `deletion-due` |
| referenced technical evidence and every referenced object version | `item-closed` | trigger + `P3Y` | `retained-pending-safe-disposition` until an exact `reference-revocation-authorized` event and hash-valid retained verification bundle exist; then ordered deletion may start |
| unreferenced failed-run evidence | `run-terminal` | trigger + `P90D` | `deletion-due` |
| security access/audit logs without prohibited content | `event-committed` | trigger + `P1Y` | `deletion-due` |
| content-free PostHog raw events | `event-committed` | trigger + `P90D` | `deletion-due` |
| rebuildable projections, indexes, workflow/cache state | earliest `record-superseded` or `rebuild-requested` by `(occurredAt,eventId)` | trigger instant | `deletion-due`; never authority |
| deletion evidence and content-minimized tombstones | `deletion-completed` | trigger + `P7Y` | `deletion-due` |

Events order by `(occurredAt, ordinal, eventId)`, with ordinals: hold apply/release
`10`, expiry `20`, deletion request `30`, deletion completion `40`, tombstone
`50`. `deletion-due` is an internal transition and is never externally returned.
The externally assertable state is computed after all events at the query instant:

| Condition | Single external state |
|---|---|
| before expiry, no conflict | `retained-immutable` or, only for rebuildable state, `retained-disposable` |
| policy conflict at any time | `blocked-policy-conflict` |
| at/after expiry with active hold | `retained-on-hold` |
| referenced evidence at/after expiry without a complete, unambiguous, hash-valid `reference-revocation-authorized` event and retained verification bundle | `retained-pending-safe-disposition` |
| at/after expiry, no hold, before both completion and tombstone | `quarantined-deletion-pending` |
| completion and tombstone both durable, no restored copy | `deleted-tombstoned` |
| any restored/reappeared copy after completion | `quarantined-deletion-pending` |

At expiry with no hold, an ordinary row uses one lifecycle transaction to commit
`expiry-due` then `deletion-requested`; external reads can observe only
`quarantined-deletion-pending`. A referenced-evidence row instead commits
`expiry-due` and returns `retained-pending-safe-disposition` without a deletion
request unless its exact reference-revocation event and verification bundle are
already complete and hash-valid. When those prerequisites later become valid,
one transaction commits `deletion-requested` and changes the external state to
`quarantined-deletion-pending`. The final hold release after expiry applies the
same prerequisite branch at the release instant. Deletion succeeds only after
every primary, replica, version, backup, provider, and recovery copy is absent or
cryptographically erased and both final events are durable.

## Holds, access, disclosure, and export

- Only a qualified records owner may apply or release a hold. A hold binds exact
  organizations, items, classes/objects, reason, authority, scope, start, and
  optional end. It suspends deletion but never permits new collection.
- Access is least-privilege, tenant/object scoped, logged, and denied before
  credential or object retrieval. Disclosures require a named lawful/policy
  basis and a durable disclosure record.
- Export contains canonical records, digests, provider proofs, signed-log
  verification material, policy revision, and an inventory proving completeness.
- Backup, snapshot, WAL, object-version, replica, provider, and disaster-recovery
  copies follow the same hold and expiry. Deletion completes only when every
  applicable copy is deleted or cryptographically erased and provider evidence
  is retained.

## Expiry, destruction, and failure

At `expiry-due`, the system re-evaluates references, holds, retention-rule
precedence, and exact tenant/object authority. Except for the explicitly handled
referenced-evidence prerequisite below, a missing or ambiguous input yields
`blocked-policy-conflict` and blocks deletion.
Successful destruction records object/version IDs, before/after inventory,
method, actor, authorization, timestamps, provider receipts, and a content-free
tombstone. Broken Git references are forbidden: authoritative references either
remain resolvable for their required term or resolve to a signed tombstone and
the separately retained verification material required by policy.

For referenced evidence, a false, missing, incomplete, ambiguous, or hash-
mismatched revocation prerequisite is not a policy conflict and never starts
deletion. It yields `retained-pending-safe-disposition`, preserves the object and
all versions immutably, disables ordinary application use, permits only records-
owner/export/verification access, blocks release, and records the reference
inventory, prerequisite evaluation, missing/mismatched fields, verification-
bundle result, policy digest, and next permitted action. Only the exact later
`reference-revocation-authorized` event transitions it to deletion processing.

Retry, partial provider deletion, timeout, restore, and backup reappearance are
tested. Unknown outcomes quarantine the object and block a success claim.
Restore tests may use isolated copies only and must not reset retention clocks,
drop holds, or make expired prohibited content live again.

## Boundary cases

For every class/scenario, assert exactly one state using this ordered table:

| Scenario and query instant | Expected external state |
|---|---|
| no hold/conflict, expiry minus 1 second | scheduled pre-expiry state |
| no hold/conflict, exactly expiry after lifecycle transaction | `quarantined-deletion-pending` |
| no hold/conflict, expiry plus 1 second without final events | `quarantined-deletion-pending` |
| active hold, expiry minus 1 second | scheduled pre-expiry state |
| active hold, exactly expiry or later | `retained-on-hold` |
| referenced evidence, prerequisite true and hash-valid at expiry | `quarantined-deletion-pending` |
| referenced evidence, prerequisite false at expiry or later | `retained-pending-safe-disposition` |
| referenced evidence, prerequisite record missing at expiry or later | `retained-pending-safe-disposition` |
| referenced evidence, prerequisite ambiguous/incomplete/hash-mismatched at expiry or later | `retained-pending-safe-disposition` |
| referenced evidence, exact prerequisite becomes valid after expiry, after deletion-request transaction | `quarantined-deletion-pending` |
| final hold release after expiry, ordinary row after release transaction | `quarantined-deletion-pending` |
| final hold release after expiry, referenced evidence prerequisite unmet | `retained-pending-safe-disposition` |
| complete receipts plus completion and tombstone | `deleted-tombstoned` |
| failed/partial/timeout/unknown deletion | `quarantined-deletion-pending` |
| restored or reappeared copy | `quarantined-deletion-pending` |
| wrong tenant/object, stale/hash-mismatched policy, or unenumerated conflict | `blocked-policy-conflict` |

The fixture freezes all event IDs and timestamps. Missing events, equal-time
events outside the ordinal order, or any second possible state fails.
