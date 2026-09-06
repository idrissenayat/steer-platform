// Offline checkpoint/readback audit only. Never persists, resumes or dispatches.
import { readFileSync } from 'node:fs';
import { exactKeys, hex, jcs, parseCanonical, sha256, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createTimedRecordVerifier } from '../0058/record-verifier.candidate.mjs';
import { exactInstant } from '../0069/exact-time.candidate.mjs';
import { createMigrationChainVerifier, policyDigest as chainPolicyDigest } from '../0092/migration-chain.candidate.mjs';
const registryBytes = jcs(JSON.parse(readFileSync(new URL('../0001/reviews/domain/round-3/remediation/TRUST-REGISTRY.candidate.json', import.meta.url), 'utf8')));
const timed = createTimedRecordVerifier(registryBytes);
export const policyDigest = sha256(jcs({ version: 'steer-migration-checkpoint/v1', chainPolicyDigest, registryDigest: timed.registryDigest, timePolicyDigest: timed.timePolicyDigest,
  rules: 'full original/current chain; exact retained bytes; opening winner, committed terminal and current readback; independent delivery outcome; no duplicate effect or resume authority' }));
const ensure = (value) => { if (!value) throw new Error('MIGRATION_CHECKPOINT_INVALID'); };
const text = (value) => typeof value === 'string' && value.length > 0 && value.length <= 512 && value.trim() === value && !/[\u0000-\u001f\u007f*?]/u.test(value);
const bounded = (value, maximum) => typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= maximum;
const time = (value) => { const parsed = exactInstant(value); ensure(parsed !== null); return parsed; };

