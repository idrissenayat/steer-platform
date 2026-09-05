// Offline evidence only. The lifecycle composition supplies verified context;
// no request route, token issuance, atomic store or effect executor exists here.
import { readFileSync } from 'node:fs';
import { exactKeys, hex, jcs, parseCanonical, sha256, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createTimedRecordVerifier } from '../0058/record-verifier.candidate.mjs';
import { exactInstant, timePolicyDigest } from '../0069/exact-time.candidate.mjs';
import { policyDigest as preterminalPolicy } from '../0073/raw-preterminal.candidate.mjs';
const registryBytes = jcs(JSON.parse(readFileSync(new URL('../0001/reviews/domain/round-3/remediation/TRUST-REGISTRY.candidate.json', import.meta.url), 'utf8')));
const timed = createTimedRecordVerifier(registryBytes);
export const policyDigest = sha256(jcs({ version: 'steer-raw-batch/v1', registryDigest: timed.registryDigest, timePolicyDigest, preterminalPolicy,
  rules: 'one stable grant consumption key; exact ordered request plan; full winning opening chain before receipts, current chain pins opening; all-first or all-replay copies; separate tombstone; zero execution', maxCopies: 32 }));
const ensure = (value) => { if (!value) throw new Error('RAW_BATCH_INVALID'); };
const time = (value) => { const result = exactInstant(value); ensure(result !== null); return result; };
const text = (value) => typeof value === 'string' && value.length > 0 && value.length <= 512 && value.trim() === value && !/[\u0000-\u001f\u007f*?]/u.test(value);
const same = (a, b) => jcs(a) === jcs(b);
const fields = {
  plan: ['source', 'inputDigest', 'authorityDigest', 'tupleDigest', 'terminalDigest', 'entries'],
  head: ['source', 'planDigest', 'headId', 'head', 'previousHead', 'sequence'],
  replay: ['source', 'planDigest', 'headId', 'status', 'resultDigest'],
  reservation: ['source', 'planDigest', 'headId', 'headDigest', 'replayDigest', 'expectedHead', 'winner', 'status'],
};

