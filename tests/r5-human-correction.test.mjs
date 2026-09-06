import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { correctedHumanAuthorityDecision as corrected, correctionPolicyDigest, humanAuthorityBindingDigest, createHumanAuthorityVerifier } from '../intent/0058/human-authority.candidate.mjs';
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

const futureKeys = new Map();
function futureKey(domain) {
  if (!futureKeys.has(domain)) futureKeys.set(domain, createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'),
    createHash('sha256').update(`steer-0079-${domain}`).digest()]), format: 'der', type: 'pkcs8' }));
  return futureKeys.get(domain);
}
function currentHuman(options = {}) {
  const year = options.year ?? 2033, at = (second) => `${year}-09-04T12:00:${String(second).padStart(2, '0')}Z`;
  const edit = (name, value) => { options.edits?.[name]?.(value); return value; };
  const current = registry(), domains = ['authority', 'human-provider', 'provider', 'assignment', 'record', 'replay-authority', 'cas-authority'];
  for (const domain of domains) current.bindings.push({ domain, keyId: `${domain}-key-v2`, algorithm: 'Ed25519',
    publicKeyHex: createPublicKey(futureKey(domain)).export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex'),
    notBefore: `${year}-01-01T00:00:00Z`, notAfter: `${year + 1}-01-01T00:00:00Z`, revokedAt: null });
  edit('registry', current); const registryBytes = jcs(current), bundle = makeHumanAuthorityBundle();
  function emit(name, record, domain) {
    edit(name, record);
    const payload = Object.fromEntries(Object.entries(record).filter(([field]) => !['recordDigest', 'signature'].includes(field))), digest = sha256(jcs(payload));
    const signed = { ...payload, recordDigest: digest, signature: { algorithm: 'Ed25519', keyId: `${domain}-key-v2`, signedDigest: digest,
      valueBase64: sign(null, Buffer.from(digest), futureKey(domain)).toString('base64') } };
    bundle[name] = jcs(signed); return signed;
  }
  const identity = emit('identityEvidenceBytes', { ...JSON.parse(bundle.identityEvidenceBytes), verifiedAt: at(18) }, 'provider');
  const qualification = emit('qualificationEvidenceBytes', { ...JSON.parse(bundle.qualificationEvidenceBytes), validThrough: at(59) }, 'provider');
  const assignment = emit('assignmentEvidenceBytes', { ...JSON.parse(bundle.assignmentEvidenceBytes), validThrough: at(59) }, 'assignment');
  const inventory = emit('inventoryBytes', { ...JSON.parse(bundle.inventoryBytes), capturedAt: at(18) }, 'record');
  const authority = edit('authority', { ...JSON.parse(bundle.authorityBytes), authenticatedAt: at(19), decidedAt: at(20), validFrom: at(0), expiresAt: at(59),
    identityEvidenceDigest: identity.recordDigest, qualificationEvidenceDigest: qualification.recordDigest, qualificationValidThrough: qualification.validThrough,
    assignmentEvidenceDigest: assignment.recordDigest, assignmentValidThrough: assignment.validThrough, copyInventoryDigest: inventory.recordDigest,
    providerTrustAnchorDigest: sha256(current.bindings.find((key) => key.keyId === 'human-provider-key-v2').publicKeyHex) });
  const provider = emit('providerProofBytes', { ...JSON.parse(bundle.providerProofBytes), authorityBindingDigest: humanAuthorityBindingDigest(authority), recordedAt: authority.decidedAt }, 'human-provider');
  const signedAuthority = emit('authorityBytes', { ...authority, providerProofDigest: provider.recordDigest }, 'authority');
  emit('replayLedgerBytes', { ...JSON.parse(bundle.replayLedgerBytes), snapshotAt: at(20), validThrough: at(59) }, 'replay-authority');
  emit('casHeadBytes', { ...JSON.parse(bundle.casHeadBytes), snapshotAt: at(20), validThrough: at(59) }, 'cas-authority');
  emit('casReservationBytes', { ...JSON.parse(bundle.casReservationBytes), recordedAt: at(21), validThrough: at(59),
    authorityDigest: signedAuthority.recordDigest, requestDigest: signedAuthority.recordDigest }, 'cas-authority');
  bundle.evaluationTime = at(30); edit('bundle', bundle);
  const verifier = () => createHumanAuthorityVerifier(registryBytes);
  const selectedPolicy = sha256(jcs({ ...JSON.parse(createHumanAuthorityVerifier(jcs(registry())).policyBytes), registryDigest: sha256(registryBytes) }));
  const input = edit('envelope', { version: 'steer-r5-002-human/v1', policyDigest: selectedPolicy, bundleBytes: jcs(bundle) });
  return { bundle, input, bytes: jcs(input), registryBytes, verifier, evaluationTime: at(30) };
}
function currentDenied(value, clock = value.evaluationTime) {
  const result = value.verifier().verify(value.bytes, clock); assert.equal(result.decision, 'DENY');
  assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects());
}

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

