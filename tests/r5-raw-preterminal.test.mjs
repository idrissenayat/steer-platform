import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { createRawPreterminalVerifier, policyDigest } from '../intent/0073/raw-preterminal.candidate.mjs';
import { humanAuthorityBindingDigest } from '../intent/0058/human-authority.candidate.mjs';
import { exactInstant, formatExactInstant } from '../intent/0069/exact-time.candidate.mjs';
import { makeHumanAuthorityBundle, makeLifecycleEventBytes } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { jcs, sha256, RETENTION_POLICY_SHA, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const epoch = exactInstant('2026-09-04T12:00:00Z'), at = (seconds) => formatExactInstant(epoch + BigInt(seconds) * 1000000000n);
const evaluation = at(50), until = at(150), keys = new Map();
function seal(value, domain) {
  if (!keys.has(domain)) keys.set(domain, createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), createHash('sha256').update(`steer-r3-r1-${domain}`).digest()]), format: 'der', type: 'pkcs8' }));
  const payload = Object.fromEntries(Object.entries(value).filter(([field]) => !['recordDigest', 'signature'].includes(field))), recordDigest = sha256(jcs(payload));
  return { ...payload, recordDigest, signature: { algorithm: 'Ed25519', keyId: `${domain}-key-v1`, signedDigest: recordDigest, valueBase64: sign(null, Buffer.from(recordDigest), keys.get(domain)).toString('base64') } };
}
// Synthetic fixture only; mutable callbacks rebuild downstream signatures.
function fixture(options = {}) {
  const edits = options.edits ?? {}, edit = (name, value) => { edits[name]?.(value); return value; };
  const config = edit('config', { version: 'steer-raw-preparation-context/v1', lifecycleConfigDigest: 'e'.repeat(64), recordId: 'raw-1', artifactRevision: 'b'.repeat(40), environmentId: null });
  const configBytes = jcs(config), configDigest = sha256(configBytes);
  const terminal = edit('terminal', { ...JSON.parse(makeLifecycleEventBytes('corpus-sanitization-terminal', 1)), recordId: config.recordId, artifactRevision: config.artifactRevision,
    recordClass: 'RC-CORPUS-RAW-WORKING', policySha256: RETENTION_POLICY_SHA, occurredAt: at(0), result: options.result ?? 'pass', sanitizerRevision: 'sanitizer-v1', inspectionRevision: 'inspector-v1' });
  const terminalPayload = Object.fromEntries(Object.entries(terminal).filter(([field]) => !['recordDigest', 'signature', 'providerProofBytes', 'providerProofDigest'].includes(field)));
  const terminalProof = seal(edit('terminal-proof', { providerRecordId: terminal.providerRecordId, eventId: terminal.eventId, eventBindingDigest: sha256(jcs(terminalPayload)), recordedAt: terminal.occurredAt }), 'provider');
  const terminalBytes = jcs(seal({ ...terminal, providerProofBytes: jcs(terminalProof), providerProofDigest: terminalProof.recordDigest }, 'record'));
  const copies = Array.from({ length: options.copyCount ?? 3 }, (_, index) => {
    const suffix = index % 2 ? 'b' : 'a';
    return { copyId: `copy-${String(index + 1).padStart(2, '0')}`, copyKind: 'temporary-working', provider: `fixture-provider-${suffix}`, providerBindingId: `fixture-provider-${suffix}-binding`,
      account: `fixture-account-${suffix}`, objectKey: `raw-object-${index}`, versionId: 'version-1', keyId: `raw-key-${index}`, sourceOriginal: false };
  });
  edit('copies', copies);
  const preparation = seal(edit('preparation', { kind: 'raw-preparation', configDigest, preparationId: 'preparation-1', source: 'authoritative-raw-preparation', terminalEventId: terminal.eventId,
    copies, complete: true, sanitizerRevision: 'sanitizer-v1', inspectorRevision: 'inspector-v1', recordedAt: at(-20), validThrough: until }), options.preparationDomain ?? 'provider');
  const bundle = makeHumanAuthorityBundle(), tupleDigest = sha256(jcs(copies));
  const identity = seal(edit('identity', { ...JSON.parse(bundle.identityEvidenceBytes), verifiedAt: at(-18) }), 'provider');
  const inventory = seal(edit('human-inventory', { ...JSON.parse(bundle.inventoryBytes), items: copies.map((copy) => ({ copyId: copy.copyId, provider: copy.provider, objectDigest: sha256(jcs(copy)) })),
    preparationDigest: preparation.recordDigest, tupleDigest, capturedAt: at(-19) }), 'record');
  const prior = JSON.parse(bundle.authorityBytes);
  let authority = edit('authority', { ...prior, authorityType: 'raw-policy-grant', terminalEventId: terminal.eventId, identityEvidenceDigest: identity.recordDigest, copyInventoryDigest: inventory.recordDigest,
    conditions: [`raw-preparation:${preparation.recordDigest}`, `raw-context:${configDigest}`, `raw-tuples:${tupleDigest}`],
    allowedCopyProviders: [...new Set(copies.map((copy) => copy.provider))].sort(), decidedAt: at(-10), authenticatedAt: at(-18), validFrom: at(-15), expiresAt: until });
  const proof = seal(edit('human-proof', { ...JSON.parse(bundle.providerProofBytes), authorityBindingDigest: humanAuthorityBindingDigest(authority), recordedAt: authority.decidedAt }), 'human-provider');
  authority = seal({ ...authority, providerProofDigest: proof.recordDigest }, 'authority');
  const head = seal(edit('head', { ...JSON.parse(bundle.casHeadBytes), snapshotAt: at(-10), validThrough: until }), 'cas-authority');
  const replay = seal(edit('replay', { ...JSON.parse(bundle.replayLedgerBytes), snapshotAt: at(-10), validThrough: until }), 'replay-authority');
  const reservation = seal(edit('reservation', { ...JSON.parse(bundle.casReservationBytes), authorityDigest: authority.recordDigest, requestDigest: authority.recordDigest, recordedAt: at(-9), validThrough: until }), 'cas-authority');
  Object.assign(bundle, { authorityBytes: jcs(authority), providerProofBytes: jcs(proof), identityEvidenceBytes: jcs(identity), inventoryBytes: jcs(inventory),
    casHeadBytes: jcs(head), replayLedgerBytes: jcs(replay), casReservationBytes: jcs(reservation), evaluationTime: options.evaluationTime ?? evaluation });
  edit('bundle', bundle);
  const grant = edit('grant', { version: 'steer-raw-policy-grant/v4', authority, recordClass: 'RC-CORPUS-RAW-WORKING', sanitizerRevision: 'sanitizer-v1', inspectorRevision: 'inspector-v1', completeInventoryRequired: true, receiptRequired: true, permittedTargetKind: 'temporary-copy-only' });
  const input = edit('input', { version: 'steer-raw-preterminal/v1', policyDigest, configDigest, preparationBytes: jcs(preparation), humanBundleBytes: jcs(bundle), rawGrantBytes: jcs(grant) });
  return { config, configBytes, input, bytes: jcs(input), terminalBytes, bundle, authority, preparation, verifier: createRawPreterminalVerifier(configBytes), now: options.evaluationTime ?? evaluation };
}
const verify = (value) => value.verifier.verify(value.bytes, value.terminalBytes, value.now);
const denied = (value) => assert.deepEqual(verify(value), { state: 'blocked', firstError: 'RAW_PRETERMINAL_INVALID', effects: zeroEffects(), executionAuthorized: false });

