// Isolated synthetic runner only. No runtime credentials or receipt issuer.
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { verifyDomainReviewRunnerAttestation } from '../src/identity/gate-review-proof.ts';

export function reviewRunnerFixture() {
  const keys = generateKeyPairSync('ed25519');
  const trust = { version: 'steer-domain-review-runner-trust/v1', organizationId: 'synthetic', repository: 'github:1',
    domain: 'privacy', reviewerSubject: 'reviewer-agent', configurationRevision: 'configuration-1',
    attestor: 'https://runner.synthetic.invalid', keyId: 'synthetic-runner-key',
    publicKeyHex: keys.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex'),
    notBefore: '2026-09-06T12:00:00Z', notAfter: '2026-09-06T12:01:00Z', revokedAt: null as string | null };
  const payload = { version: 'steer-domain-review-runner-attestation/v1', attestor: trust.attestor, keyId: trust.keyId,
    organizationId: trust.organizationId, repository: trust.repository, domain: trust.domain, reviewerSubject: trust.reviewerSubject,
    configurationRevision: trust.configurationRevision, recordItem: 'synthetic-item', artifactRevision: 'a'.repeat(40),
    reportPath: 'reviews/privacy.json', reportDigest: 'b'.repeat(64), builderSubject: 'synthetic-builder',
    executionId: 'review-run-1', builderExecutionId: 'build-run-1', reviewedAt: '2026-09-06T12:00:00.200000000Z',
    startedAt: '2026-09-06T12:00:00.100000000Z', recordedAt: '2026-09-06T12:00:00.300000000Z',
    inheritedConversation: false, priorConclusionsTreatedAsAuthority: false, builderIndependent: true };
  const raw = (text: string, prefix = 'steer-domain-review-runner-attestation/v1\0') => ({ version: 'steer-domain-review-runner-proof/v1',
    payload: text, signatureBase64: sign(null, Buffer.from(prefix + text), keys.privateKey).toString('base64') });
  const encode = () => raw(JSON.stringify(payload));
  const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const expected = () => ({ organizationId: payload.organizationId, repository: payload.repository, domain: payload.domain,
    reviewerSubject: payload.reviewerSubject, configurationRevision: payload.configurationRevision,
    recordItem: payload.recordItem, artifactRevision: payload.artifactRevision, reportPath: payload.reportPath, reportDigest: payload.reportDigest,
    builderSubject: payload.builderSubject, executionId: payload.executionId, builderExecutionId: payload.builderExecutionId,
    reviewedAt: payload.reviewedAt, proofDigest: digest(encode()) });
  const evaluate = (proof: unknown = encode(), wanted: unknown = expected(), selected: unknown = trust, at: unknown = '2026-09-06T12:00:00.400000000Z') =>
    verifyDomainReviewRunnerAttestation(proof, selected, wanted, at);
  return { trust, payload, raw, encode, digest, expected, evaluate };
}
