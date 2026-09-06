import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as fixtures from '../intent/0106/execution-fixtures.mjs';
import { migrationGraphExecutionHook } from '../intent/0106/execution-hooks.mjs';
import { loadRequiredCases } from '../intent/0098/required-cases.mjs';
import { runCorrectedCoverage } from '../intent/0098/execution-ledger.mjs';
import { createTimedRecordVerifier } from '../intent/0058/record-verifier.candidate.mjs';
import { jcs, sha256, TRUST_REGISTRY, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const id = 'R5:PREFLIGHT-R3-R5-003:reproduction:1', phases = ['expand', 'backfill', 'contract'];
const sourceFields = ['itemBytesBase64', 'signatureBytesBase64', 'attemptBytesBase64', 'auditBytesBase64', 'releaseBytesBase64', 'evidenceBytesBase64'];

test('0106: the exact frozen counterexample has full corrected phase controls and composed negative executions', () => {
  const hook = migrationGraphExecutionHook(loadRequiredCases().cases.find((row) => row.id === id)), observations = [];
  hook.run((input, invoke, expected) => {
    const actual = invoke(); observations.push({ input, actual });
    for (const [field, value] of Object.entries(expected)) assert.deepEqual(actual[field], value);
    if (actual.effects) assert.deepEqual(actual.effects, zeroEffects());
  });
  assert.equal(observations.length, 4 + phases.reduce((sum, phase) => sum + fixtures.migrationGraphVariants(phase).length, 0));
  assert.equal(observations[0].actual.state, 'journaled'); assert.equal(observations[0].actual.hypotheticalJournalEffects, 1);
  assert.equal(observations.filter((row) => row.actual.state === 'replay-noop').length, 3);
  assert.equal(observations.filter((row) => row.actual.state === 'validated-safe-non-result').length, 3);
  assert.equal(observations.filter((row) => row.actual.state === 'validated-migration-candidate').length, 9);
  assert.throws(() => hook.run(() => { throw new Error('ASSERTION_FAILED'); }), /ASSERTION_FAILED/);
  assert.equal(migrationGraphExecutionHook({ id: 'R5:PREFLIGHT-R3-R5-001:reproduction:1' }), null);
});

test('0106: graph fixtures independently construct exact phase rows, backups and all six preserved source byte strings', () => {
  for (const phase of phases) {
    const value = fixtures.migrationGraphExecutionCase(phase), before = JSON.parse(value.graph.beforeTruthBytes), after = JSON.parse(value.graph.afterTruthBytes);
    const beforeData = JSON.parse(before.dataBytes), afterData = JSON.parse(after.dataBytes);
    assert.equal(value.graph.version, 'steer-migration-graph/v3'); assert.equal(value.config.version, 'steer-migration-context/v3');
    assert.equal(value.graph.beforeTruthBytes, value.graph.backupTruthBytes); assert.equal(value.graph.backupTruthBytes, value.graph.rehearsalTruthBytes);
    for (const field of sourceFields) {
      assert.equal(before[field], after[field]); assert.deepEqual(Buffer.from(after[field], 'base64'), Buffer.from(`${field}: original e\u0301\n\0`, 'utf8'));
    }
    if (phase === 'expand') { assert.deepEqual(afterData.columns, ['new', 'old']); assert.equal(afterData.schemaVersion, 'schema-v2'); assert.ok(afterData.rows.every((row) => row.values.new === null)); }
    if (phase === 'backfill') { assert.equal(beforeData.schemaVersion, afterData.schemaVersion); assert.equal(afterData.rows[0].values.new, 'value-0'); assert.equal(afterData.rows[1].values.new, null); }
    if (phase === 'contract') { assert.deepEqual(afterData.columns, ['new']); assert.equal(afterData.schemaVersion, 'schema-v3'); assert.ok(value.graph.cleanupBundleBytes.length > 0); }
    const rollback = fixtures.migrationGraphExecutionCase(phase, 'rollback'); assert.equal(rollback.graph.rollbackTruthBytes, rollback.graph.beforeTruthBytes);
    assert.equal(rollback.graph.afterTruthBytes, rollback.graph.beforeTruthBytes);
  }
});

test('0106: re-signed stored-data and journal corruption are detected by the full graph despite valid provider signatures', () => {
  const verifier = createTimedRecordVerifier(jcs(TRUST_REGISTRY));
  for (const phase of phases) for (const variant of [...sourceFields.map((field) => `truth:${field}`), 'changed-row', 'changed-journal']) {
    const value = fixtures.migrationGraphExecutionCase(phase, variant);
    for (const [field, domain] of [['afterProofBytes', 'provider-a'], ['journalBytes', 'provider'], ['resultBytes', 'provider-a']]) {
      const record = JSON.parse(value.graph[field]); assert.equal(verifier.verifyBytes(value.graph[field], { domain, recordedAt: record.recordedAt, evaluatedAt: value.evaluationTime }).record.recordDigest, record.recordDigest);
    }
    assert.equal(JSON.parse(value.graph.afterProofBytes).truthDigest, sha256(value.graph.afterTruthBytes));
    assert.equal(value.verifier.verify(value.bytes, value.evaluationTime).state, 'blocked');
  }
});

test('0106: closed cases retain target/proof and human requirements without exposing arbitrary signing or granting execution', () => {
  assert.deepEqual(Object.keys(fixtures).sort(), ['migrationGraphExecutionCase', 'migrationGraphVariants']);
  assert.throws(() => fixtures.migrationGraphExecutionCase('arbitrary'), /UNKNOWN_MIGRATION_GRAPH_PHASE/);
  assert.throws(() => fixtures.migrationGraphExecutionCase('expand', 'arbitrary'), /UNKNOWN_MIGRATION_GRAPH_VARIANT/);
  for (const phase of phases) {
    const variants = fixtures.migrationGraphVariants(phase); assert.equal(variants[0], 'positive'); assert.equal(new Set(variants).size, variants.length);
    assert.equal(variants.filter((v) => v.startsWith('omit-action:')).length, 10); assert.equal(variants.filter((v) => v.startsWith('omit-target:')).length, 7);
    const first = fixtures.migrationGraphExecutionCase(phase); assert.equal(first.input, fixtures.migrationGraphExecutionCase(phase).input);
    for (const variant of variants) {
      const value = fixtures.migrationGraphExecutionCase(phase, variant), result = value.verifier.verify(value.bytes, value.evaluationTime);
      assert.deepEqual(result.effects, zeroEffects()); assert.equal(result.executionAuthorized, false); assert.equal(result.journalEffects, 0);
    }
  }
  for (const variant of ['missing-human', 'wrong-human-scope']) {
    const value = fixtures.migrationGraphExecutionCase('contract', variant); assert.equal(value.verifier.verify(value.bytes, value.evaluationTime).state, 'blocked');
  }
});

test('0106: one full-graph R5 mapping does not claim migration matrix IDs or formal closure', () => {
  const report = runCorrectedCoverage(), rows = report.executions.filter((row) => row.id === id);
  assert.equal(report.required, 4036); assert.equal(report.executed, 341); assert.equal(report.passed, 341); assert.equal(report.failed, 0); assert.equal(report.uncovered, 3695);
  assert.equal(rows.length, 1); assert.equal(rows[0].status, 'passed'); assert.ok(rows[0].observationCount > 130);
  assert.equal(report.families.R5.executed, 9); assert.equal(report.families.R5.uncovered, 0);
  assert.equal(report.families.MIGRATION.executed, 0); assert.equal(report.families['LIFECYCLE-GRAPH'].executed, 0);
  for (const flag of ['completeCoverage', 'normativeAcceptanceComplete', 'independentAcceptance', 'executionAuthorized', 'liveProviderUsed']) assert.equal(report[flag], false);
  assert.deepEqual(JSON.parse(readFileSync(new URL('../intent/0109/QUICK-EXECUTION-REPORT.json', import.meta.url))), report);
});
