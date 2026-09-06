// Offline completion audit only. No store access, mutation or execution route.
import { readFileSync } from 'node:fs';
import { exactKeys, jcs, parseCanonical, sha256, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createTimedRecordVerifier } from '../0058/record-verifier.candidate.mjs';
import { createLifecycleGraphVerifier, policyDigest as lifecyclePolicy } from '../0061/lifecycle-graph.candidate.mjs';
import { exactInstant, timePolicyDigest } from '../0069/exact-time.candidate.mjs';
const registry = jcs(JSON.parse(readFileSync(new URL('../0001/reviews/domain/round-3/remediation/TRUST-REGISTRY.candidate.json', import.meta.url), 'utf8')));
const timed = createTimedRecordVerifier(registry);
export const policyDigest = sha256(jcs({ version: 'steer-raw-terminal/v1', lifecyclePolicy, timePolicyDigest, registryDigest: timed.registryDigest,
  rules: 'full original raw-v4 graph at observed time and current time; only unsigned human audit-clock scalars rebound in an ephemeral view; exact original graph seal; independent terminal and current committed store proofs; no new effects or archival exception' }));
const ensure = (value) => { if (!value) throw new Error('RAW_TERMINAL_INVALID'); };
const time = (value) => { const parsed = exactInstant(value); ensure(parsed !== null); return parsed; };
const bytes = (value, limit) => typeof value === 'string' && value.length > 0 && value.length <= limit;

