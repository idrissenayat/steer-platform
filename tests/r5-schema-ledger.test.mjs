import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { schemaExecutionInputs, schemaExecutionHook } from '../intent/0103/execution-hooks.mjs';
import { loadRequiredCases, digest } from '../intent/0098/required-cases.mjs';
import { runCorrectedCoverage } from '../intent/0098/execution-ledger.mjs';
import { schemaRegistry, bundleSchema } from '../intent/0001/reviews/domain/round-3/remediation/offline-schema-registry.candidate.mjs';
import { makeLifecycleEventBytes, mutateLifecycleEventBytes, makeHumanAuthorityBundle, makeCostGraph, makeRecoveryEvidence } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { jcs, sha256 } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const cases = loadRequiredCases().cases, rows = cases.filter((row) => row.family === 'SCHEMA');

test('0103: the schema map preserves all 15 exact sources and separates precision, retained and obsolete versions', () => {
  const map = JSON.parse(readFileSync(new URL('../intent/0103/SCHEMA-MAP.json', import.meta.url)));
  assert.deepEqual(map.schemas.map((row) => row.requiredId), rows.map((row) => row.id));
  for (const row of map.schemas) {
    const bytes = readFileSync(new URL('../' + row.sourcePath, import.meta.url), 'utf8'), source = JSON.parse(bytes);
    assert.equal(row.sourceDigest, digest(bytes)); assert.equal(row.sourceSchemaId, source.$id);
    assert.equal(row.sourceVersion, source.properties?.version?.const ?? null); assert.equal(row.semanticAcceptance, false);
    assert.equal(row.executor, schemaExecutionHook(rows.find((value) => value.id === row.requiredId))?.executor ?? null);
  }
  assert.equal(map.schemas.filter((row) => row.status === 'mapped-precision-structure').length, 3);
  assert.equal(map.schemas.filter((row) => row.status === 'mapped-retained-structure').length, 11);
  assert.deepEqual(map.schemas.filter((row) => row.status === 'unmapped-obsolete-graph').map((row) => row.name), ['MIGRATION-EVIDENCE']);
  assert.equal(map.normativeAcceptanceComplete, false);
});

function observe(row) {
  const observations = [];
  schemaExecutionHook(row).run((input, invoke, expected) => {
    const value = invoke(); for (const [key, result] of Object.entries(expected)) assert.deepEqual(value[key], result, row.id);
    observations.push({ input: JSON.parse(input), value });
  }); return observations;
}

test('0103: 14 exact schema cases execute actual validators with closed-shape positives and negatives; obsolete migration stays unmapped', () => {
  assert.equal(rows.length, 15); let mapped = 0;
  for (const row of rows) {
    if (row.coordinate.kind === 'MIGRATION-EVIDENCE') { assert.equal(schemaExecutionHook(row), null); continue; }
    mapped++; const observations = observe(row), fields = schemaExecutionInputs(row.coordinate.kind);
    assert.equal(observations[0].value.type, 'object'); assert.equal(observations[0].value.additionalProperties, false);
    assert.deepEqual(observations[1].input.value, fields.positive); assert.deepEqual(observations[1].value.errors, []);
    fields.negatives.forEach((value, index) => {
      assert.deepEqual(observations[2 + index].input.value, value); assert.equal(observations[2 + index].value.valid, false);
      assert.ok(observations[2 + index].value.errors.length > 0);
    });
    const name = row.coordinate.kind + '.schema.json';
    for (const value of observations) assert.equal(value.input.bundledSourceDigest, sha256(jcs(bundleSchema(name))));
  }
  assert.equal(mapped, 14);
});