test('one complete grant is signed before all terminal outcomes without future state or receipt bytes', () => {
  let approvedBytes, batchBinding;
  for (const result of ['pass', 'fail', 'cancelled']) {
    const value = fixture({ result }), before = value.bytes, checked = verify(value);
    assert.equal(checked.state, 'verified-preterminal-grant'); assert.equal(checked.copyCount, 3);
    assert.equal(checked.decidedAt, at(-10)); assert.equal(checked.deadlineAt, at(60));
    assert.equal(checked.executionAuthorized, false); assert.equal(checked.requiresCurrentBatchAuthorization, true); assert.deepEqual(checked.effects, zeroEffects());
    approvedBytes ??= value.bundle.authorityBytes; assert.equal(value.bundle.authorityBytes, approvedBytes);
    batchBinding ??= checked.batchBindingDigest; assert.equal(checked.batchBindingDigest, batchBinding);
    assert.equal(value.bytes, before);
    assert.deepEqual(verify(value), checked); // An audit never consumes the grant.
    assert.ok(!value.bytes.includes('aggregateReceiptDigest')); assert.ok(!value.bytes.includes('lifecycle-inventory:'));
  }
});

test('backdated validity cannot replace pre-terminal decision and complete enrollment evidence', () => {
  for (const second of [0, 1]) denied(fixture({ edits: { authority: (record) => { record.decidedAt = at(second); } } }));
  for (const [name, field] of [['preparation', 'recordedAt'], ['human-proof', 'recordedAt'], ['head', 'snapshotAt'], ['replay', 'snapshotAt'], ['reservation', 'recordedAt']])
    denied(fixture({ edits: { [name]: (record) => { record[field] = at(0); } } }));
  const lastInstant = fixture({ edits: { reservation: (record) => { record.recordedAt = formatExactInstant(epoch - 1n); } } });
  assert.equal(verify(lastInstant).state, 'verified-preterminal-grant');
  denied(fixture({ edits: { reservation: (record) => { record.recordedAt = at(-11); }, head: (record) => { record.snapshotAt = at(-12); } } }));
  denied(fixture({ edits: { 'human-inventory': (record) => { record.capturedAt = at(-21); } } }));
  for (const [name, field] of [['authority', 'expiresAt'], ['preparation', 'validThrough']])
    denied(fixture({ edits: { [name]: (record) => { record[field] = at(60); } } }));
  denied(fixture({ evaluationTime: at(-1) })); denied(fixture({ evaluationTime: until }));
});

