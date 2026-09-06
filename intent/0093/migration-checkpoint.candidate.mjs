// Offline checkpoint/readback audit only. Never persists, resumes or dispatches.
import { readFileSync } from 'node:fs';
import { exactKeys, hex, jcs, parseCanonical, sha256, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createTimedRecordVerifier } from '../0058/record-verifier.candidate.mjs';
import { exactInstant } from '../0069/exact-time.candidate.mjs';
import { createMigrationChainVerifier, policyDigest as chainPolicyDigest } from '../0092/migration-chain.candidate.mjs';
import { createMigrationChainObservationVerifier, policyDigest as observationPolicyDigest } from '../0094/current-chain.candidate.mjs';
const registryBytes = jcs(JSON.parse(readFileSync(new URL('../0001/reviews/domain/round-3/remediation/TRUST-REGISTRY.candidate.json', import.meta.url), 'utf8')));
const timed = createTimedRecordVerifier(registryBytes);
export const policyDigest = sha256(jcs({ version: 'steer-migration-checkpoint/v1', chainPolicyDigest, registryDigest: timed.registryDigest, timePolicyDigest: timed.timePolicyDigest,
  rules: 'full original/current chain; exact retained bytes; opening winner, committed terminal and current readback; independent delivery outcome; no duplicate effect or resume authority' }));
export const sequencePolicyDigest = sha256(jcs({ version: 'steer-migration-checkpoint-sequence/v1', policyDigest, observationPolicyDigest,
  rules: 'trusted ordered slots; current full proofs; strict immutable attempt extension with a new request after prior readback; exact prior head and reservation; policy-bound sources; no execution or latest-store claim' }));
const ensure = (value) => { if (!value) throw new Error('MIGRATION_CHECKPOINT_INVALID'); };
const text = (value) => typeof value === 'string' && value.length > 0 && value.length <= 512 && value.trim() === value && !/[\u0000-\u001f\u007f*?]/u.test(value);
const bounded = (value, maximum) => typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= maximum;
const time = (value) => { const parsed = exactInstant(value); ensure(parsed !== null); return parsed; };

export function createMigrationCheckpointVerifier(contextBytes) {
  return createSelectedCheckpointVerifier(contextBytes, false, null);
}

// Only this closed composition supplies a predecessor, never a caller's verified flag.
export function createMigrationCheckpointSequenceVerifier(contextBytes) {
  let contexts;
  try {
    ensure(bounded(contextBytes, 8388608)); const context = parseCanonical(contextBytes);
    ensure(exactKeys(context, ['version', 'checkpointContextBytes']) && context.version === 'steer-migration-checkpoint-sequence-context/v1' &&
      Array.isArray(context.checkpointContextBytes) && context.checkpointContextBytes.length > 0 && context.checkpointContextBytes.length <= 16);
    contexts = context.checkpointContextBytes;
    const ids = new Set(), commands = new Set(); let common;
    for (const bytes of contexts) {
      createSelectedCheckpointVerifier(bytes, true, null); const slot = parseCanonical(bytes);
      ensure(!ids.has(slot.checkpointId) && !commands.has(slot.idempotencyKey)); ids.add(slot.checkpointId); commands.add(slot.idempotencyKey);
      const identity = jcs([slot.chainContextBytes, slot.headId, slot.storeId, slot.objectKey]);
      if (common === undefined) common = identity; else ensure(common === identity);
    }
  } catch { throw new Error('MIGRATION_CHECKPOINT_SEQUENCE_CONFIGURATION_INVALID'); }
  const configDigest = sha256(contextBytes);
  return Object.freeze({ configDigest, policyDigest: sequencePolicyDigest, observationPolicyDigest,
    verify(serialized, evaluationTime) {
      try {
        time(evaluationTime); ensure(bounded(serialized, 134217728)); const input = parseCanonical(serialized);
        ensure(exactKeys(input, ['version', 'configDigest', 'policyDigest', 'checkpoints']) && input.version === 'steer-migration-checkpoint-sequence/v1' &&
          input.configDigest === configDigest && input.policyDigest === sequencePolicyDigest && Array.isArray(input.checkpoints) && input.checkpoints.length === contexts.length);
        let previous, latest; const reservations = new Set(), terminalHeads = new Set(), versions = new Set();
        for (const [index, bytes] of input.checkpoints.entries()) {
          const result = createSelectedCheckpointVerifier(contexts[index], true, previous).verify(bytes, evaluationTime);
          ensure(result.state === 'verified-migration-checkpoint-readback'); const internal = result.sequenceEvidence;
          for (const id of internal.reservationIds) { ensure(!reservations.has(id)); reservations.add(id); }
          terminalHeads.add(internal.openingHead);
          ensure(!terminalHeads.has(internal.readback.head.head) && !versions.has(internal.objectVersion));
          terminalHeads.add(internal.readback.head.head); versions.add(internal.objectVersion);
          previous = { ...internal, bytes, result }; latest = result;
        }
        const { sequenceEvidence, ...publicResult } = latest;
        return { ...publicResult, state: 'verified-migration-checkpoint-sequence', configDigest, policyDigest: sequencePolicyDigest,
          checkpointCount: contexts.length, sequenceDigest: sha256(serialized), latestStoreHeadVerified: false };
      } catch { return { state: 'blocked', firstError: 'MIGRATION_CHECKPOINT_SEQUENCE_INVALID', executionAuthorized: false, resumeAuthorized: false, effects: zeroEffects(), journalEffects: 0 }; }
    },
  });
}