test('0079: original policy/output stay stable and fresh complete future human proofs use a selected current registry', () => {
  const original = fullBinding(), old = corrected(envelope(original)), selected = createHumanAuthorityVerifier(jcs(registry()));
  assert.equal(selected.policyDigest, correctionPolicyDigest);
  assert.deepEqual(selected.verify(envelope(original), original.evaluationTime), { ...old, executionAuthorized: false });
  for (const year of [2027, 2029, 2033]) {
    const value = currentHuman({ year }), result = value.verifier().verify(value.bytes, value.evaluationTime);
    assert.equal(result.decision, 'ALLOW'); assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects());
    assert.equal(result.consumedRecordIds.length, 9); assert.notEqual(result.correctionPolicyDigest, correctionPolicyDigest);
    assert.equal(corrected(value.bytes).decision, 'DENY');
    for (const original of registry().bindings) assert.deepEqual(JSON.parse(value.registryBytes).bindings.find((key) => key.domain === original.domain && key.keyId === original.keyId), original);
  }
});

test('0079: each of nine current proofs is mandatory and cannot use old, forged or wrong-role signatures', () => {
  const source = currentHuman(), fields = ['authorityBytes', 'providerProofBytes', 'identityEvidenceBytes', 'qualificationEvidenceBytes', 'assignmentEvidenceBytes',
    'inventoryBytes', 'replayLedgerBytes', 'casHeadBytes', 'casReservationBytes'];
  for (const field of fields) {
    currentDenied(currentHuman({ edits: { bundle: (bundle) => { delete bundle[field]; } } }));
    currentDenied(currentHuman({ edits: { bundle: (bundle) => { bundle[field] = fullBinding()[field]; } } }));
    currentDenied(currentHuman({ edits: { bundle: (bundle) => { const record = JSON.parse(bundle[field]); record.signature.valueBase64 = Buffer.alloc(64).toString('base64'); bundle[field] = jcs(record); } } }));
    currentDenied(currentHuman({ edits: { bundle: (bundle) => {
      const record = JSON.parse(bundle[field]), domain = record.signature.keyId.startsWith('provider-') ? 'authority' : 'provider';
      record.signature = { algorithm: 'Ed25519', keyId: `${domain}-key-v2`, signedDigest: record.recordDigest,
        valueBase64: sign(null, Buffer.from(record.recordDigest), futureKey(domain)).toString('base64') };
      bundle[field] = jcs(record);
    } } }));
  }
  currentDenied({ ...source, bytes: jcs({ ...source.input, policyDigest: correctionPolicyDigest }) });
  currentDenied(currentHuman({ edits: { bundle: (bundle) => { Object.assign(bundle, fullBinding()); } } }));
});

