// Required IDs are derived independently of available execution hooks.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../../', import.meta.url), base = 'intent/0001/reviews/domain/round-3/remediation/';
const read = (path) => readFileSync(new URL(path, root), 'utf8');
export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function loadRequiredCases() {
  const pins = JSON.parse(read('intent/0098/SOURCE-PINS.json')), files = new Map();
  assert.equal(pins.version, 'steer-corrected-coverage-sources/v1');
  for (const source of pins.sources) {
    assert.ok(source.path.startsWith(base) && !source.path.split('/').includes('..') && !files.has(source.path));
    const bytes = read(source.path); assert.equal(digest(bytes), source.sha256, `COVERAGE_SOURCE_DRIFT:${source.path}`); files.set(source.path, bytes);
  }
  const json = (name) => JSON.parse(files.get(base + name)), normative = json('NORMATIVE-EXECUTION-INVENTORY.candidate.json'), dimensions = normative.dimensions;
  assert.equal(digest(read('intent/0001/EXAM.md')), normative.sourceExamSha256);
  assert.equal(digest(read(normative.retentionPolicyPath)), normative.retentionPolicySha256);
  const cases = [], ids = new Set();
  const add = (id, family, coordinate, source = 'legacy') => {
    assert.ok(!ids.has(id), `DUPLICATE_REQUIRED_CASE:${id}`); ids.add(id); cases.push({ id, family, coordinate, source });
  };
  const rows = (key, prefix) => { for (const kind of dimensions[key]) add(`${prefix}:${kind}`, prefix, { kind }); };
  rows('privateSigningDomains', 'TRUST-DOMAIN-FORGERY'); rows('authorizationKinds', 'AUTHORIZATION'); rows('privacyGraphKinds', 'PRIVACY-GRAPH');
  for (const row of dimensions.privacyIdentifierCases) add(`PRIVACY-IDENTIFIER:${row.id}`, 'PRIVACY-IDENTIFIER', row);
  for (const row of json('PRIVACY-DETECTOR-CASES.candidate.json').cases) add(`PRIVACY-DETECTOR:${row.id}`, 'PRIVACY-DETECTOR', row);
  rows('accessibilityKinds', 'ACCESSIBILITY');
  for (const type of json('schemas/LIFECYCLE-EVENT.schema.json').properties.eventType.enum) add(`LIFECYCLE:${type}:positive`, 'LIFECYCLE', { type });
  rows('lifecycleNegativeKinds', 'LIFECYCLE-NEGATIVE');
  for (const row of json('LIFECYCLE-POLICY-TABLE.candidate.json').classes) for (const boundary of dimensions.lifecycleGraphBoundaries)
    add(`LIFECYCLE-GRAPH:${row.classId}:${boundary}`, 'LIFECYCLE-GRAPH', { classId: row.classId, boundary });
  rows('lifecycleGraphNegativeKinds', 'LIFECYCLE-GRAPH-NEGATIVE'); rows('humanAuthorityKinds', 'HUMAN-AUTHORITY');
  const matrix = dimensions.migrationMatrix;
  for (const version of matrix.versions) for (const phase of matrix.phases) for (const interleaving of matrix.interleavings)
    for (const interruption of matrix.interruptions) for (const rollback of matrix.rollbacks) for (const idempotency of matrix.idempotency)
      add(`MIGRATION:${version}:${phase}:${interleaving}:${interruption}:${rollback}:${idempotency}`, 'MIGRATION', { version, phase, interleaving, interruption, rollback, idempotency });
  for (const kind of matrix.failureCases) add(`MIGRATION-FAILURE:${kind}`, 'MIGRATION-FAILURE', { kind });
  for (const kind of matrix.transplantCases) add(`MIGRATION-TRANSPLANT:${kind}`, 'MIGRATION-TRANSPLANT', { kind });
  rows('recoveryCuts', 'RECOVERY-CUT'); rows('recoveryCorruptions', 'RECOVERY-CORRUPTION'); rows('spendKinds', 'SPEND'); rows('costKinds', 'COST'); rows('schemaCases', 'SCHEMA');
  assert.equal(cases.length, 4027, 'LEGACY_REQUIRED_CASE_SET_DRIFT');
  for (const finding of json('preflight-critic-r5.json').findings) {
    const reproductions = finding.reproductions ?? [finding.reproduction]; assert.ok(reproductions.length > 0);
    for (const [index, reproduction] of reproductions.entries()) {
      assert.ok(reproduction && typeof reproduction.case === 'string' && typeof reproduction.expected === 'string');
      add(`R5:${finding.id}:reproduction:${index + 1}`, 'R5', { findingId: finding.id, ordinal: index + 1, reproduction }, 'R5');
    }
  }
  assert.equal(cases.length, 4036, 'R5_REQUIRED_CASE_SET_DRIFT');
  return { version: 'steer-corrected-required-cases/v1', cases, catalogDigest: digest(JSON.stringify(cases)), sourcePinsDigest: digest(JSON.stringify(pins)),
    baselineRevision: pins.baselineRevision, sources: pins.sources };
}
