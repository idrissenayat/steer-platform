// Bounded offline chain composition; no store, credentials or provider effects.
import { exactKeys, jcs, parseCanonical, sha256, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { verifyRawCheckpointEvidence, policyDigest as checkpointPolicy } from '../0075/raw-checkpoint.candidate.mjs';
import { verifyRawBatchEvidence, policyDigest as batchPolicy } from '../0074/raw-batch.candidate.mjs';
export const policyDigest = sha256(jcs({ version: 'steer-raw-checkpoint-chain/v1', checkpointPolicy, batchPolicy, maxCheckpoints: 33,
  rules: 'verify every complete predecessor checkpoint and winning store chain; immutable original plan/opening/requests/receipts; monotonic completed sets and history; final actual replay partition; zero execution' }));
const ensure = (value) => { if (!value) throw new Error('RAW_CHECKPOINT_CHAIN_INVALID'); };
const summary = (checkpoint) => Object.fromEntries(['checkpointDigest', 'recordedAt', 'completedCopyIds', 'remainingCopyIds'].map((field) => [field, checkpoint[field]]));

// Only 0061 supplies context, after verifying actual copy actions/receipts.
export function verifyRawCheckpointChain(serialized, context, evaluationTime) {
  try {
    ensure(typeof serialized === 'string' && serialized.length <= 8388608 && exactKeys(context, ['checkpointContext', 'batchContext', 'finalBatchBytes']));
    const chain = parseCanonical(serialized);
    ensure(exactKeys(chain, ['version', 'policyDigest', 'steps']) && chain.version === 'steer-raw-checkpoint-chain/v1' && chain.policyDigest === policyDigest &&
      Array.isArray(chain.steps) && chain.steps.length > 0 && chain.steps.length <= 33 && chain.steps.at(-1).batchBytes === context.finalBatchBytes);
    ensure(typeof context.finalBatchBytes === 'string' && context.finalBatchBytes.length <= 524288);
    const reference = parseCanonical(context.finalBatchBytes), openingInput = parseCanonical(reference.openingBytes);
    const openingHead = parseCanonical(openingInput.headBytes), openingReservation = parseCanonical(openingInput.reservationBytes);
    let previousBatchHead = { headId: openingHead.headId, head: openingHead.head, sequence: openingHead.sequence, reservationDigest: openingReservation.recordDigest };
    let previous = { sequence: 0, checkpointDigest: null, historyBytes: context.checkpointContext.originalHistoryBytes,
      completedCopyIds: [], stateAt: context.checkpointContext.originalStateAt, authorizedAt: openingReservation.recordedAt };
    const ids = new Set(), heads = new Set([openingHead.head]); let checkpoint, batchEvidence;
    for (const step of chain.steps) {
      ensure(exactKeys(step, ['checkpointBytes', 'batchBytes']) && typeof step.checkpointBytes === 'string' && step.checkpointBytes.length <= 2097152 &&
        typeof step.batchBytes === 'string' && step.batchBytes.length <= 524288);
      const batch = parseCanonical(step.batchBytes), input = parseCanonical(step.checkpointBytes);
      ensure(batch.version === 'steer-raw-batch/v3' && input.version === 'steer-raw-checkpoint/v2' && batch.planBytes === reference.planBytes && batch.openingBytes === reference.openingBytes);
      checkpoint = verifyRawCheckpointEvidence(step.checkpointBytes, { ...context.checkpointContext, previous }, evaluationTime);
      ensure(checkpoint.state === 'verified-raw-checkpoint' && !ids.has(checkpoint.checkpointId)); ids.add(checkpoint.checkpointId);
      batchEvidence = verifyRawBatchEvidence(step.batchBytes, { ...context.batchContext, checkpoint: summary(checkpoint), previousBatchHead }, evaluationTime);
      ensure(batchEvidence.state === 'verified-raw-batch');
      // Parse only after the complete independent signature/link checks succeed.
      const head = parseCanonical(batch.headBytes), reservation = parseCanonical(batch.reservationBytes);
      ensure(!heads.has(head.head)); heads.add(head.head);
      previousBatchHead = { headId: head.headId, head: head.head, sequence: head.sequence, reservationDigest: reservation.recordDigest };
      previous = { sequence: checkpoint.sequence, checkpointDigest: checkpoint.checkpointDigest, historyBytes: checkpoint.historyBytes,
        completedCopyIds: checkpoint.completedCopyIds, stateAt: checkpoint.stateAt, authorizedAt: reservation.recordedAt };
    }
    const entries = context.batchContext.entries;
    ensure(jcs(checkpoint.completedCopyIds) === jcs(entries.filter((entry) => entry.replayed).map((entry) => entry.copyId)) &&
      jcs(checkpoint.remainingCopyIds) === jcs(entries.filter((entry) => !entry.replayed).map((entry) => entry.copyId)));
    return { state: 'verified-raw-checkpoint-chain', ...summary(checkpoint), checkpointCount: chain.steps.length,
      chainDigest: sha256(serialized), batchEvidence, effects: zeroEffects(), executionAuthorized: false };
  } catch { return { state: 'blocked', firstError: 'RAW_CHECKPOINT_CHAIN_INVALID', effects: zeroEffects(), executionAuthorized: false }; }
}
