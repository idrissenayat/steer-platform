import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from '@babel/parser';
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const json = (path) => JSON.parse(read(path));
const base = 'intent/0001/reviews/domain/round-3/remediation/';
const inventory = json('intent/0097/GAP-INVENTORY.json'), normative = json(`${base}NORMATIVE-EXECUTION-INVENTORY.candidate.json`);
const body = (path) => parse(read(path), { sourceType: 'module' }).program.body;

test('0097: gap inventory preserves exact frozen sources, all five current findings and fourteen historical finding IDs', () => {
  assert.equal(inventory.version, 'steer-r5-gap-inventory/v1'); assert.equal(inventory.status, 'planning-traceability-not-acceptance');
  assert.equal(new Set(inventory.sources.map((source) => source.path)).size, 7);
  assert.deepEqual(inventory.sources.map((source) => source.path).sort(), [
    `${base}preflight-critic-r5.json`, `${base}NORMATIVE-EXECUTION-INVENTORY.candidate.json`, `${base}LIFECYCLE-POLICY-TABLE.candidate.json`,
    `${base}finding-resolution.json`, `${base}EXAM-AMENDMENT.candidate.md`, 'intent/0001/EXAM.md',
    'intent/0001/reviews/domain/round-2/remediation/RETENTION-AND-RECORDS-POLICY.candidate.md',
  ].sort());
  for (const source of inventory.sources) assert.equal(createHash('sha256').update(read(source.path)).digest('hex'), source.sha256, source.path);
  const critic = json(`${base}preflight-critic-r5.json`);
  assert.deepEqual(inventory.findings.map(({ id, severity, requiredFix, sourceFindingIds }) => ({ id, severity, requiredFix, affectedSourceFindings: sourceFindingIds })),
    critic.findings.map(({ id, severity, requiredFix, affectedSourceFindings }) => ({ id, severity, requiredFix, affectedSourceFindings })));
  assert.ok(inventory.findings.every((finding) => finding.status === 'open'));
  assert.deepEqual(inventory.legacyFindingIds, json(`${base}finding-resolution.json`).findings.map((finding) => finding.id));
  assert.equal(inventory.legacyFindingIds.length, 14);
});

test('0097: every evidence pointer names an actual candidate function and an executable regression test', () => {
  const ids = new Set(inventory.evidence.map((entry) => entry.id)); assert.equal(ids.size, inventory.evidence.length);
  for (const entry of inventory.evidence) {
    const functions = body(entry.path).filter((node) => node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'FunctionDeclaration').map((node) => node.declaration.id.name);
    const tests = body(entry.testPath).filter((node) => node.type === 'ExpressionStatement' && node.expression.type === 'CallExpression' && node.expression.callee.name === 'test')
      .map((node) => node.expression.arguments[0]?.value);
    assert.ok(functions.includes(entry.entryPoint), entry.path); assert.ok(tests.includes(entry.testName), entry.testName);
    assert.equal(entry.evidenceLevel, 'synthetic-development-regression');
  }
  for (const finding of inventory.findings) for (const reference of finding.evidenceRefs) assert.ok(ids.has(reference));
  for (const row of inventory.lifecycleClasses) assert.ok(ids.has(row.selectionEvidenceRef));
  for (const reference of inventory.migration.evidenceRefs) assert.ok(ids.has(reference));
});

test('0097: all sixteen classes retain explicit selection versus current-registry admission and unresolved boundary coverage', () => {
  const classes = json(`${base}LIFECYCLE-POLICY-TABLE.candidate.json`).classes;
  assert.deepEqual(inventory.lifecycleClasses.map(({ classId, sourceDuration }) => ({ classId, duration: sourceDuration })), classes.map(({ classId, duration }) => ({ classId, duration })));
  const runtime = body('intent/0080/lifecycle-runtime.candidate.mjs');
  const declaration = runtime.flatMap((node) => node.type === 'VariableDeclaration' ? node.declarations : []).find((node) => node.id.name === 'supportedClasses');
  const supported = declaration.init.arguments[0].elements.map((node) => node.value);
  assert.match(read('intent/0080/lifecycle-runtime.candidate.mjs'), /supportedClasses: reference \? \['RC-REFERENCED-EVIDENCE'\] : supportedClasses/);
  for (const row of inventory.lifecycleClasses) {
    assert.equal(row.futureRegistryProfile, row.classId === 'RC-AUTHORITATIVE-ARTIFACT' ? 'not-applicable-immutable' :
      supported.includes(row.classId) ? 'current-v1-through-v4' : row.classId === 'RC-REFERENCED-EVIDENCE' ? 'current-v5' : 'not-admitted');
    assert.equal(row.fullBoundaryMatrix, 'not-reconciled');
  }
  assert.equal(inventory.lifecycleClasses.filter((row) => row.futureRegistryProfile === 'not-admitted').length, 10);
  assert.equal(inventory.policyCorrections[0].classId, 'RC-CORPUS-PROVENANCE');
  assert.match(read(inventory.policyCorrections[0].spec), /Item closure is not a substitute/);
});

test('0097: declared migration coordinates and recovery cuts remain exact without inventing corrected execution coverage', () => {
  assert.deepEqual(inventory.migration.sourceDimensions, normative.dimensions.migrationMatrix);
  const count = inventory.migration.cartesianAxes.reduce((total, axis) => total * normative.dimensions.migrationMatrix[axis].length, 1);
  assert.equal(count, 3600); assert.equal(inventory.migration.declaredCartesianCount, count);
  assert.equal(inventory.migration.declaredAdditionalCount, normative.dimensions.migrationMatrix.failureCases.length + normative.dimensions.migrationMatrix.transplantCases.length);
  assert.equal(inventory.migration.correctedExactIdCoverage, 'not-reconciled'); assert.equal(inventory.migration.correctedExecutedIdCount, null);
  assert.equal(inventory.migration.liveConcurrencyVerified, false);
  assert.deepEqual(inventory.recovery.cuts.map((row) => row.cut), normative.dimensions.recoveryCuts);
  assert.deepEqual(inventory.recovery.corruptions, normative.dimensions.recoveryCorruptions);
  assert.deepEqual(inventory.recovery.cuts.map((row) => row.expectedCompleteEvidenceOutcome), [
    'UNKNOWN_RECONCILE_PROVIDER', 'UNKNOWN_RECONCILE_PROVIDER', ...Array(6).fill('RECOVERY_VERIFIED'),
  ]);
  assert.equal(inventory.recovery.rowBound, 4); assert.equal(inventory.recovery.liveRecoveryVerified, false);
});

test('0097: finite dependency-ordered work packages and non-approval claims cannot silently become completion', () => {
  assert.equal(inventory.workPackages.length, 6); const visited = new Set();
  for (const item of inventory.workPackages) {
    assert.ok(!visited.has(item.id)); assert.ok(item.dependsOn.every((id) => visited.has(id))); visited.add(item.id);
    assert.equal(item.status, 'open'); for (const key of ['title', 'scope', 'doneWhen', 'boundary']) assert.ok(typeof item[key] === 'string' && item[key].length > 0);
  }
  assert.equal(inventory.nextWorkPackage, inventory.workPackages[0].id);
  assert.equal(json(inventory.publicOracleInventory).oracles.length, 10);
  assert.deepEqual(inventory.claims, { formalFindingsClosed: 0, independentAcceptance: false, protectedIncorporation: false,
    gateTwoApproved: false, phaseOneComplete: false, liveIntegrationVerified: false, executionAuthorized: false });
});
