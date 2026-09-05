// One offline continuation checkpoint. No durable store or erasure executor.
import { readFileSync } from 'node:fs';
import { exactKeys, hex, jcs, parseCanonical, sha256, RETENTION_POLICY_SHA, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createTimedRecordVerifier } from '../0058/record-verifier.candidate.mjs';
import { correctedLifecycleEventDecision, correctionPolicyDigest as eventPolicy } from '../0059/lifecycle-events.candidate.mjs';
import { exactInstant, timePolicyDigest } from '../0069/exact-time.candidate.mjs';
const registryBytes = jcs(JSON.parse(readFileSync(new URL('../0001/reviews/domain/round-3/remediation/TRUST-REGISTRY.candidate.json', import.meta.url), 'utf8')));
const timed = createTimedRecordVerifier(registryBytes);
export const policyDigest = sha256(jcs({ version: 'steer-raw-checkpoint/v1', registryDigest: timed.registryDigest, eventPolicy, timePolicyDigest,
  rules: 'single checkpoint after original opening; immutable original requests and receipts; complete fresh remaining inventory and extending history; clear current holds/references; no execution', maxCopies: 32 }));
const ensure = (value) => { if (!value) throw new Error('RAW_CHECKPOINT_INVALID'); };
const time = (value) => { const result = exactInstant(value); ensure(result !== null); return result; };
const same = (a, b) => jcs(a) === jcs(b);
const text = (value) => typeof value === 'string' && value.length > 0 && value.length <= 512 && value.trim() === value && !/[\u0000-\u001f\u007f*?]/u.test(value);

