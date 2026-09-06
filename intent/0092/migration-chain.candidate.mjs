// Offline ordered evidence composition. No migration dispatch or durable chain CAS.
import { exactKeys, hex, jcs, parseCanonical, sha256, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { exactInstant } from '../0069/exact-time.candidate.mjs';
import { createStagedMigrationCompatibilityVerifier, stagedPolicyDigest } from '../0091/migration-compatibility.candidate.mjs';
export const policyDigest = sha256(jcs({ version: 'steer-migration-chain/v1', stagedPolicyDigest,
  rules: 'approved ordered expand/backfill/contract inventory; exact predecessor truth, full proof/model per attempt; complete disjoint backfill; unique first identities; byte-bound replay; pending is not completed' }));
const ensure = (value) => { if (!value) throw new Error('MIGRATION_CHAIN_INVALID'); };
const text = (value) => typeof value === 'string' && value.length > 0 && value.length <= 512 && value.trim() === value && !/[\u0000-\u001f\u007f*?]/u.test(value);
const bounded = (value, maximum) => typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= maximum;
const time = (value) => { const result = exactInstant(value); ensure(result !== null); return result; };
export function createMigrationChainVerifier(contextBytes) {
  let context, selected;
  try {
    ensure(bounded(contextBytes, 524288)); context = parseCanonical(contextBytes);
    ensure(exactKeys(context, ['version', 'chainId', 'initialTruthDigest', 'finalTruthDigest', 'steps']) && context.version === 'steer-migration-chain-context/v1' &&
      text(context.chainId) && hex(context.initialTruthDigest, 64) && hex(context.finalTruthDigest, 64) && Array.isArray(context.steps) && context.steps.length >= 3 && context.steps.length <= 16);
    const ids = new Set(), coordinates = new Set(); let common;
    selected = context.steps.map((step, index) => {
      ensure(exactKeys(step, ['stepId', 'phase', 'batch', 'checkpoint', 'compatibilityContextBytes']) && ['stepId', 'batch', 'checkpoint'].every((key) => text(step[key])) &&
        step.phase === (index === 0 ? 'expand' : index === context.steps.length - 1 ? 'contract' : 'backfill') && !ids.has(step.stepId)); ids.add(step.stepId);
      const coordinate = jcs([step.batch, step.checkpoint]); ensure(!coordinates.has(coordinate)); coordinates.add(coordinate);
      const verifier = createStagedMigrationCompatibilityVerifier(step.compatibilityContextBytes), compatibility = parseCanonical(step.compatibilityContextBytes);
      const migration = parseCanonical(compatibility.migrationConfigBytes);
      const identity = jcs({ sourceColumn: compatibility.sourceColumn, targetColumn: compatibility.targetColumn,
        config: Object.fromEntries(Object.entries(migration).filter(([key]) => !['approvedDefinitionDigest', 'approvedBeforeTruthDigest'].includes(key))) });
      if (common === undefined) common = identity; else ensure(identity === common);
      return { ...step, verifier };
    });
  } catch { throw new Error('MIGRATION_CHAIN_CONFIGURATION_INVALID'); }
  const configDigest = sha256(contextBytes);
  return Object.freeze({ configDigest, policyDigest,
    verify(serialized, evaluationTime) {
      try {
        time(evaluationTime); ensure(bounded(serialized, 33554432)); const envelope = parseCanonical(serialized);
        ensure(exactKeys(envelope, ['version', 'configDigest', 'policyDigest', 'attempts']) && envelope.version === 'steer-migration-chain/v1' && envelope.configDigest === configDigest &&
          envelope.policyDigest === policyDigest && Array.isArray(envelope.attempts) && envelope.attempts.length > 0 && envelope.attempts.length <= 64);
        let next = 0, currentTruth, originalRows, lastResultAt = null, lastObservedAt = null, family, replayCount = 0;
        const observations = [], requests = new Map(), identities = new Map(), definitions = new Map(), filledRows = new Set();
        const claim = (kind, value, requestDigest) => { ensure(text(value)); const identity = jcs([kind, value]);
          ensure(!identities.has(identity) || identities.get(identity) === requestDigest); identities.set(identity, requestDigest); return identity; };
        for (const attempt of envelope.attempts) {
          ensure(exactKeys(attempt, ['stepId', 'compatibilityBytes']) && text(attempt.stepId));
          const index = selected.findIndex((step) => step.stepId === attempt.stepId);
          ensure(index >= 0 && (index === next || index === next - 1)); const step = selected[index];
          const verified = step.verifier.verify(attempt.compatibilityBytes, evaluationTime);
          ensure(verified.state === 'verified-migration-model-compatibility');
          const compatibility = parseCanonical(attempt.compatibilityBytes), graph = parseCanonical(compatibility.graphBytes), plan = parseCanonical(graph.planBytes), definition = plan.definition;
          ensure(['phase', 'batch', 'checkpoint'].every((field) => definition[field] === step[field]));
          const appFamily = jcs([definition.oldAppVersion, definition.newAppVersion]); if (family === undefined) family = appFamily; else ensure(family === appFamily);
          for (const field of ['executionId', 'planId']) {
            const key = jcs([field, definition[field]]); ensure(!definitions.has(key) || definitions.get(key) === step.stepId); definitions.set(key, step.stepId);
          }
          const action = parseCanonical(graph.actionBundleBytes), request = parseCanonical(action.requestBytes), replay = parseCanonical(action.replayBytes), head = parseCanonical(action.headBytes), reservation = parseCanonical(action.reservationBytes);
          const post = parseCanonical(graph.afterProofBytes), result = parseCanonical(graph.resultBytes);
          const immutableDigest = sha256(jcs(Object.fromEntries(Object.entries(graph).filter(([field]) => field !== 'actionBundleBytes'))));
          const observedAt = [result.recordedAt, replay.recordedAt, reservation.recordedAt].map(time).reduce((left, right) => left > right ? left : right);
          ensure(lastObservedAt === null || observedAt >= lastObservedAt); lastObservedAt = observedAt;
          const localClaims = new Set();
          for (const [kind, value] of [['request', request.operation.requestId], ['idempotency', request.operation.idempotencyKey], ['reservation', reservation.reservationId],
            ['head', jcs([head.headId, head.head])], ['credential', parseCanonical(action.upstreamBytes).credentialId], ['credential', parseCanonical(action.downstreamBytes).credentialId], ['transaction', post.transactionId]]) {
            const identity = claim(kind, value, request.recordDigest); ensure(!localClaims.has(identity)); localClaims.add(identity);
          }
          if (requests.has(request.recordDigest)) {
            const prior = requests.get(request.recordDigest);
            ensure(prior.stepId === step.stepId && prior.immutableDigest === immutableDigest && prior.requestBytes === action.requestBytes && replay.status === 'committed' &&
              replay.resultDigest === result.recordDigest && prior.resultDigest === result.recordDigest);
            replayCount++;
          } else {
            ensure(index === next);
            if (currentTruth === undefined) {
              ensure(sha256(graph.beforeTruthBytes) === context.initialTruthDigest); currentTruth = graph.beforeTruthBytes;
              originalRows = parseCanonical(parseCanonical(currentTruth).dataBytes).rows.map((row) => row.rowId);
            }
            ensure(graph.beforeTruthBytes === currentTruth && (lastResultAt === null || time(parseCanonical(graph.beforeProofBytes).recordedAt) >= lastResultAt));
            requests.set(request.recordDigest, { stepId: step.stepId, immutableDigest, requestBytes: action.requestBytes, resultDigest: result.recordDigest });
            if (definition.phase === 'contract') ensure(jcs([...filledRows].sort()) === jcs(originalRows));
            if (post.status === 'committed') {
              if (definition.phase === 'backfill') for (const rowId of definition.batchRowIds) { ensure(!filledRows.has(rowId)); filledRows.add(rowId); }
              currentTruth = graph.afterTruthBytes; next++;
            } else ensure(['refused', 'rolled-back'].includes(post.status) && graph.afterTruthBytes === currentTruth);
            lastResultAt = time(result.recordedAt);
          }
          observations.push({ stepId: step.stepId, graphDigest: verified.graphDigest, traceDigest: verified.traceDigest, resultDigest: result.recordDigest, observedAt: observedAt.toString() });
        }
        const complete = next === selected.length;
        if (complete) ensure(sha256(currentTruth) === context.finalTruthDigest);
        return { state: complete ? 'verified-migration-chain' : 'verified-migration-chain-pending', firstError: null, executionAuthorized: false, factOnly: true,
          effects: zeroEffects(), journalEffects: 0, configDigest, policyDigest, completedStepCount: next, requiredStepCount: selected.length,
          attemptCount: envelope.attempts.length, replayCount, currentTruthDigest: sha256(currentTruth), evidenceDigest: sha256(jcs(observations)), liveCompatibilityVerified: false };
      } catch { return { state: 'blocked', firstError: 'MIGRATION_CHAIN_INVALID', executionAuthorized: false, effects: zeroEffects(), journalEffects: 0 }; }
    },
  });
}
