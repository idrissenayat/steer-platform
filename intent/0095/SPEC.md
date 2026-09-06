# Specification

## Selection and input

`createMigrationCheckpointSequenceVerifier(contextBytes)` accepts canonical JSON
`steer-migration-checkpoint-sequence-context/v1` with an ordered
`checkpointContextBytes` array of 1–16 independently selected v2 slot contexts.
Each retains the 0093 fields: chainContextBytes, checkpointId, idempotencyKey,
headId, storeId and objectKey. Chain bytes, head and storage scope are identical
across slots; checkpoint and command IDs are unique. Caller evidence cannot
supply a trusted predecessor verdict or select a different scope.

The closed sequence envelope has version `steer-migration-checkpoint-sequence/v1`,
configDigest, policyDigest and `checkpoints`, an equally sized ordered array of
canonical v2 checkpoint envelope strings. Each v2 slot has the original 0093
envelope fields, a v2 version and the explicit sequence policy digest. Existing
v1 contexts, policies and public result shape remain unchanged.

UTF-8 bounds: sequence context 8 MiB, sequence envelope 128 MiB; inherited slot
context 1 MiB, slot envelope 64 MiB, store 256 KiB and signed record 64 KiB.
Nested chain/model limits still apply. These are offline bounded inputs, not
production endpoint resource budgets or throughput claims.

## Full proof and exact linkage

Every slot runs the complete 0094 current-observation chain verifier both at its
record-bound observation time and at the trusted current evaluation time. All
native signed bytes, key windows, human proofs, model checks and current expiry
remain mandatory. This does not attest the unsigned original audit-clock value.
No retained graph, attempt, signature or timestamp is rewritten in storage.

All twelve source records retain their required 0093 signatures, domains, closed
fields, chronology and storage/result bindings. They additionally contain exactly
`observationPolicyDigest` and `predecessorDigest`. The request digest includes
those fields alongside configDigest, policyDigest, chainDigest and observedAt.
For the first slot predecessorDigest is null. For a successor it is SHA-256 of
canonical {checkpointBytes, checkpointDigest, headDigest, reservationDigest},
using the full original prior slot envelope and its fully verified checkpoint,
current head and current reservation record digests.

The first opening is empty as in 0093. Every successor opening exactly matches
the verified prior current head value, previousHead, sequence, checkpointDigest
and retentionDigest. Its reservation links the prior current reservation digest;
its new command is unused and its opening reservation wins. Terminal state
advances exactly once; current readback has the same terminal state and does not
win or advance. Reservation IDs, terminal head values and storage object versions
cannot be recycled across the sequence, including a return to an opening head.

## Strict history extension

Only pending checkpoints can have successors. A successor has strictly more
attempts and its entire earlier attempt prefix is byte-identical. At least one
new signed migration request must occur in the suffix; each new request's before
proof is available no earlier than the prior current readback reservation. The
successor observation is also no earlier than that readback. Existing full-chain
replay, request ownership, row coverage and predecessor truth checks still apply.
Refused/restored attempts may extend history without advancing completed steps.
Replay-only or unchanged observations cannot create a new checkpoint update.

## Output and limits

Success is `verified-migration-checkpoint-sequence` with the final verified
checkpoint progress, checkpointCount, sequenceDigest, explicit observation policy
and trusted evaluation time. All effects and journalEffects are zero;
executionAuthorized, resumeAuthorized, originalObservationVerified and
latestStoreHeadVerified are false. Internal predecessor proof objects are not
exposed. The supplied sequence proves no absence of a newer external head.

Invalid configuration throws MIGRATION_CHECKPOINT_SEQUENCE_CONFIGURATION_INVALID;
invalid evidence returns blocked/MIGRATION_CHECKPOINT_SEQUENCE_INVALID. Prior
proofs must remain currently valid; this profile cannot renew them for a long-lived
restart or supply an archival trust policy. Real storage, concurrency, crash/restart
and the remaining normative/source/class/trust-era matrix are not implemented here.