test('every exact pre-terminal scope, copy, provider and grant binding remains required', () => {
  for (const [name, patch] of [
    ['preparation', { complete: false }], ['preparation', { source: 'caller-store' }], ['preparation', { terminalEventId: 'other' }],
    ['preparation', { sanitizerRevision: 'changed' }], ['preparation', { inspectorRevision: 'changed' }],
    ['human-inventory', { preparationDigest: 'f'.repeat(64) }], ['human-inventory', { tupleDigest: 'f'.repeat(64) }],
    ['authority', { conditions: ['post-terminal-input:any'] }], ['authority', { allowedCopyProviders: ['other'] }],
    ['authority', { holdState: 'active' }], ['authority', { referenceState: 'active' }], ['authority', { sourceOriginalExcluded: false }],
    ['authority', { deadlineSeconds: 61 }], ['authority', { eraseMethod: 'provider-delete' }], ['authority', { authorityType: 'disposition-authorization' }],
    ['grant', { receiptRequired: false }], ['grant', { sanitizerRevision: 'changed' }], ['grant', { permittedTargetKind: 'source-original' }],
  ]) denied(fixture({ edits: { [name]: (record) => Object.assign(record, patch) } }));
  for (const patch of [{ sourceOriginal: true }, { copyKind: 'replica' }, { provider: 'other' }, { account: 'other' }, { providerBindingId: 'other' }, { keyId: '*' }])
    denied(fixture({ edits: { copies: (copies) => Object.assign(copies[2], patch) } }));
  denied(fixture({ edits: { copies: (copies) => { copies[2].objectKey = copies[0].objectKey; } } }));
  denied(fixture({ edits: { copies: (copies) => { copies.reverse(); } } }));
  denied(fixture({ preparationDomain: 'record' }));
  denied(fixture({ edits: { 'human-proof': (proof) => { proof.authorityBindingDigest = 'f'.repeat(64); } } }));
});

test('no supporting human proof or independent terminal evidence can be replaced by a digest surrogate', () => {
  for (const field of ['authorityBytes', 'providerProofBytes', 'identityEvidenceBytes', 'qualificationEvidenceBytes', 'assignmentEvidenceBytes', 'inventoryBytes', 'replayLedgerBytes', 'casHeadBytes', 'casReservationBytes'])
    denied(fixture({ edits: { bundle: (bundle) => { delete bundle[field]; } } }));
  for (const [name, patch] of [['terminal', { policySha256: 'f'.repeat(64) }], ['terminal', { recordClass: 'RC-FAILED-RUN' }],
    ['terminal', { environmentId: 'other' }], ['terminal-proof', { eventBindingDigest: 'f'.repeat(64) }], ['terminal-proof', { recordedAt: at(-1) }]])
    denied(fixture({ edits: { [name]: (record) => Object.assign(record, patch) } }));
  const value = fixture(), altered = JSON.parse(value.terminalBytes); altered.recordId = 'other'; denied({ ...value, terminalBytes: jcs(altered) });
  const another = fixture({ edits: { config: (config) => { config.lifecycleConfigDigest = 'f'.repeat(64); } } });
  denied({ ...value, verifier: another.verifier });
});

test('bounds, strict byte grammar, explicit clocks and immutable trusted configuration fail closed', () => {
  assert.equal(verify(fixture({ copyCount: 1 })).copyCount, 1);
  assert.equal(verify(fixture({ copyCount: 32 })).copyCount, 32);
  const lateAudit = verify(fixture({ evaluationTime: at(61) }));
  assert.equal(lateAudit.state, 'verified-preterminal-grant');
  assert.equal(lateAudit.executionAuthorized, false); // Not timely disposal evidence.
  denied(fixture({ copyCount: 0 })); denied(fixture({ copyCount: 33 }));
  const value = fixture();
  for (const bytes of ['{}', value.bytes + ' ', 'x'.repeat(2097153)]) denied({ ...value, bytes });
  for (const field of ['registryBytes', 'evaluationTime', 'currentStateBytes', 'receiptBytes'])
    denied({ ...value, bytes: jcs({ ...value.input, [field]: '{}' }) });
  denied({ ...value, now: undefined }); denied({ ...value, now: '2027-09-01T00:00:00Z' });
  assert.throws(() => createRawPreterminalVerifier(value.configBytes + ' '), /RAW_PRETERMINAL_CONFIGURATION_INVALID/);
  assert.throws(() => createRawPreterminalVerifier(jcs({ ...value.config, extra: true })), /RAW_PRETERMINAL_CONFIGURATION_INVALID/);
  value.config.recordId = 'changed-after-install'; assert.equal(verify(value).state, 'verified-preterminal-grant');
});