// Config is selected by the trusted caller, not taken from the evidence envelope.
export function createRawTerminalVerifier(configBytes) {
  const lifecycle = createLifecycleGraphVerifier(configBytes), configDigest = sha256(configBytes);
  ensure(parseCanonical(configBytes).recordClass === 'RC-CORPUS-RAW-WORKING');
  return Object.freeze({ policyDigest,
    verify(serialized, evaluationTime) {
      const blocked = () => ({ state: 'blocked', firstError: 'RAW_TERMINAL_INVALID', effects: zeroEffects(), executionAuthorized: false });
      try {
        const now = time(evaluationTime);
        ensure(bytes(serialized, 25165824)); const input = parseCanonical(serialized);
        ensure(exactKeys(input, ['version', 'policyDigest', 'graphBytes', 'observedAt', 'completionBytes', 'terminalStoreBytes', 'currentStoreBytes']) &&
          input.version === 'steer-raw-terminal/v1' && input.policyDigest === policyDigest && bytes(input.graphBytes, 16777216) && time(input.observedAt) <= now);
        const original = lifecycle.verify(input.graphBytes, input.observedAt);
        ensure(original.state === 'validated-lifecycle-candidate');
        const graph = parseCanonical(input.graphBytes); ensure(graph.version === 'steer-lifecycle-graph/raw-v4');
        // evaluationTime is an unsigned verifier input, not part of any signed
        // approval/request. Preserve every signed *Bytes string. Never persist
        // this view or use its digest as the sealed original graph digest.
        const refreshHumanClock = (serializedBundle) => {
          const bundle = parseCanonical(serializedBundle);
          ensure(bundle.evaluationTime === input.observedAt);
          return jcs({ ...bundle, evaluationTime });
        };
        const rawPolicy = parseCanonical(graph.rawPolicyBytes);
        const view = { ...graph, rawPolicyBytes: jcs({ ...rawPolicy, humanBundleBytes: refreshHumanClock(rawPolicy.humanBundleBytes) }),
          tombstone: { ...graph.tombstone, humanBundleBytes: refreshHumanClock(graph.tombstone.humanBundleBytes) } };
        const current = lifecycle.verify(jcs(view), evaluationTime);
        ensure(current.state === 'validated-lifecycle-candidate' && current.evidenceDigest === original.evidenceDigest);
        const batch = parseCanonical(graph.rawBatchBytes), priorHead = parseCanonical(batch.headBytes), priorReservation = parseCanonical(batch.reservationBytes);
        const usedHeads = new Set([parseCanonical(parseCanonical(batch.openingBytes).headBytes).head,
          ...parseCanonical(graph.continuationBytes).steps.map((step) => parseCanonical(parseCanonical(step.batchBytes).headBytes).head)]);
        const aggregate = parseCanonical(graph.aggregateBytes), tombstone = parseCanonical(graph.tombstone.receiptBytes);
        const proof = (serializedRecord, domain, fields) => {
          ensure(bytes(serializedRecord, 65536)); const raw = parseCanonical(serializedRecord);
          const value = timed.verifyBytes(serializedRecord, { domain, recordedAt: raw.recordedAt, evaluatedAt: evaluationTime }).record;
          ensure(exactKeys(value, ['kind', 'source', 'configDigest', ...fields, 'recordedAt', 'validThrough', 'recordDigest', 'signature']) && value.configDigest === configDigest &&
            now < time(value.validThrough) && time(value.recordedAt) < time(value.validThrough) &&
            now - time(value.recordedAt) <= 300000000000n && time(value.validThrough) - time(value.recordedAt) <= 300000000000n);
          return value;
        };
        const completion = proof(input.completionBytes, 'authority', ['policyDigest', 'observedAt', 'graphDigest', 'evidenceDigest', 'consumptionKey', 'grantDigest',
          'planDigest', 'checkpointChainDigest', 'aggregateDigest', 'tombstoneReceiptDigest', 'previousReservationDigest']);
        ensure(completion.kind === 'raw-terminal-completion' && completion.source === 'authoritative-raw-terminal-store' && completion.policyDigest === policyDigest &&
          completion.observedAt === input.observedAt && completion.graphDigest === sha256(input.graphBytes) && completion.evidenceDigest === original.evidenceDigest &&
          completion.consumptionKey === priorReservation.consumptionKey && completion.grantDigest === original.rawGrantDigest &&
          completion.planDigest === original.rawBatchPlanDigest && completion.checkpointChainDigest === original.rawCheckpointChainDigest &&
          completion.aggregateDigest === aggregate.recordDigest && completion.tombstoneReceiptDigest === tombstone.recordDigest &&
          completion.previousReservationDigest === priorReservation.recordDigest && time(completion.recordedAt) >= time(input.observedAt) &&
          time(completion.recordedAt) > time(tombstone.recordedAt));
        const readStore = (serializedStore, initial, terminal = null) => {
          ensure(bytes(serializedStore, 262144)); const store = parseCanonical(serializedStore);
          ensure(exactKeys(store, ['headBytes', 'replayBytes', 'reservationBytes']));
          const head = proof(store.headBytes, 'cas-authority', ['completionDigest', 'consumptionKey', 'headId', 'head', 'previousHead', 'sequence']);
          const replay = proof(store.replayBytes, 'replay-authority', ['completionDigest', 'consumptionKey', 'headDigest', 'status', 'resultDigest']);
          const reservation = proof(store.reservationBytes, 'cas-authority', ['completionDigest', 'consumptionKey', 'headDigest', 'replayDigest', 'previousReservationDigest', 'status', 'winner']);
          ensure(head.kind === 'raw-terminal-head' && replay.kind === 'raw-terminal-replay' && reservation.kind === 'raw-terminal-reservation');
          for (const record of [head, replay, reservation]) ensure(record.source === 'authoritative-raw-terminal-store' && record.completionDigest === completion.recordDigest &&
            record.consumptionKey === completion.consumptionKey && time(record.recordedAt) >= time(completion.recordedAt) && time(record.validThrough) <= time(completion.validThrough));
          ensure(head.headId === priorHead.headId && /^[0-9a-f]{64}$/.test(head.head) && !usedHeads.has(head.head) &&
            head.previousHead === priorHead.head && Number.isSafeInteger(head.sequence) && head.sequence === priorHead.sequence + 1 &&
            replay.headDigest === head.recordDigest && replay.status === 'committed' && replay.resultDigest === completion.recordDigest && time(replay.recordedAt) >= time(head.recordedAt) &&
            reservation.headDigest === head.recordDigest && reservation.replayDigest === replay.recordDigest &&
            time(reservation.recordedAt) >= time(head.recordedAt) && time(reservation.recordedAt) >= time(replay.recordedAt) &&
            time(reservation.validThrough) <= time(head.validThrough) && time(reservation.validThrough) <= time(replay.validThrough));
          if (initial) ensure(reservation.previousReservationDigest === priorReservation.recordDigest && reservation.status === 'committed' && reservation.winner === true);
          else ensure(reservation.previousReservationDigest === terminal.reservation.recordDigest && reservation.status === 'already-committed' && reservation.winner === false &&
            head.head === terminal.head.head && head.sequence === terminal.head.sequence &&
            [head, replay, reservation].every((record) => time(record.recordedAt) >= time(terminal.reservation.recordedAt)));
          return { head, replay, reservation };
        };
        const terminal = readStore(input.terminalStoreBytes, true);
        const replay = readStore(input.currentStoreBytes, false, terminal);
        return { state: 'verified-terminal-replay', decision: 'REPLAY_NOOP', completionDigest: completion.recordDigest,
          originalGraphDigest: completion.graphDigest, evidenceDigest: completion.evidenceDigest, consumptionKey: completion.consumptionKey,
          terminalReservationDigest: terminal.reservation.recordDigest, currentReservationDigest: replay.reservation.recordDigest,
          observedAt: input.observedAt, evaluatedAt: evaluationTime, effects: zeroEffects(), executionAuthorized: false };
      } catch { return blocked(); }
    },
  });
}