test('0079: trusted current clock is mandatory and cannot be backdated by the serialized human bundle', () => {
  const value = currentHuman(); assert.equal(value.verifier().verify(value.bytes).decision, 'DENY'); currentDenied(value, null); currentDenied(value, 'invalid');
  currentDenied(value, '2033-09-04T12:00:31Z'); currentDenied(value, '2026-09-04T12:00:30Z');
  currentDenied(currentHuman({ edits: { bundle: (bundle) => { bundle.evaluationTime = '2026-09-04T12:00:30Z'; } } }));
  // Matching the trusted clock does not make expired original approvals current.
  const old = fullBinding(); old.evaluationTime = value.evaluationTime;
  currentDenied({ ...value, bytes: jcs({ ...value.input, bundleBytes: jcs(old) }) });
});

test('0079: selected keys require native/current validity and old windows cannot be extended', () => {
  for (const domain of ['authority', 'human-provider', 'provider', 'assignment', 'record', 'replay-authority', 'cas-authority'])
    for (const [field, instant] of [['notAfter', '2033-09-04T12:00:30Z'], ['revokedAt', '2033-09-04T12:00:30Z'], ['notBefore', '2033-09-04T12:00:22Z']])
      currentDenied(currentHuman({ edits: { registry: (registry) => { registry.bindings.find((key) => key.keyId === `${domain}-key-v2`)[field] = instant; } } }));
  for (const mutate of [(registry) => { registry.bindings.shift(); }, (registry) => { registry.bindings[0].notAfter = '2040-01-01T00:00:00Z'; },
    (registry) => { registry.bindings[0].publicKeyHex = 'f'.repeat(64); }, (registry) => { registry.bindings.push(registry.bindings[0]); }])
    assert.throws(currentHuman({ edits: { registry: mutate } }).verifier, /HUMAN_AUTHORITY_CONFIGURATION_INVALID/);
});

test('0079: future authority still enforces exact scope, qualification, assignment, complete binding and winning reservation', () => {
  for (const [name, field, replacement] of [['authority', 'targetExamRevision', 'a'.repeat(40)], ['authority', 'tenant', 'other'],
    ['authority', 'providerTrustAnchorDigest', 'f'.repeat(64)], ['authority', 'expiresAt', '2033-09-04T12:00:30Z'],
    ['qualificationEvidenceBytes', 'qualification', 'not-qualified'], ['assignmentEvidenceBytes', 'status', 'expired'],
    ['identityEvidenceBytes', 'status', 'disabled'], ['casReservationBytes', 'winner', false], ['casReservationBytes', 'authorityDigest', 'f'.repeat(64)],
    ['casHeadBytes', 'head', 'f'.repeat(64)], ['authorityBytes', 'sessionId', 'changed-after-full-provider-proof']])
    currentDenied(currentHuman({ edits: { [name]: (record) => { record[field] = replacement; } } }));
  const exact = currentHuman({ edits: { bundle: (bundle) => { bundle.evaluationTime = '2033-09-04T12:00:58.999999999Z'; } } });
  assert.equal(exact.verifier().verify(exact.bytes, exact.bundle.evaluationTime).decision, 'ALLOW');
  currentDenied(currentHuman({ edits: { bundle: (bundle) => { bundle.evaluationTime = '2033-09-04T12:00:59Z'; } } }), '2033-09-04T12:00:59Z');
});

test('0079: no request-controlled registry, malformed envelope or extra field bypasses current selection', () => {
  const source = currentHuman();
  for (const mutate of [(input) => { input.registryBytes = source.registryBytes; }, (input) => { input.policyDigest = 'f'.repeat(64); },
    (input) => { input.bundleBytes = '{}'; }, (input) => { input.bundleBytes += ' '; }, (input) => { input.version = 'other'; }])
    currentDenied(currentHuman({ edits: { envelope: mutate } }));
  for (const bytes of [null, {}, ' '.repeat(1048577), source.bytes + ' ']) currentDenied({ ...source, bytes });
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
