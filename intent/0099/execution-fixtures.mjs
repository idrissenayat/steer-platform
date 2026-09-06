// Closed synthetic case builders reusing the existing frozen fixture/mutation API.
// No raw key or general signing capability is exported; no real evidence is loaded.
import assert from 'node:assert/strict';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { makeRecoveryEvidence, mutateRecoveryEvidence, recoveryCuts, recoveryCorruptions, makeHumanAuthorityBundle, mutateHumanAuthorityBundle } from '../0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { jcs, sha256, TRUST_REGISTRY } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { humanAuthorityBindingDigest, createHumanAuthorityVerifier } from '../0058/human-authority.candidate.mjs';
import { createRecoveryTimeVerifier, policyDigest as recoveryPolicy } from '../0065/recovery-time.candidate.mjs';
const keys = new Map();
function seal(input, domain) {
  if (!keys.has(domain)) keys.set(domain, createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'),
    createHash('sha256').update(`steer-r3-r1-${domain}`).digest()]), format: 'der', type: 'pkcs8' }));
  const payload = Object.fromEntries(Object.entries(input).filter(([field]) => !['recordDigest', 'signature'].includes(field))), digest = sha256(jcs(payload));
  return { ...payload, recordDigest: digest, signature: { algorithm: 'Ed25519', keyId: `${domain}-key-v1`, signedDigest: digest,
    valueBase64: sign(null, Buffer.from(digest), keys.get(domain)).toString('base64') } };
}
const finish = '2026-09-04T12:59:59Z', registry = jcs(TRUST_REGISTRY);
function recoveryEnvelope(recoveryBytes, allowIncomplete) {
  const recovery = JSON.parse(recoveryBytes), inventory = [];
  const add = (path, bytes, domain, field = null) => {
    const record = JSON.parse(bytes); inventory.push({ path, domain, bytesDigest: sha256(bytes), recordDigest: record.recordDigest ?? null,
      timeBasis: field === null ? 'observed-as-of' : `signed:${field}`, recordedAt: field === null ? finish : record[field] ?? null });
  };
  try {
    add('recovery', recoveryBytes, 'record');
    for (const [field, domain, timeField] of [['identityEvidenceBytes', 'provider', 'verifiedAt'], ['providerJournalBytes', 'recovery-provider', null],
      ['exportedRecordBytes', 'recovery-provider', null], ['restoredRecordBytes', 'record', null], ['independentVerifierBytes', 'verifier', null]])
      add(`recovery/${field}`, Buffer.from(recovery[field], 'base64').toString('utf8'), domain, timeField);
  } catch (error) { if (!allowIncomplete) throw error; inventory.length = 0; }
  const observation = seal({ version: 'steer-recovery-observation/v1', recoveryDigest: sha256(recoveryBytes), policyDigest: recoveryPolicy,
    registryDigest: sha256(registry), startedAt: '2026-09-04T12:00:00Z', finishedAt: finish, recordedAt: finish,
    inventoryDigest: sha256(jcs(inventory)), recordCount: inventory.length }, 'provider-a');
  return jcs({ version: 'steer-recovery-time/v1', policyDigest: recoveryPolicy, recoveryBytes, observationBytes: jcs(observation) });
}
export function recoveryExecutionCase(family, kind) {
  assert.ok(family === 'RECOVERY-CUT' ? recoveryCuts.includes(kind) : family === 'RECOVERY-CORRUPTION' && recoveryCorruptions.includes(kind));
  const cut = family === 'RECOVERY-CUT', sourceBytes = cut ? makeRecoveryEvidence(kind) : makeRecoveryEvidence();
  const bytes = cut ? sourceBytes : mutateRecoveryEvidence(sourceBytes, kind), positiveBytes = recoveryEnvelope(sourceBytes, false);
  return { sourceBytes: bytes, positiveBytes, bytes: recoveryEnvelope(bytes, !cut), evaluatedAt: finish,
    expectedOutcome: cut ? recoveryCuts.indexOf(kind) < 2 ? 'UNKNOWN_RECONCILE_PROVIDER' : 'RECOVERY_VERIFIED' : 'RECOVERY_INCOMPLETE',
    verifier: createRecoveryTimeVerifier(jcs({ version: 'steer-audit-clock/v1', evaluatedAt: finish })) };
}

function replaceAuthority(bundle, authority) {
  const signed = seal(authority, 'authority'); bundle.authorityBytes = jcs(signed);
  bundle.casReservationBytes = jcs(seal({ ...JSON.parse(bundle.casReservationBytes), authorityDigest: signed.recordDigest, requestDigest: signed.recordDigest,
    idempotencyKey: signed.idempotencyKey, expectedHead: signed.casHead }, 'cas-authority'));
}
function fullyBoundHuman() {
  const bundle = makeHumanAuthorityBundle(), authority = JSON.parse(bundle.authorityBytes), provider = JSON.parse(bundle.providerProofBytes);
  const proof = seal({ ...provider, authorityBindingDigest: humanAuthorityBindingDigest(authority) }, 'human-provider');
  bundle.providerProofBytes = jcs(proof); replaceAuthority(bundle, { ...authority, providerProofDigest: proof.recordDigest }); return bundle;
}
const humanKinds = ['positive', 'missing-bundle-field', 'builder', 'invalid-time', 'expired', 'null-values', 'bad-base64', 'wrong-provider-proof', 'replay',
  'cas-loser', 'target-substitution', 'policy-substitution', 'item-substitution', 'assignment-target-substitution', 'evaluation-time-substitution', 'ordinary-replay', 'policy-bytes-substitution'];
export function humanExecutionCase(kind) {
  assert.ok(humanKinds.includes(kind) || ['r5-session', 'r5-provider-time'].includes(kind));
  const positive = fullyBoundHuman(), verifier = createHumanAuthorityVerifier(registry), evaluatedAt = positive.evaluationTime;
  const envelope = (bundle) => jcs({ version: verifier.envelopeVersion, policyDigest: verifier.policyDigest, bundleBytes: jcs(bundle) });
  let changed, legacy = null;
  if (kind.startsWith('r5-')) {
    changed = structuredClone(positive); legacy = makeHumanAuthorityBundle();
    for (const bundle of [legacy, changed]) {
      const authority = JSON.parse(bundle.authorityBytes);
      if (kind === 'r5-session') replaceAuthority(bundle, { ...authority, sessionId: 'session-substituted-without-new-provider-proof' });
      else {
        const proof = seal({ ...JSON.parse(bundle.providerProofBytes), recordedAt: '2000-01-01T00:00:00Z' }, 'human-provider');
        bundle.providerProofBytes = jcs(proof); replaceAuthority(bundle, { ...authority, providerProofDigest: proof.recordDigest });
      }
    }
  } else changed = mutateHumanAuthorityBundle(positive, kind);
  return { positiveBytes: envelope(positive), bytes: envelope(changed), positive, changed, legacy, evaluatedAt, verifier,
    expectedDecision: kind === 'positive' ? 'ALLOW' : 'DENY' };
}
