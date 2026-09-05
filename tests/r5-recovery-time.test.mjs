import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { createRecoveryTimeVerifier, policyDigest } from '../intent/0065/recovery-time.candidate.mjs';
import { makeRecoveryEvidence, mutateRecoveryEvidence, recoveryCuts, recoveryCorruptions } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { recoveryDecision } from '../intent/0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { jcs, sha256, TRUST_REGISTRY, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const start = '2026-09-04T12:00:00Z', finish = '2026-09-04T12:59:59Z';
const decode = (encoded) => JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
const encode = (value) => Buffer.from(jcs(value)).toString('base64');
const payload = (value) => Object.fromEntries(Object.entries(value).filter(([field]) => !['recordDigest', 'signature'].includes(field)));
// Synthetic fixture signers only; never real provider or recovery evidence.
function seal(input, domain) {
  const key = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), createHash('sha256').update(`steer-r3-r1-${domain}`).digest()]), format: 'der', type: 'pkcs8' });
  const record = payload(input), digest = sha256(jcs(record));
  return { ...record, recordDigest: digest, signature: { algorithm: 'Ed25519', keyId: `${domain}-key-v1`, signedDigest: digest, valueBase64: sign(null, Buffer.from(digest), key).toString('base64') } };
}
const families = [['identityEvidenceBytes', 'provider', 'verifiedAt'], ['providerJournalBytes', 'recovery-provider', null], ['exportedRecordBytes', 'recovery-provider', null], ['restoredRecordBytes', 'record', null], ['independentVerifierBytes', 'verifier', null]];
function wrap(recovery, alter = () => {}, signer = 'provider-a', incomplete = false) {
  const recoveryBytes = jcs(recovery), observed = { version: 'steer-recovery-observation/v1', recoveryDigest: sha256(recoveryBytes), policyDigest,
    registryDigest: sha256(jcs(TRUST_REGISTRY)), startedAt: start, finishedAt: finish, recordedAt: finish };
  const inventory = [];
  const add = (path, serialized, domain, field = null) => {
    const record = JSON.parse(serialized); inventory.push({ path, domain, bytesDigest: sha256(serialized), recordDigest: record.recordDigest ?? null,
      timeBasis: field === null ? 'observed-as-of' : `signed:${field}`, recordedAt: field === null ? observed.recordedAt : record[field] ?? null });
  };
  try {
    add('recovery', recoveryBytes, 'record');
    for (const [key, domain, field] of families) add(`recovery/${key}`, Buffer.from(recovery[key], 'base64').toString('utf8'), domain, field);
  } catch (error) { if (!incomplete) throw error; inventory.length = 0; }
  Object.assign(observed, { inventoryDigest: sha256(jcs(inventory)), recordCount: inventory.length }); alter(observed, inventory);
  return { version: 'steer-recovery-time/v1', policyDigest, recoveryBytes, observationBytes: jcs(seal(observed, signer)) };
}
const evaluate = (input, evaluatedAt = finish) => createRecoveryTimeVerifier(jcs({ version: 'steer-audit-clock/v1', evaluatedAt })).verify(jcs(input));
const denied = (result) => assert.deepEqual(result, { outcome: 'RECOVERY_INCOMPLETE', firstError: 'RECOVERY_TIME_INVALID', effects: zeroEffects(), executionAuthorized: false });
function resealOuter(recovery) {
  const preimage = payload(recovery); delete preimage.independentVerifierBytes;
  const proof = decode(recovery.independentVerifierBytes);
  recovery.independentVerifierBytes = encode(seal({ ...proof, recoveryBindingDigest: sha256(jcs(preimage)),
    retrievedEvidenceDigest: sha256(jcs(['providerJournalBytes', 'exportedRecordBytes', 'restoredRecordBytes'].map((key) => decode(recovery[key]).recordDigest))) }, 'verifier'));
  return seal(recovery, 'record');
}
// Rebind actual bytes and all descendants after a coherent source change, so
// timing counterexamples cannot fail merely from an old signature or digest.
function rebuild(recovery) {
  const identity = decode(recovery.identityEvidenceBytes), journal = decode(recovery.providerJournalBytes);
  journal.identityDigest = identity.recordDigest;
  for (const record of journal.records) {
    if (record.identityDigest !== identity.recordDigest) {
      record.identityDigest = identity.recordDigest;
      record.decisionBytesBase64 = encode({ ...decode(record.decisionBytesBase64), identityDigest: identity.recordDigest });
    }
    record.decisionDigest = sha256(Buffer.from(record.decisionBytesBase64, 'base64')); record.artifactDigest = sha256(Buffer.from(record.gitObjectBytesBase64, 'base64'));
  }
  const signedJournal = seal(journal, 'recovery-provider'); recovery.providerJournalBytes = encode(signedJournal);
  recovery.exportedRecordBytes = encode(seal({ ...decode(recovery.exportedRecordBytes), identityDigest: identity.recordDigest,
    journalDigest: signedJournal.recordDigest, recordsDigest: sha256(jcs(journal.records)), records: journal.records }, 'recovery-provider'));
  recovery.restoredRecordBytes = encode(seal({ ...decode(recovery.restoredRecordBytes), identityDigest: identity.recordDigest,
    mappings: journal.records.map((record) => ({ providerRecordId: record.providerRecordId, restoredId: `restored-${record.providerRecordId}`,
      decisionBytesBase64: record.decisionBytesBase64, gitObjectBytesBase64: record.gitObjectBytesBase64, gitObjectDigest: record.artifactDigest })) }, 'record'));
  recovery.inventory = journal.records.map(({ cursor, providerRecordId, decisionDigest, artifactDigest }) => ({ cursor, providerRecordId, decisionDigest, artifactDigest }));
  recovery.preInventory = structuredClone(recovery.inventory); recovery.postInventory = structuredClone(recovery.inventory);
  recovery.independentVerifierBytes = encode(seal({ ...decode(recovery.independentVerifierBytes), identityDigest: identity.recordDigest }, 'verifier'));
  return resealOuter(recovery);
}

