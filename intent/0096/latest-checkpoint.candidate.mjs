// Offline latest-head evidence verification. Never queries a provider or resumes work.
import { readFileSync } from 'node:fs';
import { exactKeys, hex, jcs, parseCanonical, sha256, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createTimedRecordVerifier } from '../0058/record-verifier.candidate.mjs';
import { exactInstant } from '../0069/exact-time.candidate.mjs';
import { createMigrationCheckpointSequenceVerifier, policyDigest as sequencePolicyDigest } from '../0095/checkpoint-sequence.candidate.mjs';
const registryBytes = jcs(JSON.parse(readFileSync(new URL('../0001/reviews/domain/round-3/remediation/TRUST-REGISTRY.candidate.json', import.meta.url), 'utf8')));
const timed = createTimedRecordVerifier(registryBytes);
export const policyDigest = sha256(jcs({ version: 'steer-latest-migration-checkpoint/v1', sequencePolicyDigest, registryDigest: timed.registryDigest, timePolicyDigest: timed.timePolicyDigest,
  rules: 'trusted fresh query; full current sequence; canonical head then exact object then unchanged head confirmation; independent observation seal; no live query or resume authority' }));
const ensure = (value) => { if (!value) throw new Error('LATEST_MIGRATION_CHECKPOINT_INVALID'); };
const text = (value) => typeof value === 'string' && value.length > 0 && value.length <= 512 && value.trim() === value && !/[\u0000-\u001f\u007f*?]/u.test(value);
const bounded = (value, maximum) => typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= maximum;
const time = (value) => { const parsed = exactInstant(value); ensure(parsed !== null); return parsed; };
const headFields = ['headId', 'head', 'previousHead', 'sequence', 'checkpointDigest', 'retentionDigest', 'status'];