// trusted is derived only after actual history/state/grant/actions/receipts are
// validated by 0061. It is not an agent-installable authorization context.
export function verifyRawBatchEvidence(serialized, trusted, evaluationTime) {
  try {
    const now = time(evaluationTime);
    ensure(typeof serialized === 'string' && serialized.length <= 524288);
    const bundle = parseCanonical(serialized);
    ensure(exactKeys(bundle, ['version', 'policyDigest', 'planBytes', 'openingBytes', 'headBytes', 'replayBytes', 'reservationBytes']) &&
      bundle.version === 'steer-raw-batch/v1' && bundle.policyDigest === policyDigest);
    ensure(exactKeys(trusted, ['configDigest', 'inputDigest', 'preterminalBindingDigest', 'authorityDigest', 'tupleDigest', 'terminalDigest',
      'terminalAt', 'deadlineAt', 'stateAt', 'entries', 'aggregateDigest', 'aggregateAt']) &&
      ['configDigest', 'inputDigest', 'preterminalBindingDigest', 'authorityDigest', 'tupleDigest', 'terminalDigest', 'aggregateDigest'].every((key) => hex(trusted[key], 64)) &&
      Array.isArray(trusted.entries) && trusted.entries.length > 0 && trusted.entries.length <= 32);
    const readRecord = (kind, bytes, opening = false) => {
      ensure(typeof bytes === 'string' && bytes.length <= 65536);
      const raw = parseCanonical(bytes), domain = kind === 'plan' ? 'authority' : kind === 'replay' ? 'replay-authority' : 'cas-authority';
      const record = timed.verifyBytes(bytes, { domain, recordedAt: raw.recordedAt, evaluatedAt: evaluationTime }).record;
      ensure(exactKeys(record, ['kind', 'configDigest', 'consumptionKey', ...fields[kind], ...(!opening && kind !== 'plan' ? ['openingReservationDigest'] : []), 'recordedAt', 'validThrough', 'recordDigest', 'signature']) &&
        record.kind === `raw-batch-${opening ? 'opening-' : ''}${kind}` && record.configDigest === trusted.configDigest && record.consumptionKey === trusted.preterminalBindingDigest &&
        time(record.recordedAt) <= now && now < time(record.validThrough) && now - time(record.recordedAt) <= 300000000000n &&
        time(record.validThrough) - time(record.recordedAt) <= 300000000000n);
      return record;
    };
    const records = Object.fromEntries(Object.keys(fields).map((kind) => [kind, readRecord(kind, bundle[`${kind}Bytes`])]));
    ensure(typeof bundle.openingBytes === 'string' && bundle.openingBytes.length <= 262144);
    const openingInput = parseCanonical(bundle.openingBytes);
    ensure(exactKeys(openingInput, ['headBytes', 'replayBytes', 'reservationBytes']));
    const opening = Object.fromEntries(['head', 'replay', 'reservation'].map((kind) => [kind, readRecord(kind, openingInput[`${kind}Bytes`], true)]));
    const { plan, head, replay, reservation } = records;
    const ids = new Set(), requests = new Set(), keys = new Set();
    const entries = trusted.entries.map((entry) => {
      ensure(exactKeys(entry, ['copyId', 'requestDigest', 'operationDigest', 'idempotencyKey', 'requestedAt', 'reservationAt', 'receiptAt', 'replayed']) &&
        text(entry.copyId) && text(entry.idempotencyKey) && hex(entry.requestDigest, 64) && hex(entry.operationDigest, 64) && typeof entry.replayed === 'boolean' &&
        !ids.has(entry.copyId) && !requests.has(entry.requestDigest) && !keys.has(entry.idempotencyKey));
      ids.add(entry.copyId); requests.add(entry.requestDigest); keys.add(entry.idempotencyKey);
      ensure(time(entry.requestedAt) >= time(trusted.stateAt) && time(entry.requestedAt) >= time(trusted.terminalAt) &&
        time(entry.requestedAt) <= time(plan.recordedAt) && time(entry.receiptAt) <= time(trusted.deadlineAt));
      return Object.fromEntries(['copyId', 'requestDigest', 'operationDigest', 'idempotencyKey'].map((key) => [key, entry[key]]));
    });
    ensure(same(entries.map((entry) => entry.copyId), [...ids].sort()) && same(plan.entries, entries) &&
      plan.source === 'authoritative-raw-batch-planner' && plan.inputDigest === trusted.inputDigest && plan.authorityDigest === trusted.authorityDigest &&
      plan.tupleDigest === trusted.tupleDigest && plan.terminalDigest === trusted.terminalDigest && time(plan.recordedAt) >= time(trusted.stateAt));
    const checkStore = ({ head, replay, reservation }) => {
      for (const record of [head, replay, reservation]) ensure(record.planDigest === plan.recordDigest && time(record.recordedAt) >= time(plan.recordedAt));
      ensure(head.source === 'authoritative-cas-store' && replay.source === 'authoritative-replay-store' && reservation.source === 'authoritative-cas-store' &&
      text(head.headId) && replay.headId === head.headId && reservation.headId === head.headId && hex(head.head, 64) && hex(head.previousHead, 64) &&
      Number.isSafeInteger(head.sequence) && head.sequence > 0 && reservation.expectedHead === head.head && reservation.headDigest === head.recordDigest &&
      reservation.replayDigest === replay.recordDigest && time(reservation.recordedAt) >= time(head.recordedAt) && time(reservation.recordedAt) >= time(replay.recordedAt) &&
      time(reservation.validThrough) <= time(head.validThrough) && time(reservation.validThrough) <= time(replay.validThrough) && time(reservation.validThrough) <= time(plan.validThrough));
    };
    checkStore(records); checkStore(opening);
    ensure(opening.replay.status === 'unused' && opening.replay.resultDigest === null && opening.reservation.status === 'reserved' && opening.reservation.winner === true &&
      trusted.entries.every((entry) => time(entry.receiptAt) > time(opening.reservation.recordedAt) && time(entry.reservationAt) >= time(opening.reservation.recordedAt)));
    for (const record of [head, replay, reservation]) ensure(record.openingReservationDigest === opening.reservation.recordDigest && time(record.recordedAt) >= time(opening.reservation.recordedAt));
    ensure(head.headId === opening.head.headId);
    const first = replay.status === 'unused' && replay.resultDigest === null && reservation.status === 'reserved' && reservation.winner === true;
    const repeated = replay.status === 'committed' && replay.resultDigest === trusted.aggregateDigest && reservation.status === 'already-committed' && reservation.winner === false;
    ensure(first || repeated);
    if (first) ensure(['head', 'previousHead', 'sequence'].every((field) => head[field] === opening.head[field]) &&
      trusted.entries.every((entry) => !entry.replayed && time(entry.reservationAt) >= time(reservation.recordedAt) && time(entry.receiptAt) > time(reservation.recordedAt)));
    else ensure(head.previousHead === opening.head.head && head.sequence === opening.head.sequence + 1 && head.head !== opening.head.head &&
      trusted.entries.every((entry) => entry.replayed) && time(replay.recordedAt) >= time(trusted.aggregateAt));
    return { state: 'verified-raw-batch', mode: first ? 'first' : 'replay', planDigest: plan.recordDigest, consumptionKey: plan.consumptionKey,
      reservationDigest: reservation.recordDigest, effects: zeroEffects(), executionAuthorized: false };
  } catch { return { state: 'blocked', firstError: 'RAW_BATCH_INVALID', effects: zeroEffects(), executionAuthorized: false }; }
}