test('all eight recovery cuts preserve unknown versus verified outcomes with all six records timed', () => {
  assert.equal(recoveryCuts.length, 8);
  for (const [index, cut] of recoveryCuts.entries()) {
    const recovery = JSON.parse(makeRecoveryEvidence(cut)), input = wrap(recovery), original = jcs(input), result = evaluate(input);
    assert.equal(result.outcome, index < 2 ? 'UNKNOWN_RECONCILE_PROVIDER' : 'RECOVERY_VERIFIED');
    assert.equal(result.timedRecordCount, 6); assert.equal(result.observedAsOfCount, 5);
    assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects());
    assert.equal(jcs(input), original);
  }
});

test('all 25 original recovery corruption classes remain denied', () => {
  assert.equal(recoveryCorruptions.length, 25);
  for (const kind of recoveryCorruptions) {
    const bytes = mutateRecoveryEvidence(makeRecoveryEvidence(), kind); assert.equal(recoveryDecision(bytes).outcome, 'RECOVERY_INCOMPLETE', kind);
    denied(evaluate(wrap(JSON.parse(bytes), () => {}, 'provider-a', true)));
  }
});

test('every signature is required even for pre-ack unknown cuts; observation cannot share an evidence anchor', () => {
  for (const cut of recoveryCuts) {
    for (const key of ['recovery', ...families.map(([key]) => key)]) {
      let recovery = JSON.parse(makeRecoveryEvidence(cut));
      if (key === 'recovery') recovery.signature.valueBase64 = Buffer.alloc(64).toString('base64');
      else {
        const record = decode(recovery[key]); record.signature.valueBase64 = Buffer.alloc(64).toString('base64'); recovery[key] = encode(record); recovery = seal(recovery, 'record');
      }
      denied(evaluate(wrap(recovery)));
    }
  }
  for (const domain of ['record', 'provider', 'recovery-provider', 'verifier']) denied(evaluate(wrap(JSON.parse(makeRecoveryEvidence()), () => {}, domain)));
});