export function createMigrationCheckpointVerifier(contextBytes) {
  let context, chain, chainContext;
  try {
    ensure(bounded(contextBytes, 1048576)); context = parseCanonical(contextBytes);
    ensure(exactKeys(context, ['version', 'chainContextBytes', 'checkpointId', 'idempotencyKey', 'headId', 'storeId', 'objectKey']) &&
      context.version === 'steer-migration-checkpoint-context/v1' && ['checkpointId', 'idempotencyKey', 'headId', 'storeId', 'objectKey'].every((key) => text(context[key])) &&
      !context.objectKey.startsWith('/') && !context.objectKey.includes('\\') && context.objectKey.split('/').every((part) => part !== '' && part !== '.' && part !== '..'));
    chain = createMigrationChainVerifier(context.chainContextBytes); chainContext = parseCanonical(context.chainContextBytes);
  } catch { throw new Error('MIGRATION_CHECKPOINT_CONFIGURATION_INVALID'); }
  const configDigest = sha256(contextBytes);
  return Object.freeze({ configDigest, policyDigest,
    verify(serialized, evaluationTime) {
      try {
        const now = time(evaluationTime); ensure(bounded(serialized, 67108864)); const input = parseCanonical(serialized);
        ensure(exactKeys(input, ['version', 'configDigest', 'policyDigest', 'chainBytes', 'observedAt', 'openingStoreBytes', 'checkpointBytes', 'retentionBytes', 'terminalStoreBytes', 'deliveryBytes', 'currentStoreBytes']) &&
          input.version === 'steer-migration-checkpoint/v1' && input.configDigest === configDigest && input.policyDigest === policyDigest && time(input.observedAt) <= now);
        const original = chain.verify(input.chainBytes, input.observedAt);
        ensure(['verified-migration-chain', 'verified-migration-chain-pending'].includes(original.state));
        // Only the unsigned audit-clock scalar changes in this ephemeral view.
        // Preserve original bytes for all pins; every signed record is unchanged.
        const originalChain = parseCanonical(input.chainBytes), view = { ...originalChain, attempts: originalChain.attempts.map((attempt) => {
          const compatibility = parseCanonical(attempt.compatibilityBytes), graph = parseCanonical(compatibility.graphBytes);
          if (graph.cleanupBundleBytes !== '') {
            const bundle = parseCanonical(graph.cleanupBundleBytes); ensure(bundle.evaluationTime === input.observedAt);
            graph.cleanupBundleBytes = jcs({ ...bundle, evaluationTime });
          }
          return { ...attempt, compatibilityBytes: jcs({ ...compatibility, graphBytes: jcs(graph) }) };
        }) };
        const current = chain.verify(jcs(view), evaluationTime);
        ensure(['state', 'completedStepCount', 'requiredStepCount', 'attemptCount', 'replayCount', 'currentTruthDigest'].every((field) => current[field] === original[field]));
        const chainDigest = sha256(input.chainBytes), requestDigest = sha256(jcs({ configDigest, policyDigest, chainDigest, observedAt: input.observedAt }));
        const proof = (bytes, domain, kind, fields) => {
          ensure(bounded(bytes, 65536)); const raw = parseCanonical(bytes);
          const record = timed.verifyBytes(bytes, { domain, recordedAt: raw.recordedAt, evaluatedAt: evaluationTime }).record;
          ensure(exactKeys(record, ['kind', 'source', 'configDigest', 'requestDigest', 'recordedAt', 'validThrough', ...fields, 'recordDigest', 'signature']) &&
            record.kind === kind && record.configDigest === configDigest && record.requestDigest === requestDigest && now < time(record.validThrough) &&
            time(record.recordedAt) < time(record.validThrough) && now - time(record.recordedAt) <= 300000000000n && time(record.validThrough) - time(record.recordedAt) <= 300000000000n);
          return record;
        };
        const checkpoint = proof(input.checkpointBytes, 'record', 'migration-checkpoint', ['chainConfigDigest', 'checkpointId', 'chainDigest', 'chainEvidenceDigest', 'observedAt',
          'currentTruthDigest', 'completedStepCount', 'requiredStepCount', 'attemptCount', 'replayCount', 'nextStepId', 'status', 'openingReservationDigest']);
        ensure(checkpoint.source === 'authoritative-migration-checkpoint-store' && checkpoint.chainConfigDigest === chain.configDigest && checkpoint.checkpointId === context.checkpointId &&
          checkpoint.chainDigest === chainDigest && checkpoint.chainEvidenceDigest === original.evidenceDigest && checkpoint.observedAt === input.observedAt &&
          ['currentTruthDigest', 'completedStepCount', 'requiredStepCount', 'attemptCount', 'replayCount'].every((field) => checkpoint[field] === original[field]) &&
          checkpoint.status === (original.state === 'verified-migration-chain' ? 'complete' : 'pending') &&
          checkpoint.nextStepId === (chainContext.steps[original.completedStepCount]?.stepId ?? null) && hex(checkpoint.openingReservationDigest, 64) && time(checkpoint.recordedAt) >= time(input.observedAt));
        const retention = proof(input.retentionBytes, 'provider', 'migration-checkpoint-retention', ['checkpointDigest', 'retainedBytesDigest', 'storeId', 'objectKey', 'objectVersion', 'complete']);
        ensure(retention.source === 'authoritative-migration-checkpoint-storage' && retention.checkpointDigest === checkpoint.recordDigest && retention.retainedBytesDigest === chainDigest &&
          retention.storeId === context.storeId && retention.objectKey === context.objectKey && text(retention.objectVersion) && retention.complete === true &&
          time(retention.recordedAt) >= time(checkpoint.recordedAt) && time(retention.validThrough) <= time(checkpoint.validThrough));
        const readStore = (bytes, phase, previous = null, availableAt = time(input.observedAt)) => {
          ensure(bounded(bytes, 262144)); const store = parseCanonical(bytes); ensure(exactKeys(store, ['headBytes', 'replayBytes', 'reservationBytes']));
          const head = proof(store.headBytes, 'cas-authority', `migration-checkpoint-${phase}-head`, ['headId', 'head', 'previousHead', 'sequence', 'checkpointDigest', 'retentionDigest']);
          const replay = proof(store.replayBytes, 'replay-authority', `migration-checkpoint-${phase}-replay`, ['headDigest', 'idempotencyKey', 'status', 'resultDigest']);
          const reservation = proof(store.reservationBytes, 'cas-authority', `migration-checkpoint-${phase}-reservation`, ['reservationId', 'headDigest', 'replayDigest', 'previousReservationDigest', 'status', 'winner']);
          for (const record of [head, replay, reservation]) ensure(record.source === 'authoritative-migration-checkpoint-cas' && time(record.recordedAt) >= availableAt && time(record.validThrough) <= time(checkpoint.validThrough));
          ensure(head.headId === context.headId && hex(head.head, 64) && hex(head.previousHead, 64) && head.head !== head.previousHead && Number.isSafeInteger(head.sequence) && head.sequence > 0 &&
            replay.headDigest === head.recordDigest && replay.idempotencyKey === context.idempotencyKey && text(reservation.reservationId) && reservation.headDigest === head.recordDigest &&
            reservation.replayDigest === replay.recordDigest && time(replay.recordedAt) >= time(head.recordedAt) && time(reservation.recordedAt) >= time(replay.recordedAt) &&
            time(reservation.validThrough) <= time(head.validThrough) && time(reservation.validThrough) <= time(replay.validThrough));
          if (phase === 'opening') ensure(head.checkpointDigest === null && head.retentionDigest === null && replay.status === 'unused' && replay.resultDigest === null && reservation.previousReservationDigest === null &&
            reservation.status === 'reserved' && reservation.winner === true && time(reservation.recordedAt) < time(checkpoint.recordedAt));
          else {
            ensure(head.checkpointDigest === checkpoint.recordDigest && head.retentionDigest === retention.recordDigest && replay.status === 'committed' && replay.resultDigest === checkpoint.recordDigest &&
              reservation.previousReservationDigest === previous.reservation.recordDigest && reservation.reservationId !== previous.reservation.reservationId);
            if (phase === 'terminal') ensure(head.previousHead === previous.head.head && head.head !== previous.head.head && previous.head.sequence < Number.MAX_SAFE_INTEGER &&
              head.sequence === previous.head.sequence + 1 && reservation.status === 'committed' && reservation.winner === true);
            else ensure(head.head === previous.head.head && head.previousHead === previous.head.previousHead && head.sequence === previous.head.sequence &&
              reservation.status === 'already-committed' && reservation.winner === false);
          }
          return { head, replay, reservation };
        };
        const opening = readStore(input.openingStoreBytes, 'opening');
        ensure(checkpoint.openingReservationDigest === opening.reservation.recordDigest);
        const terminal = readStore(input.terminalStoreBytes, 'terminal', opening, time(retention.recordedAt));
        const delivery = proof(input.deliveryBytes, 'recovery-provider', 'migration-checkpoint-delivery', ['checkpointDigest', 'terminalReservationDigest', 'outcome']);
        ensure(delivery.source === 'authoritative-migration-checkpoint-transport' && delivery.checkpointDigest === checkpoint.recordDigest && delivery.terminalReservationDigest === terminal.reservation.recordDigest &&
          ['delivered', 'acknowledgment-lost'].includes(delivery.outcome) && time(delivery.recordedAt) >= time(terminal.reservation.recordedAt) && time(delivery.validThrough) <= time(checkpoint.validThrough));
        const readback = readStore(input.currentStoreBytes, 'current', terminal, time(delivery.recordedAt));
        ensure(readback.reservation.reservationId !== opening.reservation.reservationId);
        return { state: 'verified-migration-checkpoint-readback', decision: 'REPLAY_NOOP', executionAuthorized: false, resumeAuthorized: false, factOnly: true,
          effects: zeroEffects(), journalEffects: 0, configDigest, policyDigest, checkpointDigest: checkpoint.recordDigest, chainDigest, chainEvidenceDigest: original.evidenceDigest,
          currentTruthDigest: original.currentTruthDigest, completedStepCount: original.completedStepCount, requiredStepCount: original.requiredStepCount,
          nextStepId: checkpoint.nextStepId, status: checkpoint.status, deliveryOutcome: delivery.outcome, currentReservationDigest: readback.reservation.recordDigest,
          observedAt: input.observedAt, evaluatedAt: evaluationTime };
      } catch { return { state: 'blocked', firstError: 'MIGRATION_CHECKPOINT_INVALID', executionAuthorized: false, resumeAuthorized: false, effects: zeroEffects(), journalEffects: 0 }; }
    },
  });
}
