import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { correctedHumanAuthorityDecision as corrected, correctionPolicyDigest, humanAuthorityBindingDigest } from '../intent/0058/human-authority.candidate.mjs';
import { createTimedRecordVerifier } from '../intent/0058/record-verifier.candidate.mjs';
import { makeHumanAuthorityBundle, mutateHumanAuthorityBundle } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { humanAuthorityDecision as frozen } from '../intent/0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { jcs, sha256, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';

// Only synthetic test anchors; no real/provider key is loaded or exported.
const keys = new Map();
function seal(record, domain) {
  if (!keys.has(domain)) keys.set(domain, createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'),
    createHash('sha256').update(`steer-r3-r1-${domain}`).digest()]), format: 'der', type: 'pkcs8' }));
  const payload = Object.fromEntries(Object.entries(record).filter(([field]) => !['recordDigest', 'signature'].includes(field)));
  const digest = sha256(jcs(payload));
  return { ...payload, recordDigest: digest, signature: { algorithm: 'Ed25519', keyId: `${domain}-key-v1`, signedDigest: digest,
    valueBase64: sign(null, Buffer.from(digest), keys.get(domain)).toString('base64') } };
}
function replaceAuthority(bundle, authority) {
  const signed = seal(authority, 'authority'); bundle.authorityBytes = jcs(signed);
  bundle.casReservationBytes = jcs(seal({ ...JSON.parse(bundle.casReservationBytes), authorityDigest: signed.recordDigest,
    requestDigest: signed.recordDigest, idempotencyKey: signed.idempotencyKey, expectedHead: signed.casHead }, 'cas-authority'));
}
function fullBinding(bundle = makeHumanAuthorityBundle()) {
  const copy = structuredClone(bundle), authority = JSON.parse(copy.authorityBytes), provider = JSON.parse(copy.providerProofBytes);
  const proof = seal({ ...provider, authorityBindingDigest: humanAuthorityBindingDigest(authority) }, 'human-provider');
  copy.providerProofBytes = jcs(proof); replaceAuthority(copy, { ...authority, providerProofDigest: proof.recordDigest }); return copy;
}
const envelope = (bundle) => jcs({ version: 'steer-r5-002-human/v1', policyDigest: correctionPolicyDigest, bundleBytes: jcs(bundle) });
const registry = () => JSON.parse(readFileSync(new URL('../intent/0001/reviews/domain/round-3/remediation/TRUST-REGISTRY.candidate.json', import.meta.url)));

test('R5-002: wrong-session and pre-key provider proofs reach frozen ALLOW but deny in the successor', () => {
  const original = makeHumanAuthorityBundle();
  const wrongSession = structuredClone(original); replaceAuthority(wrongSession, { ...JSON.parse(wrongSession.authorityBytes), sessionId: 'substituted-session' });
  assert.equal(frozen(wrongSession).decision, 'ALLOW'); assert.equal(corrected(envelope(wrongSession)).decision, 'DENY');
  const ancient = structuredClone(original), proof = seal({ ...JSON.parse(ancient.providerProofBytes), recordedAt: '2000-01-01T00:00:00Z' }, 'human-provider');
  ancient.providerProofBytes = jcs(proof); replaceAuthority(ancient, { ...JSON.parse(ancient.authorityBytes), providerProofDigest: proof.recordDigest });
  assert.equal(frozen(ancient).decision, 'ALLOW'); assert.equal(corrected(envelope(ancient)).firstError, 'HUMAN_TIMED_EVIDENCE_INVALID');
  const valid = fullBinding(); assert.equal(corrected(envelope(valid)).decision, 'ALLOW');
  const substituted = structuredClone(valid); replaceAuthority(substituted, { ...JSON.parse(valid.authorityBytes), sessionId: 'substituted-session' });
  assert.equal(corrected(envelope(substituted)).firstError, 'HUMAN_PROVIDER_BINDING_INVALID');
});

test('complete canonical authority binds every non-circular field and preserves exact consumed evidence', () => {
  const bundle = fullBinding(), before = jcs(bundle), authority = JSON.parse(bundle.authorityBytes), digest = humanAuthorityBindingDigest(authority);
  const exclusions = ['providerProofDigest', 'recordDigest', 'signature'];
  for (const field of Object.keys(authority)) {
    const changed = structuredClone(authority); const value = changed[field];
    changed[field] = Array.isArray(value) ? [...value, 'extra'] : typeof value === 'number' ? value + 1 : typeof value === 'boolean' ? !value : `${String(value)}-changed`;
    assert.equal(humanAuthorityBindingDigest(changed) === digest, exclusions.includes(field), field);
  }
  const result = corrected(envelope(bundle)); assert.equal(result.decision, 'ALLOW');
  assert.deepEqual(result.consumedRecordIds, frozen(makeHumanAuthorityBundle()).consumedRecordIds);
  assert.deepEqual(result.effects, zeroEffects()); assert.equal(jcs(bundle), before);
});