test('fully rebound pre-key identity and out-of-window journal times reproduce old acceptance then deny', () => {
  for (const verifiedAt of ['2026-08-31T23:59:59Z', '2026-09-04T12:00:02Z', '2026-09-04T13:00:00Z']) {
    const recovery = JSON.parse(makeRecoveryEvidence()); recovery.identityEvidenceBytes = encode(seal({ ...decode(recovery.identityEvidenceBytes), verifiedAt }, 'provider'));
    const rebuilt = rebuild(recovery); assert.equal(recoveryDecision(jcs(rebuilt)).outcome, 'RECOVERY_VERIFIED'); denied(evaluate(wrap(rebuilt)));
  }
  for (const times of [['2026-08-31T23:59:58Z', '2026-08-31T23:59:59Z'], ['2026-09-04T13:00:00Z', '2026-09-04T13:00:01Z']]) {
    const recovery = JSON.parse(makeRecoveryEvidence()), journal = decode(recovery.providerJournalBytes);
    journal.records.forEach((record, index) => { record.serverTimestamp = times[index]; }); recovery.providerJournalBytes = encode(journal);
    const rebuilt = rebuild(recovery); assert.equal(recoveryDecision(jcs(rebuilt)).outcome, 'RECOVERY_VERIFIED'); denied(evaluate(wrap(rebuilt)));
  }
});

test('independent interval must match numeric elapsed time and cannot relax the one-hour RTO', () => {
  const original = JSON.parse(makeRecoveryEvidence());
  const historical = structuredClone(original), journal = decode(historical.providerJournalBytes);
  historical.identityEvidenceBytes = encode(seal({ ...decode(historical.identityEvidenceBytes), verifiedAt: '2026-09-03T11:59:59Z' }, 'provider'));
  journal.records.forEach((record, index) => { record.serverTimestamp = `2026-09-03T12:00:0${index + 1}Z`; });
  historical.providerJournalBytes = encode(journal);
  assert.equal(evaluate(wrap(rebuild(historical))).outcome, 'RECOVERY_VERIFIED', 'Old source events are not recovery-duration events.');
  for (const change of [(x) => { x.startedAt = '2026-09-04T12:00:01Z'; }, (x) => { x.finishedAt = '2026-09-04T13:00:00Z'; },
    (x) => { x.recordedAt = '2026-09-04T13:00:00Z'; }, (x) => { x.startedAt = 'bad'; }]) denied(evaluate(wrap(original, change)));
  // Rebuild observations' as-of inventory when intentionally moving the whole interval.
  const atDuration = (seconds) => {
    const recovery = resealOuter({ ...original, verifiedAtMs: seconds * 1000, rtoLimitMs: Math.max(3600000, seconds * 1000) });
    const end = new Date(Date.parse(start) + seconds * 1000).toISOString().replace('.000Z', 'Z');
    const input = wrap(recovery, (observation, inventory) => {
      observation.finishedAt = end; observation.recordedAt = end;
      for (const row of inventory) if (row.timeBasis === 'observed-as-of') row.recordedAt = end;
      observation.inventoryDigest = sha256(jcs(inventory));
    });
    return { recovery, input, end };
  };
  const exact = atDuration(3600); assert.equal(evaluate(exact.input, exact.end).outcome, 'RECOVERY_VERIFIED');
  for (const seconds of [3601, 7200]) {
    const value = atDuration(seconds); assert.equal(recoveryDecision(jcs(value.recovery)).outcome, 'RECOVERY_VERIFIED'); denied(evaluate(value.input, value.end));
  }
  denied(evaluate(wrap(original), '2026-09-04T12:59:58Z'));
  assert.equal(evaluate(wrap(original), '2027-08-31T23:59:59Z').outcome, 'RECOVERY_VERIFIED');
  denied(evaluate(wrap(original), '2027-09-01T00:00:00Z'));
});