function createSelectedCheckpointVerifier(contextBytes, sequence, previous) {
  const selectedPolicyDigest = sequence ? sequencePolicyDigest : policyDigest;
  let context, chain, chainContext;
  try {
    ensure(bounded(contextBytes, 1048576)); context = parseCanonical(contextBytes);
    ensure(exactKeys(context, ['version', 'chainContextBytes', 'checkpointId', 'idempotencyKey', 'headId', 'storeId', 'objectKey']) &&
      context.version === (sequence ? 'steer-migration-checkpoint-context/v2' : 'steer-migration-checkpoint-context/v1') && ['checkpointId', 'idempotencyKey', 'headId', 'storeId', 'objectKey'].every((key) => text(context[key])) &&
      !context.objectKey.startsWith('/') && !context.objectKey.includes('\\') && context.objectKey.split('/').every((part) => part !== '' && part !== '.' && part !== '..'));
    chain = (sequence ? createMigrationChainObservationVerifier : createMigrationChainVerifier)(context.chainContextBytes); chainContext = parseCanonical(context.chainContextBytes);
  } catch { throw new Error('MIGRATION_CHECKPOINT_CONFIGURATION_INVALID'); }
  const configDigest = sha256(contextBytes);
  return Object.freeze({ configDigest, policyDigest: selectedPolicyDigest,
    verify(serialized, evaluationTime) {
      try {
        const now = time(evaluationTime); ensure(bounded(serialized, 67108864)); const input = parseCanonical(serialized);
        ensure(exactKeys(input, ['version', 'configDigest', 'policyDigest', 'chainBytes', 'observedAt', 'openingStoreBytes', 'checkpointBytes', 'retentionBytes', 'terminalStoreBytes', 'deliveryBytes', 'currentStoreBytes']) &&
          input.version === (sequence ? 'steer-migration-checkpoint/v2' : 'steer-migration-checkpoint/v1') && input.configDigest === configDigest && input.policyDigest === selectedPolicyDigest && time(input.observedAt) <= now);
        const original = chain.verify(input.chainBytes, input.observedAt);
        ensure(['verified-migration-chain', 'verified-migration-chain-pending'].includes(original.state));
        // Only the unsigned audit-clock scalar changes in this ephemeral view.
        // Preserve original bytes for all pins; every signed record is unchanged.
        const originalChain = parseCanonical(input.chainBytes), view = { ...originalChain, attempts: originalChain.attempts.map((attempt) => {
          const compatibility = parseCanonical(attempt.compatibilityBytes), graph = parseCanonical(compatibility.graphBytes);
          if (!sequence && graph.cleanupBundleBytes !== '') {
            const bundle = parseCanonical(graph.cleanupBundleBytes); ensure(bundle.evaluationTime === input.observedAt);
            graph.cleanupBundleBytes = jcs({ ...bundle, evaluationTime });
          }
          return { ...attempt, compatibilityBytes: jcs({ ...compatibility, graphBytes: jcs(graph) }) };
        }) };
        const current = chain.verify(sequence ? input.chainBytes : jcs(view), evaluationTime);
        ensure(['state', 'completedStepCount', 'requiredStepCount', 'attemptCount', 'replayCount', 'currentTruthDigest'].every((field) => current[field] === original[field]));
        if (previous) {
          ensure(previous.result.status === 'pending' && time(input.observedAt) >= time(previous.readback.reservation.recordedAt));
          const prior = parseCanonical(parseCanonical(previous.bytes).chainBytes).attempts, attempts = originalChain.attempts;
          ensure(attempts.length > prior.length && prior.every((attempt, index) => jcs(attempt) === jcs(attempts[index])));
          const requestOf = (attempt) => parseCanonical(parseCanonical(parseCanonical(attempt.compatibilityBytes).graphBytes).actionBundleBytes).requestBytes;
          const known = new Set(prior.map(requestOf)); let fresh = 0;
          for (const attempt of attempts.slice(prior.length)) {
            const request = requestOf(attempt);
            if (!known.has(request)) {
              const graph = parseCanonical(parseCanonical(attempt.compatibilityBytes).graphBytes);
              ensure(time(parseCanonical(graph.beforeProofBytes).recordedAt) >= time(previous.readback.reservation.recordedAt));
              known.add(request); fresh++;
            }
          }
          ensure(fresh > 0);
        }
        const predecessorDigest = previous ? sha256(jcs({ checkpointBytes: previous.bytes, checkpointDigest: previous.result.checkpointDigest,
          headDigest: previous.readback.head.recordDigest, reservationDigest: previous.readback.reservation.recordDigest })) : null;
        const binding = sequence ? { observationPolicyDigest, predecessorDigest } : {};
        const chainDigest = sha256(input.chainBytes), requestDigest = sha256(jcs({ configDigest, policyDigest: selectedPolicyDigest, chainDigest, observedAt: input.observedAt, ...binding }));
        const proof = (bytes, domain, kind, fields) => {
          ensure(bounded(bytes, 65536)); const raw = parseCanonical(bytes);
          const record = timed.verifyBytes(bytes, { domain, recordedAt: raw.recordedAt, evaluatedAt: evaluationTime }).record;
          ensure(exactKeys(record, ['kind', 'source', 'configDigest', 'requestDigest', 'recordedAt', 'validThrough', ...Object.keys(binding), ...fields, 'recordDigest', 'signature']) &&
            Object.entries(binding).every(([key, value]) => record[key] === value) &&
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
          if (phase === 'opening') {
            ensure(replay.status === 'unused' && replay.resultDigest === null && reservation.status === 'reserved' && reservation.winner === true && time(reservation.recordedAt) < time(checkpoint.recordedAt));
            if (sequence && previousCheckpoint) ensure(['head', 'previousHead', 'sequence', 'checkpointDigest', 'retentionDigest'].every((key) => head[key] === previousCheckpoint.readback.head[key]) &&
              reservation.previousReservationDigest === previousCheckpoint.readback.reservation.recordDigest);
            else ensure(head.checkpointDigest === null && head.retentionDigest === null && reservation.previousReservationDigest === null);
          }
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
        const previousCheckpoint = previous;
        const opening = readStore(input.openingStoreBytes, 'opening');
        ensure(checkpoint.openingReservationDigest === opening.reservation.recordDigest);
        const terminal = readStore(input.terminalStoreBytes, 'terminal', opening, time(retention.recordedAt));
        const delivery = proof(input.deliveryBytes, 'recovery-provider', 'migration-checkpoint-delivery', ['checkpointDigest', 'terminalReservationDigest', 'outcome']);
        ensure(delivery.source === 'authoritative-migration-checkpoint-transport' && delivery.checkpointDigest === checkpoint.recordDigest && delivery.terminalReservationDigest === terminal.reservation.recordDigest &&
          ['delivered', 'acknowledgment-lost'].includes(delivery.outcome) && time(delivery.recordedAt) >= time(terminal.reservation.recordedAt) && time(delivery.validThrough) <= time(checkpoint.validThrough));
        const readback = readStore(input.currentStoreBytes, 'current', terminal, time(delivery.recordedAt));
        ensure(readback.reservation.reservationId !== opening.reservation.reservationId);
        return { state: 'verified-migration-checkpoint-readback', decision: 'REPLAY_NOOP', executionAuthorized: false, resumeAuthorized: false, factOnly: true,
          effects: zeroEffects(), journalEffects: 0, configDigest, policyDigest: selectedPolicyDigest, checkpointDigest: checkpoint.recordDigest, chainDigest, chainEvidenceDigest: original.evidenceDigest,
          currentTruthDigest: original.currentTruthDigest, completedStepCount: original.completedStepCount, requiredStepCount: original.requiredStepCount,
          nextStepId: checkpoint.nextStepId, status: checkpoint.status, deliveryOutcome: delivery.outcome, currentReservationDigest: readback.reservation.recordDigest,
          observedAt: input.observedAt, evaluatedAt: evaluationTime,
          ...(sequence ? { observationPolicyDigest, originalObservationVerified: false, sequenceEvidence: { readback, openingHead: opening.head.head, objectVersion: retention.objectVersion,
            reservationIds: [opening, terminal, readback].map((store) => store.reservation.reservationId) } } : {}) };
      } catch { return { state: 'blocked', firstError: 'MIGRATION_CHECKPOINT_INVALID', executionAuthorized: false, resumeAuthorized: false, effects: zeroEffects(), journalEffects: 0 }; }
    },
  });
}