test('omitted-field substitution cannot retain a full provider proof even with a newly signed authority/CAS reservation', () => {
  for (const [field, value] of Object.entries({ sessionId: 'other', authenticatedAt: '2026-09-04T11:59:58Z', sequence: 2, terminalEventId: 'other',
    idempotencyKey: 'other', identityEvidenceDigest: 'a'.repeat(64), qualificationEvidenceDigest: 'a'.repeat(64), assignmentEvidenceDigest: 'a'.repeat(64),
    authorizationPolicyRevision: 'a'.repeat(40), providerTrustAnchorDigest: 'a'.repeat(64), casHead: 'a'.repeat(64) })) {
    const bundle = fullBinding(); replaceAuthority(bundle, { ...JSON.parse(bundle.authorityBytes), [field]: value });
    assert.equal(corrected(envelope(bundle)).firstError, 'HUMAN_PROVIDER_BINDING_INVALID', field);
  }
});

test('a freshly signed complete proof cannot select a caller-claimed trust anchor or different provider time', () => {
  for (const patch of [{ providerTrustAnchorDigest: 'f'.repeat(64) }, { providerRecordId: 'unexpected-proof-id' }]) {
    const source = makeHumanAuthorityBundle(); replaceAuthority(source, { ...JSON.parse(source.authorityBytes), ...patch });
    assert.equal(corrected(envelope(fullBinding(source))).firstError, 'HUMAN_PROVIDER_BINDING_INVALID');
  }
  const bundle = fullBinding(), proof = seal({ ...JSON.parse(bundle.providerProofBytes), recordedAt: '2026-09-04T11:59:59Z' }, 'human-provider');
  bundle.providerProofBytes = jcs(proof); replaceAuthority(bundle, { ...JSON.parse(bundle.authorityBytes), providerProofDigest: proof.recordDigest });
  assert.equal(corrected(envelope(bundle)).firstError, 'HUMAN_PROVIDER_BINDING_INVALID');
});

test('timed verifier requires explicit times and independently enforces activation, expiry, revocation and registry selection', () => {
  const source = registry(), check = createTimedRecordVerifier(jcs(source));
  const record = seal({ proof: 'synthetic', recordedAt: '2026-09-04T12:00:00Z' }, 'human-provider'), bytes = jcs(record);
  const context = { domain: 'human-provider', recordedAt: record.recordedAt, evaluatedAt: '2026-09-04T12:00:30Z' };
  assert.equal(check.verifyBytes(bytes, context).anchorDigest, sha256(source.bindings.find((x) => x.domain === 'human-provider').publicKeyHex));
  for (const patch of [{ recordedAt: '2000-01-01T00:00:00Z' }, { recordedAt: '2027-09-01T00:00:00Z', evaluatedAt: '2027-09-01T00:00:00Z' },
    { evaluatedAt: '2027-09-01T00:00:00Z' }, { evaluatedAt: '2026-09-04T11:59:59Z' }, { recordedAt: 'invalid' }, { domain: 'record' }, { extra: true }])
    assert.throws(() => check.verifyBytes(bytes, { ...context, ...patch }));
  assert.throws(() => check.verifyBytes(bytes));
  const revoked = registry(); revoked.bindings.find((x) => x.domain === 'human-provider').revokedAt = '2026-09-04T12:00:10Z';
  assert.throws(() => createTimedRecordVerifier(jcs(revoked)).verifyBytes(bytes, context));
  assert.doesNotThrow(() => createTimedRecordVerifier(jcs(revoked)).verifyBytes(bytes, { ...context, evaluatedAt: '2026-09-04T12:00:09Z' }));
  source.bindings.find((x) => x.domain === 'human-provider').publicKeyHex = '0'.repeat(64); // factory owns its parsed registry, not this object
  assert.doesNotThrow(() => check.verifyBytes(bytes, context));
  const duplicate = registry(); duplicate.bindings.push(duplicate.bindings[0]); assert.throws(() => createTimedRecordVerifier(jcs(duplicate)));
});

test('old negative authority cases remain denied; malformed envelopes cannot bypass the full-binding path', () => {
  const controls = JSON.parse(readFileSync(new URL('../intent/0001/reviews/domain/round-3/remediation/CONTROL-FIXTURES.candidate.json', import.meta.url)));
  const source = fullBinding(); assert.equal(controls.humanAuthorityKinds.length, 17);
  for (const kind of controls.humanAuthorityKinds) {
    const result = corrected(envelope(mutateHumanAuthorityBundle(source, kind)));
    assert.equal(result.decision, kind === 'positive' ? 'ALLOW' : 'DENY', kind); assert.deepEqual(result.effects, zeroEffects());
  }
  for (const value of [null, {}, jcs(source), envelope(source) + ' ', 'x'.repeat(1048577),
    envelope(source).replace(correctionPolicyDigest, '0'.repeat(64)), jcs({ ...JSON.parse(envelope(source)), registryBytes: jcs(registry()) })])
    assert.equal(corrected(value).decision, 'DENY');
});