test('canonical base64 and strict UTF-8 prevent ambiguous byte recovery while preserving binary Git objects', () => {
  const source = JSON.parse(makeRecoveryEvidence()), journal = decode(source.providerJournalBytes);
  journal.records[0].gitObjectBytesBase64 = Buffer.from('blob\0e\u0301\n').toString('base64');
  source.providerJournalBytes = encode(journal); const good = rebuild(source), input = wrap(good), before = jcs(input);
  assert.equal(evaluate(input).outcome, 'RECOVERY_VERIFIED'); assert.equal(jcs(input), before);
  const whitespace = JSON.parse(jcs(good)), changed = decode(whitespace.providerJournalBytes);
  changed.records[0].gitObjectBytesBase64 += '\n'; whitespace.providerJournalBytes = encode(changed);
  const bad = rebuild(whitespace); assert.equal(recoveryDecision(jcs(bad)).outcome, 'RECOVERY_VERIFIED'); denied(evaluate(wrap(bad)));
  const invalid = JSON.parse(makeRecoveryEvidence()), native = decode(invalid.providerJournalBytes);
  const decision = decode(native.records[0].decisionBytesBase64); decision.note = 'MARKER';
  const serialized = jcs(decision), parts = serialized.split('MARKER');
  native.records[0].decisionBytesBase64 = Buffer.concat([Buffer.from(parts[0]), Buffer.from([0xff]), Buffer.from(parts[1])]).toString('base64');
  invalid.providerJournalBytes = encode(native); const badUtf8 = rebuild(invalid);
  assert.equal(recoveryDecision(jcs(badUtf8)).outcome, 'RECOVERY_VERIFIED'); denied(evaluate(wrap(badUtf8)));
});

test('complete observation, input policy and trusted clock are mandatory; four-row bound is exercised', () => {
  const source = JSON.parse(makeRecoveryEvidence());
  for (const change of [(x) => { x.recoveryDigest = 'f'.repeat(64); }, (x) => { x.policyDigest = 'f'.repeat(64); },
    (x) => { x.registryDigest = 'f'.repeat(64); }, (x) => { x.recordCount--; }, (x) => { x.extra = true; },
    (x, inventory) => { inventory.reverse(); x.inventoryDigest = sha256(jcs(inventory)); },
    (x, inventory) => { inventory.pop(); x.inventoryDigest = sha256(jcs(inventory)); x.recordCount--; }]) denied(evaluate(wrap(source, change)));
  for (const count of [4, 5]) {
    const recovery = JSON.parse(makeRecoveryEvidence()), journal = decode(recovery.providerJournalBytes), original = journal.records[0];
    journal.records = Array.from({ length: count }, (_, index) => {
      const cursor = index + 1; return { ...original, cursor, providerRecordId: `provider-record-${cursor}`, serverTimestamp: `2026-09-04T12:00:0${cursor}Z`,
        decisionBytesBase64: encode({ ...decode(original.decisionBytesBase64), cursor, decisionId: `decision-${cursor}` }) };
    });
    recovery.providerJournalBytes = encode(journal); const rebuilt = rebuild(recovery);
    assert.equal(recoveryDecision(jcs(rebuilt)).outcome, 'RECOVERY_VERIFIED');
    const result = evaluate(wrap(rebuilt)); if (count === 4) assert.equal(result.outcome, 'RECOVERY_VERIFIED'); else denied(result);
  }
  for (const value of [null, '{}', jcs({ version: 'steer-audit-clock/v1', evaluatedAt: 'bad' }), jcs({ version: 'steer-audit-clock/v1', evaluatedAt: finish, trustRegistry: {} })])
    assert.throws(() => createRecoveryTimeVerifier(value), /RECOVERY_TIME_CONTEXT_INVALID/);
  const input = wrap(source), verifier = createRecoveryTimeVerifier(jcs({ version: 'steer-audit-clock/v1', evaluatedAt: finish }));
  for (const value of [null, {}, input.recoveryBytes, jcs(input) + ' ', 'x'.repeat(262145), jcs({ ...input, evaluatedAt: finish }), jcs({ ...input, policyDigest: 'f'.repeat(64) })]) denied(verifier.verify(value));
});
