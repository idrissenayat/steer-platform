import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { sharedActionExecutionHook } from '../intent/0105/execution-hooks.mjs';
import * as fixtures from '../intent/0105/execution-fixtures.mjs';
import { loadRequiredCases } from '../intent/0098/required-cases.mjs';
import { runCorrectedCoverage } from '../intent/0098/execution-ledger.mjs';
import { createTimedRecordVerifier } from '../intent/0058/record-verifier.candidate.mjs';
import { jcs, sha256, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const groups = [
  ['R5:PREFLIGHT-R3-R5-001:reproduction:3', ['lifecycle.delete-copy', 'lifecycle.crypto-erase', 'lifecycle.commit-tombstone']],
  ['R5:PREFLIGHT-R3-R5-003:reproduction:2', ['migration.expand', 'migration.backfill', 'migration.contract']],
];
function observe(hook) {
  const rows = [];
  hook.run((input, invoke, expected) => {
    const result = invoke(); rows.push({ input, result, expected });
    for (const [field, value] of Object.entries(expected)) assert.deepEqual(result[field], value, input.slice(0, 150));
    if (result.effects) assert.deepEqual(result.effects, zeroEffects());
  }); return rows;
}

test('0105: both exact omitted-action reproductions run legacy controls and the complete corrected stack for each action', () => {
  for (const [id, actions] of groups) {
    const hook = sharedActionExecutionHook(loadRequiredCases().cases.find((row) => row.id === id)), rows = observe(hook);
    assert.equal(rows.length, 2 + actions.reduce((sum, action) => sum + 1 + fixtures.sharedActionVariants(action).length, 0));
    assert.equal(rows[0].result.decision, 'ALLOW'); assert.deepEqual(rows[1].result.legacy, ['github.exam.candidate.commit']);
    assert.deepEqual(rows.filter((row) => row.result.decision === 'AUTHORIZED_CANDIDATE').map((row) => row.result.action), actions);
    assert.deepEqual(rows.filter((row) => row.result.decision === 'REPLAY_NOOP').map((row) => row.result.action), actions);
    assert.equal(rows.filter((row) => row.result.firstError === 'ACTION_UNLISTED').length, 3);
    assert.throws(() => hook.run(() => { throw new Error('ASSERTION_FAILED'); }), /ASSERTION_FAILED/);
  }
  assert.equal(sharedActionExecutionHook({ id: 'R5:PREFLIGHT-R3-R5-001:reproduction:1' }), null);
  assert.equal(sharedActionExecutionHook({ id: 'R5:PREFLIGHT-R3-R5-003:reproduction:1' }), null);
});

test('0105: exact resource fields and every signed proof are represented, not only action-list membership', () => {
  const copy = ['objectId', 'recordClass', 'copyId', 'copyKind', 'providerBindingId', 'account', 'objectKey', 'versionId', 'keyId', 'inventoryDigest', 'tupleDigest'];
  const migration = ['database', 'schema', 'schemaFrom', 'schemaTo', 'oldAppVersion', 'newAppVersion', 'batch', 'checkpoint', 'executionId', 'planDigest'];
  for (const action of groups.flatMap((row) => row[1])) {
    const value = fixtures.sharedActionExecutionCase(action), context = JSON.parse(value.installedContextBytes), variants = fixtures.sharedActionVariants(action);
    const expected = action.startsWith('migration.') ? migration : action === 'lifecycle.commit-tombstone' ? ['objectId', 'recordClass', 'inventoryDigest', 'tupleDigest', 'aggregateReceiptDigest', 'path'] : copy;
    assert.deepEqual(Object.keys(context.grants[0].resources).sort(), [...expected].sort());
    for (const key of expected) assert.ok(variants.includes(`resource:${key}`));
    assert.equal(Object.keys(value.records).length, 10);
    for (const kind of Object.keys(value.records)) for (const mutation of ['omit', 'signature']) assert.ok(variants.includes(`${mutation}:${kind}`));
    for (const key of Object.keys(context.scope)) assert.ok(variants.includes(`scope:${key}`));
    assert.equal(variants[0], 'positive'); assert.equal(new Set(variants).size, variants.length);
  }
});

test('0105: hostile semantics retain genuine synthetic signatures and rebuilt downstream lineage', () => {
  for (const action of groups.flatMap((row) => row[1])) for (const variant of ['wrong-role', 'denied-authority', 'stale-head', 'loser', 'resource:' + (action.startsWith('migration.') ? 'database' : 'objectId')]) {
    const value = fixtures.sharedActionExecutionCase(action, variant), context = JSON.parse(value.installedContextBytes), verifier = createTimedRecordVerifier(context.trustRegistryBytes);
    for (const [kind, record] of Object.entries(value.records)) {
      const domain = kind === 'request' ? 'record' : kind === 'resources' ? 'provider-a' : kind === 'replay' ? 'replay-authority' : ['head', 'reservation'].includes(kind) ? 'cas-authority' : kind;
      assert.equal(verifier.verifyBytes(jcs(record), { domain, recordedAt: record.recordedAt, evaluatedAt: value.evaluatedAt }).record.recordDigest, record.recordDigest);
    }
    for (const kind of ['upstream', 'downstream', 'delegation', 'assignment', 'authority', 'resources']) assert.equal(value.records.request[`${kind}Digest`], value.records[kind].recordDigest);
    assert.equal(value.records.reservation.headDigest, value.records.head.recordDigest);
    assert.equal(value.records.reservation.replayDigest, value.records.replay.recordDigest);
    assert.deepEqual(value.verifier.verify(value.bytes, value.evaluatedAt), { decision: 'DENY', firstError: 'PROTECTED_ACTION_INVALID', effects: zeroEffects() });
  }
});

test('0105: closed deterministic fixtures keep installed context separate and expose no generic signer', () => {
  assert.deepEqual(Object.keys(fixtures).sort(), ['legacyUnlistedActionCase', 'sharedActionExecutionCase', 'sharedActionVariants']);
  assert.throws(() => fixtures.sharedActionExecutionCase('arbitrary.action'), /UNKNOWN_SHARED_ACTION_FIXTURE/);
  assert.throws(() => fixtures.sharedActionExecutionCase('migration.expand', 'arbitrary-mutation'), /UNKNOWN_SHARED_ACTION_VARIANT/);
  const original = fixtures.sharedActionExecutionCase('migration.expand'), changed = fixtures.sharedActionExecutionCase('migration.expand', 'scope:tenant');
  assert.equal(changed.bytes, original.bytes); assert.notEqual(changed.installedContextBytes, original.installedContextBytes);
  assert.notEqual(sha256(changed.input), sha256(original.input));
  assert.equal(fixtures.sharedActionExecutionCase('migration.expand').input, original.input);
  assert.equal(changed.verifier.verify(changed.bytes, changed.evaluatedAt).decision, 'DENY');
  assert.equal(original.verifier.verify(original.bytes, original.evaluatedAt).decision, 'AUTHORIZED_CANDIDATE');
});

test('0105: two case IDs are credited once and a fresh quick execution matches the current snapshot', () => {
  const report = runCorrectedCoverage(); assert.equal(report.executed, 309); assert.equal(report.passed, 309); assert.equal(report.failed, 0); assert.equal(report.uncovered, 3727);
  assert.equal(report.families.R5.executed, 7); assert.equal(report.families.R5.uncovered, 2);
  for (const [id] of groups) {
    const matches = report.executions.filter((row) => row.id === id); assert.equal(matches.length, 1); assert.equal(matches[0].status, 'passed');
    assert.ok(matches[0].observationCount > 150); assert.ok(matches[0].scope.includes('not full lifecycle/migration graph'));
  }
  assert.equal(report.families.MIGRATION.executed, 0); assert.equal(report.families['LIFECYCLE-GRAPH'].executed, 0);
  for (const key of ['completeCoverage', 'normativeAcceptanceComplete', 'independentAcceptance', 'executionAuthorized', 'liveProviderUsed']) assert.equal(report[key], false);
  assert.deepEqual(JSON.parse(readFileSync(new URL('../intent/0105/QUICK-EXECUTION-REPORT.json', import.meta.url))), report);
});