export function createLatestMigrationCheckpointVerifier(contextBytes) {
  let context, sequence, scope;
  try {
    ensure(bounded(contextBytes, 16777216)); context = parseCanonical(contextBytes);
    ensure(exactKeys(context, ['version', 'sequenceContextBytes', 'queryId', 'nonce', 'requestedAt']) && context.version === 'steer-latest-migration-checkpoint-context/v1' &&
      text(context.queryId) && hex(context.nonce, 64)); time(context.requestedAt);
    sequence = createMigrationCheckpointSequenceVerifier(context.sequenceContextBytes);
    const inventory = parseCanonical(context.sequenceContextBytes), slot = parseCanonical(inventory.checkpointContextBytes[0]);
    scope = { chainConfigDigest: sha256(slot.chainContextBytes), headId: slot.headId, storeId: slot.storeId, objectKey: slot.objectKey, mode: 'latest-canonical-head' };
  } catch { throw new Error('LATEST_MIGRATION_CHECKPOINT_CONFIGURATION_INVALID'); }
  const configDigest = sha256(contextBytes), queryDigest = sha256(jcs({ configDigest, policyDigest }));
  return Object.freeze({ configDigest, policyDigest,
    verify(serialized, evaluationTime) {
      try {
        const now = time(evaluationTime), requested = time(context.requestedAt);
        ensure(requested <= now && now - requested <= 300000000000n && bounded(serialized, 201326592)); const input = parseCanonical(serialized);
        ensure(exactKeys(input, ['version', 'configDigest', 'policyDigest', 'sequenceBytes', 'retainedChainBytes', 'requestBytes', 'headBytes', 'objectBytes', 'confirmationBytes', 'auditBytes']) &&
          input.version === 'steer-latest-migration-checkpoint/v1' && input.configDigest === configDigest && input.policyDigest === policyDigest);
        const verified = sequence.verify(input.sequenceBytes, evaluationTime);
        ensure(verified.state === 'verified-migration-checkpoint-sequence');
        // Parse only after full verification; these are never caller-supplied verdicts.
        const tail = parseCanonical(parseCanonical(input.sequenceBytes).checkpoints.at(-1)), store = parseCanonical(tail.currentStoreBytes);
        const retained = parseCanonical(tail.retentionBytes), priorHead = parseCanonical(store.headBytes), priorReservation = parseCanonical(store.reservationBytes);
        ensure(requested >= time(priorReservation.recordedAt) && bounded(input.retainedChainBytes, 33554432) && input.retainedChainBytes === tail.chainBytes);
        const proof = (bytes, domain, kind, source, fields) => {
          ensure(bounded(bytes, 65536)); const raw = parseCanonical(bytes);
          const record = timed.verifyBytes(bytes, { domain, recordedAt: raw.recordedAt, evaluatedAt: evaluationTime }).record;
          ensure(exactKeys(record, ['kind', 'source', 'configDigest', 'queryDigest', 'queryId', 'nonce', 'recordedAt', 'validThrough', ...fields, 'recordDigest', 'signature']) &&
            record.kind === kind && record.source === source && record.configDigest === configDigest && record.queryDigest === queryDigest &&
            record.queryId === context.queryId && record.nonce === context.nonce && time(record.recordedAt) >= requested && time(record.recordedAt) < time(record.validThrough) &&
            now < time(record.validThrough) && time(record.validThrough) - time(record.recordedAt) <= 300000000000n);
          return record;
        };
        const request = proof(input.requestBytes, 'record', 'migration-checkpoint-query', 'authoritative-migration-checkpoint-query', Object.keys(scope));
        ensure(request.recordedAt === context.requestedAt && Object.entries(scope).every(([key, value]) => request[key] === value));
        const head = proof(input.headBytes, 'cas-authority', 'migration-checkpoint-latest-head', 'authoritative-migration-checkpoint-cas', ['requestRecordDigest', ...headFields]);
        ensure(head.requestRecordDigest === request.recordDigest && head.status === 'committed' && head.headId === scope.headId &&
          headFields.filter((field) => field !== 'status').every((field) => head[field] === priorHead[field]));
        const object = proof(input.objectBytes, 'provider', 'migration-checkpoint-object-read', 'authoritative-migration-checkpoint-storage',
          ['requestRecordDigest', 'headRecordDigest', 'storeId', 'objectKey', 'objectVersion', 'checkpointDigest', 'retentionDigest', 'retainedBytesDigest', 'complete']);
        ensure(object.requestRecordDigest === request.recordDigest && object.headRecordDigest === head.recordDigest && object.storeId === scope.storeId && object.objectKey === scope.objectKey &&
          object.objectVersion === retained.objectVersion && object.checkpointDigest === head.checkpointDigest && object.retentionDigest === head.retentionDigest &&
          object.retainedBytesDigest === sha256(input.retainedChainBytes) && object.retainedBytesDigest === retained.retainedBytesDigest && object.complete === true &&
          time(object.recordedAt) >= time(head.recordedAt));
        const confirmation = proof(input.confirmationBytes, 'cas-authority', 'migration-checkpoint-head-confirmation', 'authoritative-migration-checkpoint-cas',
          ['requestRecordDigest', 'headRecordDigest', 'objectRecordDigest', ...headFields]);
        ensure(confirmation.requestRecordDigest === request.recordDigest && confirmation.headRecordDigest === head.recordDigest && confirmation.objectRecordDigest === object.recordDigest &&
          headFields.every((field) => confirmation[field] === head[field]) && time(confirmation.recordedAt) >= time(object.recordedAt));
        const audit = proof(input.auditBytes, 'verifier', 'migration-checkpoint-latest-audit', 'independent-migration-checkpoint-observer',
          ['requestRecordDigest', 'headRecordDigest', 'objectRecordDigest', 'confirmationDigest', 'outcome']);
        ensure(audit.requestRecordDigest === request.recordDigest && audit.headRecordDigest === head.recordDigest && audit.objectRecordDigest === object.recordDigest &&
          audit.confirmationDigest === confirmation.recordDigest && audit.outcome === 'verified' && time(audit.recordedAt) >= time(confirmation.recordedAt));
        for (const record of [head, object, confirmation, audit]) ensure(time(record.validThrough) <= time(request.validThrough));
        return { state: 'verified-latest-migration-checkpoint-evidence', decision: 'REPLAY_NOOP', factOnly: true, executionAuthorized: false, resumeAuthorized: false,
          effects: zeroEffects(), journalEffects: 0, configDigest, policyDigest, sequenceDigest: verified.sequenceDigest, checkpointDigest: verified.checkpointDigest,
          chainDigest: verified.chainDigest, currentTruthDigest: verified.currentTruthDigest, completedStepCount: verified.completedStepCount,
          requiredStepCount: verified.requiredStepCount, nextStepId: verified.nextStepId, status: verified.status, checkpointCount: verified.checkpointCount,
          queryId: context.queryId, headObservationVerified: true, liveStoreQueried: false, observedAt: confirmation.recordedAt, evaluatedAt: evaluationTime,
          evidenceDigest: sha256(jcs([request, head, object, confirmation, audit].map((record) => record.recordDigest))) };
      } catch { return { state: 'blocked', firstError: 'LATEST_MIGRATION_CHECKPOINT_INVALID', executionAuthorized: false, resumeAuthorized: false, effects: zeroEffects(), journalEffects: 0 }; }
    },
  });
}
