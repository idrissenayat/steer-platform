# Specification · development candidate

## Trusted scope and complete chain

createMigrationCheckpointVerifier accepts only a closed trusted context containing
the complete independently selected 0092 chain context, checkpointId,
idempotencyKey, headId, storeId and safe objectKey. The envelope binds context and
policy plus original chainBytes, observedAt and all twelve signed source records
in opening, checkpoint/retention, terminal, delivery and current-store evidence.
The original fixed registry is pinned; no new key, profile or caller clock default
is installed by evidence.

The complete original chain must pass at observedAt. Every signed nested record
is then reverified at explicit current time. Only unsigned contract-human bundle
evaluationTime scalars are rebound in an ephemeral view; original stored bytes
and every signature remain untouched. The original chain digest/evidence seal is
used for all pins, never the temporary current-view digest. Current state, counts
and truth must still match. Expired original plan or human authority blocks;
this is not an archival exception or a renewal of approval.

## Exact progress and retained payload

The record-domain checkpoint binds original chain/context/evidence digests,
observation time, current truth, completed/required steps, attempt/replay counts,
pending/complete state, exact next step and opening reservation digest. Every
field is derived from full verified chain evidence, not a supplied progress label.

The independent provider-domain retention record binds the checkpoint digest,
exact original chain bytes digest, trusted store/object key, concrete object
version and complete=true. Its receipt follows the checkpoint record. This is
supplied signed storage evidence, not an actual fetch or durability test.

## Store and acknowledgment chronology

Each store envelope has full CAS-head, replay-ledger and reservation records.
All bind the independently recomputed request digest, itself binding trusted
context, policy, exact chain bytes and original observation time. The context
also binds checkpoint/command/head/storage identity.

- Opening: unused checkpoint slot, no checkpoint/retention/result digest, unused
  replay, a winning reserved record, and a non-null valid head/predecessor/sequence.
- Checkpoint: recorded after that exact winning reservation.
- Terminal: after retention; a fresh head with previousHead equal to opening head
  and sequence exactly +1; exact checkpoint/retention/result pins; winning committed
  reservation linked to opening reservation.
- Delivery: independent recovery-provider-domain transport receipt after terminal
  reservation, bound to exact request/checkpoint/terminal digest, with only delivered
  or acknowledgment-lost accepted.
- Current: after delivery, the exact same terminal head/sequence/predecessor and
  checkpoint/retention/result; already-committed, non-winning reservation linked
  to terminal reservation. Reservation identities cannot repeat across stages.

Wrong domains/signatures, head drift, winner/loser confusion, altered result or
retention, unknown/partial delivery, reused reservations and reordered chronology
deny. A lost acknowledgment does not waive any terminal or readback proof.

All source records are current, at most 300 seconds old, have positive lifetimes
of at most 300 seconds and exact half-open expiry. Native/current key validity
and nanosecond ordering apply. Child validity cannot outlive checkpoint validity;
reservation validity cannot exceed its head/replay proofs.

## Outputs, bounds and limits

Success is verified-migration-checkpoint-readback with decision=REPLAY_NOOP,
factOnly=true, executionAuthorized=false, resumeAuthorized=false, zero effects
and journalEffects=0. It preserves pending versus complete and the next-step ID
as observed facts. No migration or checkpoint write, new approval or resume grant
is emitted.

Bounds use UTF-8 bytes: context 1,048,576; envelope 67,108,864; store envelope
262,144; each signed source record 65,536. Tighter nested chain/model limits remain.
Safe object paths reject absolute/backslash/traversing/empty segments. Errors are
fixed and content-free.

This verifies the first commit/current readback of one independently selected
checkpoint slot. It does not establish a chain-wide latest head, successive
checkpoint replacement, durable runtime CAS, actual storage/transport, multi-process
restart, future trust-era archival revalidation or all provider crash cuts.
Those limitations prevent using this result to authorize resumed work. All five
formal R5 findings remain open for remaining coverage and independent/protected review.
