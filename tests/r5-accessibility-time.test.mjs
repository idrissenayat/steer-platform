import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { createAccessibilityTimeVerifier, policyDigest } from '../intent/0067/accessibility-time.candidate.mjs';
import { makeAccessibilityBundle } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { accessibilityMatrixProof } from '../intent/0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { jcs, sha256, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const now = '2026-09-04T12:03:00Z';
// Only synthetic fixture signers; these are not human accessibility findings.
function seal(input, domain) {
  const key = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), createHash('sha256').update(`steer-r3-r1-${domain}`).digest()]), format: 'der', type: 'pkcs8' });
  const record = Object.fromEntries(Object.entries(input).filter(([key]) => !['recordDigest', 'signature'].includes(key))), digest = sha256(jcs(record));
  return { ...record, recordDigest: digest, signature: { algorithm: 'Ed25519', keyId: `${domain}-key-v1`, signedDigest: digest, valueBase64: sign(null, Buffer.from(digest), key).toString('base64') } };
}
function wrap(bundle) {
  const { rows, evaluationTime, ...metadata } = bundle;
  return jcs({ version: 'steer-accessibility-time/v1', policyDigest, metadataBytes: jcs(metadata) });
}
const verifier = (evaluatedAt = now) => createAccessibilityTimeVerifier(jcs({ version: 'steer-audit-clock/v1', evaluatedAt }));
const denied = (value) => assert.deepEqual(value, { valid: false, error: 'ACCESSIBILITY_TIME_INVALID', rowCount: 0, digest: null,
  effects: zeroEffects(), executionAuthorized: false, manualAuditComplete: false });

test('complete synthetic matrix and all 16 original cases are checked, never reported as a manual audit', () => {
  const controls = JSON.parse(readFileSync(new URL('../intent/0001/reviews/domain/round-3/remediation/CONTROL-FIXTURES.candidate.json', import.meta.url)));
  assert.equal(controls.accessibilityKinds.length, 16);
  for (const kind of controls.accessibilityKinds) {
    const bundle = makeAccessibilityBundle(kind), input = wrap(bundle), result = verifier().verify(input, bundle.rows);
    if (kind === 'positive') {
      assert.equal(result.valid, true); assert.equal(result.rawRowCount, 32900); assert.equal(result.rowCount, 2664900);
      assert.equal(result.digest, JSON.parse(bundle.summaryBytes).rawRowsDigest); assert.equal(result.timedRecordCount, 6); assert.equal(result.observedAsOfCount, 2);
      assert.equal(result.manualAuditComplete, false); assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects());
    } else denied(result);
    assert.equal(wrap(bundle), input, 'Signed metadata remains unchanged.');
  }
});

test('pre-key human-provider proof is accepted by frozen full matrix but denied before any rows are consumed', () => {
  const bundle = makeAccessibilityBundle();
  bundle.providerProofBytes = jcs(seal({ ...JSON.parse(bundle.providerProofBytes), recordedAt: '2026-08-31T23:59:59Z' }, 'human-provider'));
  assert.equal(accessibilityMatrixProof(bundle).valid, true, 'Exercise the actual complete frozen matrix, not a stub.');
  let pulled = 0;
  const rows = { *[Symbol.iterator]() { pulled++; throw new Error('private fixture content'); } };
  denied(verifier().verify(wrap(bundle), rows)); assert.equal(pulled, 0);
});

test('all signatures, native proof times, currentness and independent anchor bindings fail before row work', () => {
  const slots = [['summaryBytes', 'summary', 'signedAt'], ['identityBytes', 'provider', 'verifiedAt'], ['qualificationBytes', 'provider', null],
    ['assignmentBytes', 'assignment', null], ['batchProofBytes', 'summary', 'sealedAt'], ['providerProofBytes', 'human-provider', 'recordedAt']];
  let pulls = 0; const rows = { *[Symbol.iterator]() { pulls++; throw new Error('private fixture content'); } };
  for (const [key, domain, field] of slots) {
    const bundle = makeAccessibilityBundle(), record = JSON.parse(bundle[key]); record.signature.valueBase64 = Buffer.alloc(64).toString('base64'); bundle[key] = jcs(record);
    denied(verifier().verify(wrap(bundle), rows));
    if (field !== null) for (const at of ['2026-08-31T23:59:59Z', '2026-09-04T12:03:01Z', 'bad']) {
      const value = makeAccessibilityBundle(); value[key] = jcs(seal({ ...JSON.parse(value[key]), [field]: at }, domain)); denied(verifier().verify(wrap(value), rows));
    }
  }
  const bundle = makeAccessibilityBundle();
  for (const at of ['2026-09-04T12:02:19Z', '2026-09-05T00:00:00Z', '2027-09-01T00:00:00Z']) denied(verifier(at).verify(wrap(bundle), rows));
  for (const domain of ['summary', 'provider', 'assignment']) {
    const value = makeAccessibilityBundle(); value.providerProofBytes = jcs(seal(JSON.parse(value.providerProofBytes), domain)); denied(verifier().verify(wrap(value), rows));
  }
  assert.equal(pulls, 0);
});

test('every row is bounded by identity, assignment, qualification and signing time, with iterator cleanup on denial', () => {
  const edits = [(row) => { row.startedAt = '2026-09-04T10:59:59Z'; }, (row) => { row.endedAt = '2026-09-04T12:02:01Z'; },
    (row) => { row.startedAt = 'bad'; }, (row) => { row.endedAt = row.startedAt; }];
  for (const edit of edits) {
    const bundle = makeAccessibilityBundle(); let pulls = 0, closed = false;
    const rows = { *[Symbol.iterator]() { try { for (const bytes of bundle.rows) { pulls++; const row = JSON.parse(bytes); edit(row); yield jcs(row); } } finally { closed = true; } } };
    denied(verifier().verify(wrap(bundle), rows)); assert.equal(pulls, 1); assert.equal(closed, true);
  }
  const bundle = makeAccessibilityBundle();
  for (const rows of [[], ['x'.repeat(16385)], { *[Symbol.iterator]() { throw new Error('do not echo private fixture evidence'); } }]) denied(verifier().verify(wrap(bundle), rows));
});

test('closed clock/metadata envelope has no unsigned evaluation override or permissive iterator fallback', () => {
  for (const context of [null, '{}', jcs({ version: 'steer-audit-clock/v1', evaluatedAt: 'bad' }), jcs({ version: 'steer-audit-clock/v1', evaluatedAt: now, registry: {} })])
    assert.throws(() => createAccessibilityTimeVerifier(context), /ACCESSIBILITY_TIME_CONTEXT_INVALID/);
  const bundle = makeAccessibilityBundle(), valid = wrap(bundle), input = JSON.parse(valid), metadata = JSON.parse(input.metadataBytes);
  metadata.evaluationTime = now;
  for (const source of [null, {}, valid + ' ', 'x'.repeat(262145), jcs({ ...input, policyDigest: 'f'.repeat(64) }), jcs({ ...input, metadataBytes: jcs(metadata) })]) denied(verifier().verify(source, []));
  for (const rows of [null, 'not rows', {}, { async *[Symbol.asyncIterator]() { yield 'not rows'; } }]) denied(verifier().verify(valid, rows));
});
