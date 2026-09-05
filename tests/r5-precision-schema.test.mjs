import assert from 'node:assert/strict';
import test from 'node:test';
import { compilePreciseSchema, schemaPolicyDigest } from '../intent/0070/precision-schemas.candidate.mjs';
import { compileOffline, schemaRegistry } from '../intent/0001/reviews/domain/round-3/remediation/offline-schema-registry.candidate.mjs';
import { makeHumanAuthorityBundle, makeLifecycleEventBytes } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { jcs, sha256 } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';

test('0070: explicit precision schemas preserve closed shape and frozen schemas remain whole-second', () => {
  const human = JSON.parse(makeHumanAuthorityBundle().authorityBytes), event = JSON.parse(makeLifecycleEventBytes('record-committed'));
  const before = sha256(jcs([...schemaRegistry()]));
  for (const [name, value, field] of [['HUMAN-AUTHORITY.schema.json', human, 'decidedAt'], ['LIFECYCLE-EVENT.schema.json', event, 'occurredAt']]) {
    const precise = compilePreciseSchema(name), original = compileOffline(name), changed = { ...value, [field]: '2026-09-04T12:00:00.000000001Z' };
    assert.deepEqual(precise(value), []); assert.deepEqual(precise(changed), []);
    assert.ok(original(changed).length); // no mutation of the frozen validator
    assert.ok(precise({ ...changed, unexpected: true }).length);
    for (const invalid of ['2026-02-29T12:00:00.000000001Z', '2026-09-04T12:00:00.1Z', '2026-09-04T24:00:00.000000001Z'])
      assert.ok(precise({ ...changed, [field]: invalid }).length);
  }
  assert.equal(sha256(jcs([...schemaRegistry()])), before);
  assert.match(schemaPolicyDigest, /^[0-9a-f]{64}$/);
  assert.throws(() => compilePreciseSchema('caller-selected.schema.json'), /^Error: PRECISION_SCHEMA_INVALID$/);
});

test('0070: all six declared human timestamps and the embedded raw authority receive exact date validation', () => {
  const authority = JSON.parse(makeHumanAuthorityBundle().authorityBytes);
  const fields = ['authenticatedAt', 'decidedAt', 'validFrom', 'expiresAt', 'qualificationValidThrough', 'assignmentValidThrough'];
  const grant = { version: 'steer-raw-policy-grant/v4', authority, recordClass: 'RC-CORPUS-RAW-WORKING', sanitizerRevision: 'v1', inspectorRevision: 'v1', completeInventoryRequired: true, receiptRequired: true, permittedTargetKind: 'temporary-copy-only' };
  for (const field of fields) {
    const fractional = { ...authority, [field]: '2026-09-04T12:00:00.000000001Z' };
    assert.deepEqual(compilePreciseSchema('HUMAN-AUTHORITY.schema.json')(fractional), []);
    assert.deepEqual(compilePreciseSchema('RAW-POLICY-GRANT.schema.json')({ ...grant, authority: fractional }), []);
    const invalid = { ...authority, [field]: '2026-02-29T12:00:00.000000001Z' };
    assert.ok(compilePreciseSchema('HUMAN-AUTHORITY.schema.json')(invalid).length);
    assert.ok(compilePreciseSchema('RAW-POLICY-GRANT.schema.json')({ ...grant, authority: invalid }).length);
  }
  // Shape/time verification alone does not validate these copied signatures.
});