// Context is assembled by 0061. Its original plan/opening pins must ALSO pass
// 0074 before 0061 may return success; this helper alone grants no authority.
export function verifyRawCheckpointEvidence(serialized, context, evaluationTime) {
  try {
    const now = time(evaluationTime);
    ensure(typeof serialized === 'string' && serialized.length <= 2097152);
    const input = parseCanonical(serialized);
    ensure(exactKeys(input, ['version', 'policyDigest', 'inventoryBytes', 'stateBytes', 'checkpointBytes', 'eventBytes', 'historyBytes']) &&
      input.version === 'steer-raw-checkpoint/v1' && input.policyDigest === policyDigest);
    ensure(exactKeys(context, ['configDigest', 'inputDigest', 'preterminalBindingDigest', 'authorityDigest', 'tupleDigest', 'recordId', 'artifactRevision',
      'environmentId', 'originalHistoryBytes', 'copies', 'originalStateAt', 'planDigest', 'openingReservationDigest', 'openingAt', 'entries']) &&
      ['configDigest', 'inputDigest', 'preterminalBindingDigest', 'authorityDigest', 'tupleDigest', 'planDigest', 'openingReservationDigest'].every((key) => hex(context[key], 64)) &&
      text(context.recordId) && hex(context.artifactRevision, 40) && (context.environmentId === null || text(context.environmentId)) &&
      Array.isArray(context.copies) && context.copies.length > 0 && context.copies.length <= 32 && Array.isArray(context.entries) && context.entries.length === context.copies.length);
    const checkedEvents = correctedLifecycleEventDecision(jcs({ version: 'steer-r5-001-events/v1', policyDigest: eventPolicy,
      scope: { organization: 'steer-platform', itemId: '0001-flight-deck-foundation', environmentId: context.environmentId },
      eventBytes: input.eventBytes, historyBytes: input.historyBytes, evaluationTime }));
    ensure(checkedEvents.state === 'validated-trigger');
    const historyBytes = [...input.historyBytes, input.eventBytes], events = historyBytes.map(parseCanonical);
    ensure(Array.isArray(context.originalHistoryBytes) && context.originalHistoryBytes.length > 0 && historyBytes.length >= context.originalHistoryBytes.length &&
      same(historyBytes.slice(0, context.originalHistoryBytes.length), context.originalHistoryBytes) &&
      events.every((event) => event.recordId === context.recordId && event.artifactRevision === context.artifactRevision &&
        event.recordClass === 'RC-CORPUS-RAW-WORKING' && event.policySha256 === RETENTION_POLICY_SHA) &&
      events.filter((event) => event.eventType === 'corpus-sanitization-terminal').length === 1);
    const historyDigest = sha256(jcs(historyBytes)), holds = new Set();
    for (const event of events) {
      if (event.eventType === 'hold-applied') { ensure(text(event.holdId) && !holds.has(event.holdId)); holds.add(event.holdId); }
      if (event.eventType === 'hold-released') { ensure(holds.has(event.holdId)); holds.delete(event.holdId); }
    }
    const read = (field, domain, kind, fields) => {
      const bytes = input[field]; ensure(typeof bytes === 'string' && bytes.length <= 65536);
      const raw = parseCanonical(bytes), record = timed.verifyBytes(bytes, { domain, recordedAt: raw.recordedAt, evaluatedAt: evaluationTime }).record;
      ensure(exactKeys(record, ['kind', 'configDigest', 'source', ...fields, 'recordedAt', 'validThrough', 'recordDigest', 'signature']) &&
        record.kind === kind && record.configDigest === context.configDigest && time(record.recordedAt) <= now && now < time(record.validThrough) &&
        now - time(record.recordedAt) <= 300000000000n && time(record.validThrough) - time(record.recordedAt) <= 300000000000n);
      return record;
    };
    const inventory = read('inventoryBytes', 'provider', 'raw-checkpoint-inventory', ['inventoryId', 'copies', 'complete']);
    const state = read('stateBytes', 'authority', 'raw-checkpoint-state', ['inventoryDigest', 'historyDigest', 'historyComplete', 'holdState', 'referenceState']);
    const checkpoint = read('checkpointBytes', 'authority', 'raw-checkpoint', ['checkpointId', 'sequence', 'previousCheckpointDigest', 'consumptionKey',
      'inputDigest', 'planDigest', 'openingReservationDigest', 'authorityDigest', 'tupleDigest', 'completed', 'remaining', 'inventoryDigest', 'stateDigest', 'historyDigest']);
    ensure(inventory.source === 'authoritative-copy-inventory' && text(inventory.inventoryId) && inventory.complete === true &&
      time(inventory.recordedAt) >= time(context.openingAt) && time(inventory.recordedAt) > time(context.originalStateAt));
    ensure(state.source === 'authoritative-lifecycle-store' && state.inventoryDigest === inventory.recordDigest && state.historyDigest === historyDigest &&
      state.historyComplete === true && holds.size === 0 && ['none', 'released'].includes(state.holdState) && state.referenceState === 'cleared' &&
      time(state.recordedAt) >= time(inventory.recordedAt) && time(state.recordedAt) >= time(events.at(-1).occurredAt));
    ensure(checkpoint.source === 'authoritative-raw-recovery' && text(checkpoint.checkpointId) && checkpoint.sequence === 1 && checkpoint.previousCheckpointDigest === null &&
      checkpoint.consumptionKey === context.preterminalBindingDigest && checkpoint.inputDigest === context.inputDigest && checkpoint.planDigest === context.planDigest &&
      checkpoint.openingReservationDigest === context.openingReservationDigest && checkpoint.authorityDigest === context.authorityDigest && checkpoint.tupleDigest === context.tupleDigest &&
      checkpoint.inventoryDigest === inventory.recordDigest && checkpoint.stateDigest === state.recordDigest && checkpoint.historyDigest === historyDigest &&
      time(checkpoint.recordedAt) >= time(state.recordedAt) && time(checkpoint.validThrough) <= time(state.validThrough) && time(checkpoint.validThrough) <= time(inventory.validThrough));
    const completed = [], remaining = [], remainingCopies = [];
    for (let index = 0; index < context.copies.length; index++) {
      const copy = context.copies[index], entry = context.entries[index];
      ensure(copy.copyId === entry.copyId && typeof entry.replayed === 'boolean' && hex(entry.requestDigest, 64) && hex(entry.receiptDigest, 64));
      if (entry.replayed) {
        ensure(time(entry.receiptAt) <= time(inventory.recordedAt));
        completed.push({ copyId: copy.copyId, requestDigest: entry.requestDigest, receiptDigest: entry.receiptDigest });
      } else {
        ensure(time(entry.receiptAt) > time(checkpoint.recordedAt)); remaining.push(copy.copyId); remainingCopies.push(copy);
      }
    }
    ensure(same(checkpoint.completed, completed) && same(checkpoint.remaining, remaining) && same(inventory.copies, remainingCopies));
    return { state: 'verified-raw-checkpoint', checkpointDigest: checkpoint.recordDigest, recordedAt: checkpoint.recordedAt,
      completedCopyIds: completed.map((entry) => entry.copyId), remainingCopyIds: remaining, effects: zeroEffects(), executionAuthorized: false };
  } catch { return { state: 'blocked', firstError: 'RAW_CHECKPOINT_INVALID', effects: zeroEffects(), executionAuthorized: false }; }
}