test('0103: original selected fixture bytes and composed raw grant negatives are preserved', () => {
  assert.deepEqual(schemaExecutionInputs('LIFECYCLE-EVENT').positive, JSON.parse(makeLifecycleEventBytes('record-committed', 150)));
  assert.deepEqual(schemaExecutionInputs('LIFECYCLE-EVENT').negatives[0], JSON.parse(mutateLifecycleEventBytes(makeLifecycleEventBytes('record-committed', 151), 'missing-record-sha')));
  assert.deepEqual(schemaExecutionInputs('HUMAN-AUTHORITY').positive, JSON.parse(makeHumanAuthorityBundle().authorityBytes));
  assert.deepEqual(schemaExecutionInputs('PROVIDER-RECOVERY').positive, JSON.parse(makeRecoveryEvidence()));
  assert.deepEqual(schemaExecutionInputs('COST-EVIDENCE').positive, JSON.parse(JSON.parse(makeCostGraph('invoice-at-close')).recordsBytes[0]));
  const raw = schemaExecutionInputs('RAW-POLICY-GRANT'); assert.deepEqual(raw.positive.authority, schemaExecutionInputs('HUMAN-AUTHORITY').positive);
  assert.equal(raw.negatives[0].authority, null); assert.equal(raw.negatives[1].recordClass, 'RC-DECISION-PROOF');
});

test('0103: precise schemas cover every declared human/event field without altering frozen schemas or claiming copied signatures valid', () => {
  const before = JSON.stringify([...schemaRegistry()]);
  for (const name of ['LIFECYCLE-EVENT', 'HUMAN-AUTHORITY', 'RAW-POLICY-GRANT']) {
    const row = rows.find((row) => row.coordinate.kind === name), values = observe(row), initial = schemaExecutionInputs(name);
    assert.ok(schemaExecutionHook(row).executor.startsWith('intent/0070/')); assert.ok(schemaExecutionHook(row).scope.includes('signature validity'));
    const precision = values.slice(2 + initial.negatives.length);
    assert.equal(precision.length, name === 'LIFECYCLE-EVENT' ? 4 : 24);
    for (const [index, record] of precision.entries()) assert.equal(record.value.valid, index % 4 === 0);
  }
  assert.equal(JSON.stringify([...schemaRegistry()]), before);
});

test('0103: fractional detector-policy thresholds retain their actual JSON numbers in input evidence', () => {
  const row = rows.find((row) => row.coordinate.kind === 'PRIVACY-DETECTOR-REGISTRY'), values = observe(row);
  const original = JSON.parse(readFileSync(new URL('../intent/0001/reviews/domain/round-3/remediation/PRIVACY-DETECTOR-REGISTRY.candidate.json', import.meta.url)));
  assert.deepEqual(values[1].input.value, original); assert.equal(values[1].value.valid, true);
  assert.equal(typeof values[1].input.value.linkage.top1Maximum, 'number'); assert.ok(!Number.isInteger(original.linkage.top1Maximum));
});

test('0103: structural evidence remains distinct from complete semantic coverage, and failed assertions cannot count', () => {
  assert.equal(schemaExecutionHook({ family: 'unknown', id: 'unknown' }), null);
  assert.throws(() => schemaExecutionInputs('MIGRATION-EVIDENCE'), /UNMAPPED_SCHEMA_CASE/);
  assert.throws(() => schemaExecutionHook(rows[0]).run(() => { throw new Error('ASSERTION_FAILED'); }), /ASSERTION_FAILED/);
  const report = runCorrectedCoverage(); assert.equal(report.executed, 377); assert.equal(report.uncovered, 3659);
  assert.equal(report.families.SCHEMA.executed, 14); assert.equal(report.families.SCHEMA.uncovered, 1); assert.equal(report.families.ACCESSIBILITY.uncovered, 16);
  assert.ok(report.limitations.some((value) => value.includes('obsolete migration schema')));
  assert.equal(report.normativeAcceptanceComplete, false); assert.equal(report.completeCoverage, false);
  const source = report.supplementalHookSources.find((row) => row.path === 'intent/0103/execution-hooks.mjs');
  assert.equal(source.digest, digest(readFileSync(new URL('../intent/0103/execution-hooks.mjs', import.meta.url))));
});
