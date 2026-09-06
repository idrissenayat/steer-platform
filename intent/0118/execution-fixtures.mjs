// Closed synthetic archive fixtures. No signer or mutation callback is exported.
import { Buffer } from 'node:buffer';
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { TRUST_REGISTRY, jcs, sha256 } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { derivedDispositionExecutionCase } from '../0117/execution-fixtures.mjs';
import { createArchivedDerivedVerifier, policyDigest } from './archived-derived.candidate.mjs';
const variants = ['positive', 'replay', 'year-2027', 'year-2029', 'digest-only', 'missing-child-proof', 'wrong-child-copy', 'missing-attestation', 'missing-retention',
  'wrong-config', 'wrong-original-digest', 'wrong-evidence', 'wrong-reference', 'wrong-count', 'wrong-observation', 'attestation-source', 'receipt-source',
  'receipt-incomplete', 'receipt-before-attestation', 'receipt-outlives-attestation', 'receipt-wrong-attestation', 'receipt-wrong-bytes', 'stale-attestation', 'expired-receipt', 'future-attestation', 'wrong-domain', 'forged',
  'original-era-witness', 'current-key-revoked', 'old-revocation-next-nanosecond', 'extra-field', 'reordered-children',
  ...TRUST_REGISTRY.bindings.map(k => `revoked-${k.domain}`)];
function key(domain, year, original = false) {
  return createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'),
    createHash('sha256').update(original ? `steer-r3-r1-${domain}` : `steer-0118-future-${year}-${domain}`).digest()]), format: 'der', type: 'pkcs8' });
}
function seal(input, domain, year, original = false) {
  const payload = Object.fromEntries(Object.entries(input).filter(([k]) => !['recordDigest', 'signature'].includes(k))), digest = sha256(jcs(payload));
  return { ...payload, recordDigest: digest, signature: { algorithm: 'Ed25519', keyId: `${domain}-key-${original ? 'v1' : 'current'}`, signedDigest: digest,
    valueBase64: sign(null, Buffer.from(digest), key(domain, year, original)).toString('base64') } };
}
export function archivedDerivedExecutionCase(variant = 'positive') {
  if (!variants.includes(variant)) throw new Error('UNKNOWN_ARCHIVED_DERIVED_CASE');
  const year = variant === 'year-2027' ? 2027 : variant === 'year-2029' ? 2029 : variant === 'original-era-witness' ? 2026 : 2033;
  const at = suffix => `${year}-09-04T${suffix}Z`, evaluationTime = at('12:00:50');
  const original = derivedDispositionExecutionCase(variant === 'replay' ? 'replay' : variant === 'digest-only' ? 'digest-only' : variant === 'missing-child-proof' ? 'missing-child-proof' :
    variant === 'wrong-child-copy' ? 'wrong-copy' : variant === 'reordered-children' ? 'swapped-children' : 'positive');
  const originalFact = original.verifier.verify(original.bytes, original.evaluationTime), fact = originalFact.state === 'blocked' ? (() => { const good = derivedDispositionExecutionCase(); return good.verifier.verify(good.bytes, good.evaluationTime); })() : originalFact;
  const registry = structuredClone(TRUST_REGISTRY);
  for (const domain of ['authority', 'provider']) registry.bindings.push({ domain, keyId: `${domain}-key-current`, algorithm: 'Ed25519',
    publicKeyHex: createPublicKey(key(domain, year)).export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex'),
    notBefore: `${year}-01-01T00:00:00Z`, notAfter: `${year + 1}-01-01T00:00:00Z`, revokedAt: null });
  if (variant.startsWith('revoked-')) registry.bindings.find(k => k.domain === variant.slice(8) && k.keyId.endsWith('-v1')).revokedAt = evaluationTime;
  if (variant === 'old-revocation-next-nanosecond') registry.bindings.find(k => k.domain === 'record').revokedAt = at('12:00:50.000000001');
  if (variant === 'current-key-revoked') registry.bindings.find(k => k.keyId === 'authority-key-current').revokedAt = evaluationTime;
  const config = { version: 'steer-archived-derived-context/v1', originalContextBytes: original.configBytes, originalBytesDigest: sha256(original.bytes),
    archiveReference: { repositoryId: 'steer-platform', revision: 'd'.repeat(40), path: 'evidence/derived-disposition.json' }, currentRegistryBytes: jcs(registry) };
  const configBytes = jcs(config), configDigest = sha256(configBytes);
  const common = { configDigest, policyDigest, registryDigest: sha256(config.currentRegistryBytes), originalConfigDigest: original.verifier.configDigest,
    originalBytesDigest: config.originalBytesDigest, originalEvidenceDigest: fact.evidenceDigest, archiveReference: config.archiveReference, observedAt: original.evaluationTime,
    childCount: 2, copyCount: 4, recordedAt: at('12:00:30'), validThrough: at('12:02:00') };
  const attestation = { ...common, kind: 'archived-derived-attestation', source: 'authoritative-derived-history-revalidator', decision: 'original-derived-evidence-verified' };
  for (const [name, field, value] of [['wrong-config', 'configDigest', 'f'.repeat(64)], ['wrong-original-digest', 'originalBytesDigest', 'f'.repeat(64)],
    ['wrong-evidence', 'originalEvidenceDigest', 'f'.repeat(64)], ['wrong-reference', 'archiveReference', { ...config.archiveReference, revision: 'e'.repeat(40) }],
    ['wrong-count', 'childCount', 1], ['wrong-observation', 'observedAt', '2026-09-04T12:00:03Z'], ['attestation-source', 'source', 'caller'],
    ['future-attestation', 'recordedAt', at('12:00:50.000000001')]]) if (variant === name) attestation[field] = value;
  if (variant === 'stale-attestation') { attestation.recordedAt = at('11:55:49.999999999'); attestation.validThrough = at('12:00:49.999999999'); }
  const signed = seal(attestation, variant === 'wrong-domain' ? 'provider' : 'authority', year, variant === 'original-era-witness');
  const receipt = { ...common, kind: 'archived-derived-retention', source: 'authoritative-archive-store', recordedAt: at('12:00:31'),
    attestationDigest: signed.recordDigest, retainedBytesDigest: config.originalBytesDigest, complete: true };
  for (const [name, field, value] of [['receipt-source', 'source', 'caller'], ['receipt-incomplete', 'complete', false],
    ['receipt-wrong-attestation', 'attestationDigest', 'f'.repeat(64)], ['receipt-wrong-bytes', 'retainedBytesDigest', 'f'.repeat(64)],
    ['receipt-before-attestation', 'recordedAt', at('12:00:29.999999999')], ['receipt-outlives-attestation', 'validThrough', at('12:02:00.000000001')],
    ['expired-receipt', 'validThrough', evaluationTime]]) if (variant === name) receipt[field] = value;
  const envelope = { version: 'steer-archived-derived/v1', policyDigest, originalBytes: original.bytes, attestationBytes: jcs(signed), retentionReceiptBytes: jcs(seal(receipt, 'provider', year)) };
  if (variant === 'missing-attestation') envelope.attestationBytes = '';
  if (variant === 'missing-retention') envelope.retentionReceiptBytes = '';
  if (variant === 'forged') { signed.signature.valueBase64 = Buffer.alloc(64).toString('base64'); envelope.attestationBytes = jcs(signed); }
  if (variant === 'extra-field') envelope.executionAuthorized = true;
  return { config, configBytes, envelope, bytes: jcs(envelope), original, evaluationTime, verifier: createArchivedDerivedVerifier(configBytes) };
}
