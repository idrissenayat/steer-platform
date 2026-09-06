# Specification · development candidate

## Trusted selection and compatibility

createReferenceLifecycleVerifier selects only steer-lifecycle-runtime/v5 and the
composed steer-lifecycle-graph/current-v5 contract. The trusted runtime requires
the original current registry/provider selection, historical context and archived
owner context plus the independent 0087 reference context. All registry bytes,
record/class/revision, repository, environment and organization/item must agree.
Only RC-REFERENCED-EVIDENCE is admitted. Existing v1–v4 classes, policy digests,
envelopes and results do not gain reference admission or a profile fallback.

## Complete lifecycle composition

The same graph verifies full historical/current typed events, original-era owner
records and current qualified holds, complete current copy inventory and state,
and the exact item-closed plus three-calendar-year retention boundary. Holds and
active references retain; an unexpired record schedules. An expired eligible
record with empty reference evidence returns retained-pending-safe-disposition
and REFERENCE_EVIDENCE_REQUIRED. Malformed or partial evidence blocks.

0087 revalidates actual retained reference/verification content, all nine owner
proofs, the independently bound typed event, every exact removal receipt and
independent cleared-state completion. That completion digest and hold state must
match current state and be available before it. Exactly one byte-identical
reference-revocation-authorized event must be in the complete current history,
not substituted from the archived prefix. Hold state must also be truthful when
the owner decided: a later hold transition before the committed reference event
cannot be represented as already completed by the earlier decision.

Every complete copy tuple adds objectSha256. Its version/hash must appear in the
trusted reference manifest; the distinct set of copy versions/hashes must equal
the entire manifest version set. Missing versions, unknown versions, changed
content, incomplete copies or source-original copies block. Multiple physical
copies of the same exact version remain independently inventoried and verified.

## Separate copy and tombstone evidence

Each copy requires a separate complete current disposition human, exact shared
0088 delete-copy action and selected-provider terminal receipt. The named
tombstone requires a separate human after the complete aggregate, the shared
commit-tombstone action and a durable terminal receipt. Exact tombstone record ID
and retained verification digest appear in both human conditions and provider-bound
action resources. Copy resources explicitly bind objectSha256.

The full graph input binds reference evidence along with history, inventory,
state and archival owner bytes. Reference-owner identities seed the same global
authority/provider/idempotency/reservation/head uniqueness guards as qualified
holds and later disposition humans. Existing per-action replay/CAS, selected
provider keys, aggregate completeness and receipt chronology remain mandatory.
First validation and exact replay both return executionAuthorized=false and zero
effects; success is validated-lifecycle-candidate, never deleted-tombstoned.

## Boundaries

All source observations and signatures in tests are synthetic. This does not
discover actual references, run a deletion transaction or establish live archive,
store, provider, key-rotation or crash-recovery behavior. Other classes and later
archival trust eras require their own complete integration. All five formal R5
findings remain open pending remaining coverage and independent/protected review.
