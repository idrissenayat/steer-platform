# Spec: Raw-v3 single-checkpoint continuation

Subsequent 0076 adds checkpoint-v2 only under a full verified predecessor chain.
V1 retains the single-checkpoint contract below. The shared verifier also rejects
receipts inside known hold intervals, including subsequently released holds.

## Versions and composition

0061 accepts raw-v2/all-first-or-all-replay as before. Continuation requires
`steer-lifecycle-graph/raw-v3`, an additional continuationBytes field, and batch
version `steer-raw-batch/v2`. Cross-version mixtures and extra fields deny. The
shared batch policy digest binds this checkpoint policy explicitly. Ordinary
and provenance paths are unchanged; no signed input is upgraded in place.
This is shape compatibility within the newly bound policy revision, not migration
of an older increment's signed policy pins. Original and continuation test
evidence are created under the same new policy contract.

Original events, state, inventory and grant remain the inputs of the original
request plan. Fresh recovery state is carried separately, not substituted into
old signatures. Every copy still traverses 0060 and exact provider receipt checks.
Its verified descriptor now includes receiptDigest for checkpoint matching.

0061 verifies the checkpoint, then the full original/current batch chains, before
returning any candidate success. The checkpoint helper alone is not authority;
its original plan/opening pins must also pass the independent 0074 checks. No
untrusted decision object can install a checkpoint or a per-copy grant.

## Fresh checkpoint envelope

The closed v1 envelope contains version, policyDigest, inventoryBytes, stateBytes,
checkpointBytes, eventBytes and historyBytes. Current evaluation time is supplied
separately. The complete current history traverses 0059, extends the exact original
signed history prefix, retains one original sanitization terminal, and matches
the record, revision, class, policy and trusted organization/item/environment.
No truncation, replacement or second terminal is allowed. Matched hold releases
require prior applications; an unreleased hold rejects continuation.

Three full signed records are mandatory. All have closed kind/config/source/time
fields, native signature and current trust-window validation, <=300-second
age/lifetime bounds and exact nanosecond time comparisons.

- Provider-signed raw-checkpoint-inventory names exactly the remaining prepared
  tuples, possibly none, with a complete inventory assertion. It follows the
  original opening and is newer than the original state. It must be captured
  after every checkpoint-listed completed receipt. It cannot omit a remaining
  copy, restore an already-completed copy, change any tuple or add an original.
- Authority-signed raw-checkpoint-state binds fresh inventory and complete history
  digests. It follows inventory and the latest event and requires cleared
  references and no active hold. A valid but active state cannot authorize
  continuation. History and state cannot contradict each other about an active hold.
- Authority-signed raw-checkpoint binds checkpointId, sequence=1,
  previousCheckpointDigest=null, stable consumption key, original input/plan/
  opening reservation, human authority and tuple digests, exact completed/remaining
  partition, fresh inventory/state/history digests and validity. It follows fresh
  state, and its validity cannot outlive inventory or state.

Completed entries contain copyId, original requestDigest and exact receiptDigest.
They must match every currently verified REPLAY_NOOP copy, in original inventory
order. Remaining IDs match every first-mode copy and the fresh inventory exactly.
Neither caller order nor a caller boolean can substitute for the actual per-copy
verifier result. A completed receipt must predate the inventory capture; every
remaining receipt must follow the checkpoint and the later winning reservation.
The partition may be empty on either side, but cannot overlap or omit any copy.

## Current batch and tombstone

The batch keeps the complete original winning opening chain and immutable plan.
Current head/replay/reservation records still bind that opening, plan and stable
grant consumption key. Continuation requires the immediate successor head, a
checkpointed replay state with exactly the verified checkpoint digest, and a
reserved/true winner. Every current batch record follows the checkpoint. Every
remaining copy has its own reservation at or after this current batch reservation
and a receipt strictly later. All original request/credential/resource/provider
checks remain mandatory, including the inclusive terminal-plus-60-second deadline.

The final human tombstone conditions additionally include the checkpoint digest;
its decision follows both checkpoint and aggregate. The checkpoint does not
delegate human tombstone authority. There is still no human re-approval per raw
copy. Output binds the checkpoint transitively through batch replay/reservation
and tombstone proof, reports completedBeforeContinuation, and explicitly retains
executionAuthorized false with zero effects.

## Bounds and remaining work

Checkpoint envelope: 2,097,152 UTF-16 units; each fresh signed record: 65,536.
Existing event/history, 1–32-copy, batch, grant and lifecycle limits also apply.
Missing clocks, stale/future/bad-signature data and malformed canonical bytes deny.

Only one checkpoint after the original opening is supported. Sequence 2, a
previous checkpoint, arbitrary mixed statuses without raw-v3 proof, and a second
interruption's continuation are not supported. Repeated audit is not consuming
or replaying a live effect. All original evidence still must satisfy current
validity bounds; this is not archival verification or long-delayed recovery.

The synthetic evidence tests a stored checkpoint assertion, not durable writes,
restart recovery, atomic exclusion or source completeness. A production runner
still needs atomic per-grant consumption, current source/hold checks at action
time, retries and provider integrations. Multi-checkpoint monotonic recovery and
post-aggregate/tombstone crash semantics remain to specify and verify. All five
R5 findings, independent/protected review and gate requirements remain open.
