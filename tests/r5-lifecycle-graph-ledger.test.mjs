import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as fixtures from '../intent/0107/execution-fixtures.mjs';
import { lifecycleGraphExecutionHook } from '../intent/0107/execution-hooks.mjs';
import { loadRequiredCases } from '../intent/0098/required-cases.mjs';
import { runCorrectedCoverage } from '../intent/0098/execution-ledger.mjs';
import { createLifecycleEventVerifier } from '../intent/0059/lifecycle-events.candidate.mjs';
import { createTimedRecordVerifier } from '../intent/0058/record-verifier.candidate.mjs';
import { jcs, sha256, TRUST_REGISTRY, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const id = 'R5:PREFLIGHT-R3-R5-001:reproduction:1';

test('0107: exact surrogate counterexample is compared with a complete same-class lifecycle control, not arbitrary format rejection', () => {
  const hook = lifecycleGraphExecutionHook(loadRequiredCases().cases.find((row) => row.id === id)), rows = [];
  hook.run((input, invoke, expected) => {
    const actual = invoke(); rows.push({ input, actual });
    for (const [field, value] of Object.entries(expected)) assert.deepEqual(actual[field], value);
    if (actual.effects) assert.deepEqual(actual.effects, zeroEffects());
  });
  assert.equal(rows.length, fixtures.lifecycleGraphVariants().length + 3);
  assert.equal(rows[0].actual.state, 'deleted-tombstoned'); assert.equal(rows[0].actual.hypotheticalLegacyEffects.lifecycle, 1);
  assert.equal(rows[1].actual.firstError, 'EVENT_SCHEMA_INVALID');
  assert.ok(rows[1].actual.schemaErrors.includes('/required/eventId')); assert.ok(rows[1].actual.schemaErrors.includes('/required/providerProofBytes'));
  assert.equal(rows.filter((row) => row.actual.state === 'validated-lifecycle-candidate').length, 2);
  assert.equal(rows[2].actual.protectedActionCount, 3); assert.equal(rows[2].actual.copyCount, 2);
  assert.throws(() => hook.run(() => { throw new Error('ASSERTION_FAILED'); }), /ASSERTION_FAILED/);
  assert.equal(lifecycleGraphExecutionHook({ id: 'unknown' }), null);
});

test('0107: failed-run control uses a closed terminal event, synthetic 90-day interval and unmodified original key era', () => {
  const value = fixtures.lifecycleGraphExecutionCase(), event = JSON.parse(value.graph.eventBytes), history = JSON.parse(value.graph.historyBytes[0]);
  assert.equal(value.config.recordClass, 'RC-FAILED-RUN'); assert.equal(value.runtimeBytes, undefined);
  assert.equal(event.eventType, 'run-terminal'); assert.equal(event.terminalStatus, 'failed'); assert.equal(event.occurredAt, '2026-09-04T12:00:00Z');
  assert.equal(history.occurredAt, '2026-09-04T11:59:50Z'); assert.equal(value.evaluationTime, '2026-12-03T12:00:50Z');
  const verifier = createLifecycleEventVerifier(jcs(TRUST_REGISTRY));
  const envelope = jcs({ version: 'steer-r5-001-events/v1', policyDigest: verifier.policyDigest,
    scope: { organization: 'steer-platform', itemId: '0001-flight-deck-foundation', environmentId: null },
    eventBytes: value.graph.eventBytes, historyBytes: value.graph.historyBytes, evaluationTime: value.evaluationTime });
  const result = verifier.verify(envelope, value.evaluationTime); assert.equal(result.state, 'validated-trigger'); assert.equal(result.verifiedHistoryCount, 1);
  assert.deepEqual(result.effects, zeroEffects());
  assert.equal(JSON.parse(value.graph.stateBytes).historyDigest, sha256(jcs([...value.graph.historyBytes, value.graph.eventBytes])));
});

test('0107: malformed event semantics can carry genuine signatures and rebuilt history commitments but still deny', () => {
  const verifier = createTimedRecordVerifier(jcs(TRUST_REGISTRY));
  for (const variant of ['event-missing:eventVersion', 'event-missing:actorAuthority', 'wrong-policy', 'history-wrong-record']) {
    const value = fixtures.lifecycleGraphExecutionCase(variant);
    for (const bytes of [...value.graph.historyBytes, value.graph.eventBytes]) {
      const event = JSON.parse(bytes), provider = JSON.parse(event.providerProofBytes);
      assert.equal(verifier.verifyBytes(bytes, { domain: 'record', recordedAt: event.occurredAt, evaluatedAt: value.evaluationTime }).record.recordDigest, event.recordDigest);
      assert.equal(verifier.verifyBytes(event.providerProofBytes, { domain: 'provider', recordedAt: provider.recordedAt, evaluatedAt: value.evaluationTime }).record.recordDigest, provider.recordDigest);
    }
    assert.equal(JSON.parse(value.graph.stateBytes).historyDigest, sha256(jcs([...value.graph.historyBytes, value.graph.eventBytes])));
    assert.equal(value.verifier.verify(value.bytes, value.evaluationTime).state, 'blocked');
  }
});

test('0107: every copy and the tombstone require complete action, human and provider proofs with zero effects', () => {
  assert.deepEqual(Object.keys(fixtures).sort(), ['immediateLifecycleExecutionCase', 'immutableRetentionExecutionCase', 'lifecycleGraphExecutionCase', 'lifecycleGraphVariants', 'lifecycleNegativeExecutionCase', 'lifecycleReadinessExecutionCase', 'longRetentionExecutionCase', 'provenanceChildDispositionExecutionCase', 'rawDeadlineExecutionCase', 'releaseLifecycleExecutionCase', 'shortRetentionExecutionCase', 'specialLifecycleExecutionCase']);
  assert.throws(() => fixtures.lifecycleGraphExecutionCase('arbitrary'), /UNKNOWN_LIFECYCLE_GRAPH_VARIANT/);
  const variants = fixtures.lifecycleGraphVariants(); assert.equal(variants[0], 'positive'); assert.equal(new Set(variants).size, variants.length);
  for (const label of ['copy-1', 'copy-2', 'tombstone']) assert.equal(variants.filter((kind) => kind.startsWith(`omit:${label}:`)).length, 10);
  for (const variant of variants) {
    const value = fixtures.lifecycleGraphExecutionCase(variant), result = value.verifier.verify(value.bytes, value.evaluationTime);
    assert.deepEqual(result.effects, zeroEffects()); assert.equal(Object.hasOwn(result, 'executionAuthorized'), false, 'Original-era API has no such field; do not fabricate it.');
  }
  assert.equal(fixtures.lifecycleGraphExecutionCase().input, fixtures.lifecycleGraphExecutionCase().input);
});

test('0107: all nine R5 IDs execute once without closing the five findings or crediting remaining graph matrices', () => {
  const report = runCorrectedCoverage(), row = report.executions.find((entry) => entry.id === id);
  assert.equal(report.required, 4036); assert.equal(report.executed, 393); assert.equal(report.passed, 393); assert.equal(report.failed, 0); assert.equal(report.uncovered, 3643);
  assert.equal(report.families.R5.executed, 9); assert.equal(report.families.R5.passed, 9); assert.equal(report.families.R5.uncovered, 0);
  assert.equal(row.observationCount, fixtures.lifecycleGraphVariants().length + 3); assert.equal(row.status, 'passed');
  assert.equal(report.families['LIFECYCLE-GRAPH'].executed, 52); assert.equal(report.families.MIGRATION.executed, 0);
  for (const flag of ['completeCoverage', 'normativeAcceptanceComplete', 'independentAcceptance', 'executionAuthorized', 'liveProviderUsed']) assert.equal(report[flag], false);
  assert.deepEqual(JSON.parse(readFileSync(new URL('../intent/0120/QUICK-EXECUTION-REPORT.json', import.meta.url))), report);
});
