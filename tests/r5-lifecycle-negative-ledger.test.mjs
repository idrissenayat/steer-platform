import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { lifecycleGraphExecutionCase, lifecycleNegativeExecutionCase } from '../intent/0107/execution-fixtures.mjs';
import { lifecycleNegativeExecutionHook } from '../intent/0108/execution-hooks.mjs';
import { makeLifecycleGraph } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { createLifecycleEventVerifier } from '../intent/0059/lifecycle-events.candidate.mjs';
import { createTimedRecordVerifier } from '../intent/0058/record-verifier.candidate.mjs';
import { loadRequiredCases } from '../intent/0098/required-cases.mjs';
import { runCorrectedCoverage } from '../intent/0098/execution-ledger.mjs';
import { jcs, sha256, TRUST_REGISTRY, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const mapping = JSON.parse(readFileSync(new URL('../intent/0108/SOURCE-MAP.json', import.meta.url))), cases = loadRequiredCases().cases.filter((row) => row.family === 'LIFECYCLE-GRAPH-NEGATIVE');

test('0108: every original negative ID is reconciled, with raw and reference cases explicitly left unmapped', () => {
  assert.deepEqual(mapping.rows.map((row) => row.kind).sort(), cases.map((row) => row.coordinate.kind).sort());
  assert.equal(mapping.rows.filter((row) => row.mapped).length, 27);
  const legacy = makeLifecycleGraph('RC-FAILED-RUN', 'complete'), distinct = new Set();
  for (const row of mapping.rows) {
    const required = cases.find((value) => value.coordinate.kind === row.kind), hook = lifecycleNegativeExecutionHook(required);
    if (!row.mapped) { assert.equal(hook, null); assert.throws(() => lifecycleNegativeExecutionCase(row.kind), /UNKNOWN_LIFECYCLE_NEGATIVE_CASE/); continue; }
    assert.ok(hook); assert.notEqual(makeLifecycleGraph('RC-FAILED-RUN', 'complete', row.kind), legacy, row.kind);
    const value = lifecycleNegativeExecutionCase(row.kind); assert.notEqual(value.input, lifecycleGraphExecutionCase().input);
    assert.ok(!distinct.has(sha256(value.input)), row.kind); distinct.add(sha256(value.input));
  }
  assert.equal(lifecycleNegativeExecutionHook({ family: 'unknown' }), null);
});

test('0108: every mapped failure executes a full positive before its exact retained-or-blocked outcome', () => {
  for (const required of cases) {
    const hook = lifecycleNegativeExecutionHook(required); if (!hook) continue;
    const rows = [];
    hook.run((input, invoke, expected) => { const actual = invoke(); rows.push(actual); for (const [key, value] of Object.entries(expected)) assert.deepEqual(actual[key], value); assert.deepEqual(actual.effects, zeroEffects()); });
    assert.equal(rows.length, 2); assert.equal(rows[0].state, 'validated-lifecycle-candidate'); assert.equal(rows[0].protectedActionCount, 3);
    assert.equal(rows[1].state, mapping.rows.find((row) => row.kind === required.coordinate.kind).expectedState);
    assert.throws(() => hook.run(() => { throw new Error('ASSERTION_FAILED'); }), /ASSERTION_FAILED/);
  }
});

test('0108: a valid ordered active hold reaches retention, while conflicting hold evidence is rejected', () => {
  const held = lifecycleNegativeExecutionCase('active-hold'), state = JSON.parse(held.graph.stateBytes);
  const verifier = createLifecycleEventVerifier(jcs(TRUST_REGISTRY));
  const envelope = jcs({ version: 'steer-r5-001-events/v1', policyDigest: verifier.policyDigest, scope: { organization: 'steer-platform', itemId: '0001-flight-deck-foundation', environmentId: null },
    eventBytes: held.graph.eventBytes, historyBytes: held.graph.historyBytes, evaluationTime: held.evaluationTime });
  assert.equal(verifier.verify(envelope, held.evaluationTime).state, 'validated-trigger');
  assert.equal(JSON.parse(held.graph.eventBytes).eventType, 'hold-applied'); assert.equal(state.holdState, 'active');
  assert.equal(state.historyDigest, sha256(jcs([...held.graph.historyBytes, held.graph.eventBytes])));
  assert.equal(held.verifier.verify(held.bytes, held.evaluationTime).state, 'retained-on-hold');
  const conflict = lifecycleNegativeExecutionCase('hold-conflict'); assert.equal(JSON.parse(conflict.graph.stateBytes).holdState, 'overlapping');
  assert.equal(conflict.verifier.verify(conflict.bytes, conflict.evaluationTime).state, 'blocked');
});

test('0108: signed stale/partial/selector/aggregate evidence and ordinary-domain impostors remain distinguishable', () => {
  const verifier = createTimedRecordVerifier(jcs(TRUST_REGISTRY));
  for (const [kind, field, domain] of [['stale-inventory', 'inventoryBytes', 'provider'], ['provider-partial', 'receiptBytes', 'provider-a'], ['aggregate-missing', 'aggregateBytes', 'provider']]) {
    const value = lifecycleNegativeExecutionCase(kind), bytes = field === 'receiptBytes' ? value.graph.copies[0][field] : value.graph[field], record = JSON.parse(bytes);
    assert.equal(verifier.verifyBytes(bytes, { domain, recordedAt: record.recordedAt, evaluatedAt: value.evaluationTime }).record.recordDigest, record.recordDigest);
    assert.equal(value.verifier.verify(value.bytes, value.evaluationTime).state, 'blocked');
  }
  for (const [kind, field, expected] of [['provider-wrong-copy', 'copyId', 'other-copy'], ['tuple-key-mismatch', 'keyId', 'other-key']]) {
    const value = lifecycleNegativeExecutionCase(kind), bundle = JSON.parse(value.graph.copies[0].actionBundleBytes), resources = JSON.parse(bundle.resourcesBytes);
    assert.equal(resources.resources[field], expected); assert.equal(JSON.parse(bundle.requestBytes).resourcesDigest, resources.recordDigest);
    assert.equal(verifier.verifyBytes(bundle.resourcesBytes, { domain: 'provider-a', recordedAt: resources.recordedAt, evaluatedAt: value.evaluationTime }).record.recordDigest, resources.recordDigest);
  }
  for (const kind of ['ordinary-replay', 'local-signer-receipt']) {
    const value = lifecycleNegativeExecutionCase(kind), bytes = kind === 'ordinary-replay' ? JSON.parse(value.graph.copies[0].actionBundleBytes).replayBytes : value.graph.copies[0].receiptBytes, record = JSON.parse(bytes);
    assert.equal(record.signature.keyId, 'record-key-v1'); assert.equal(verifier.verifyBytes(bytes, { domain: 'record', recordedAt: record.recordedAt, evaluatedAt: value.evaluationTime }).record.recordDigest, record.recordDigest);
    assert.equal(value.verifier.verify(value.bytes, value.evaluationTime).state, 'blocked');
  }
});

test('0108: inventory races, receipt reuse and aggregate omission preserve distinct concrete hostile inputs', () => {
  const positive = lifecycleGraphExecutionCase(), oldState = JSON.parse(positive.graph.stateBytes);
  for (const kind of ['restored-race', 'copy-missing', 'copy-duplicate', 'copy-extra']) {
    const value = lifecycleNegativeExecutionCase(kind), inventory = JSON.parse(value.graph.inventoryBytes);
    assert.equal(value.graph.stateBytes, positive.graph.stateBytes); assert.notEqual(inventory.recordDigest, oldState.inventoryDigest);
    assert.deepEqual(value.graph.copies, positive.graph.copies);
  }
  assert.deepEqual(JSON.parse(lifecycleNegativeExecutionCase('aggregate-missing').graph.aggregateBytes).receiptDigests, []);
  assert.equal(lifecycleNegativeExecutionCase('crash-before-aggregate').graph.aggregateBytes, '');
  const reused = lifecycleNegativeExecutionCase('request-reused'); assert.equal(reused.graph.copies[0].actionBundleBytes, reused.graph.copies[1].actionBundleBytes);
  const duplicate = lifecycleNegativeExecutionCase('receipt-duplicate'); assert.equal(duplicate.graph.copies[0].receiptBytes, duplicate.graph.copies[1].receiptBytes);
  const registry = lifecycleNegativeExecutionCase('provider-registry-substitution'); assert.equal(JSON.parse(registry.graph.providerKeyRegistryBytes).bindings[0].publicKeyHex, 'f'.repeat(64));
  assert.equal(registry.configBytes, positive.configBytes); assert.ok(mapping.rows.find((row) => row.kind === 'provider-registry-substitution').construction.includes('closed-envelope'));
});

test('0108: exactly 27 negative IDs have fresh execution seals without claiming class boundaries or formal closure', () => {
  const report = runCorrectedCoverage(); assert.equal(report.executed, 341); assert.equal(report.passed, 341); assert.equal(report.failed, 0); assert.equal(report.uncovered, 3695);
  assert.deepEqual(report.families['LIFECYCLE-GRAPH-NEGATIVE'], { required: 30, executed: 30, passed: 30, failed: 0, uncovered: 0 });
  assert.equal(report.families['LIFECYCLE-GRAPH'].executed, 0); assert.equal(report.families.MIGRATION.executed, 0); assert.equal(report.families.R5.passed, 9);
  for (const row of report.executions.filter((entry) => entry.id.startsWith('LIFECYCLE-GRAPH-NEGATIVE:') && mapping.rows.some((source) => source.mapped && entry.id.endsWith(':' + source.kind)))) assert.equal(row.observationCount, 2);
  for (const flag of ['completeCoverage', 'normativeAcceptanceComplete', 'independentAcceptance', 'executionAuthorized', 'liveProviderUsed']) assert.equal(report[flag], false);
  assert.deepEqual(JSON.parse(readFileSync(new URL('../intent/0109/QUICK-EXECUTION-REPORT.json', import.meta.url))), report);
});
