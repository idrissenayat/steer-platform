import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { verifySelectorIdentityAttestation } from '../src/identity/gate-selector-identity.ts';
import { authorizeSelection } from './gate-selection-authorization-fixture.ts';
import type { chain } from './gate-policy-chain-fixture.ts';

/** Synthetic identity-service keys only; never calls a provider or signs a gate. */
export function selectorIdentityFixture(type: 'human' | 'agent' = 'human') {
  const keys = generateKeyPairSync('ed25519');
  const trust = { version: 'steer-selector-identity-trust/v1', organizationId: 'synthetic', repository: 'github:1', branch: 'synthetic',
    identityIssuer: 'https://selector.synthetic.invalid', attestor: 'https://identity.synthetic.invalid', keyId: 'synthetic-identity-key',
    publicKeyHex: keys.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex'),
    notBefore: '2026-09-07T12:00:00Z', notAfter: '2026-09-07T12:01:00Z', revokedAt: null as string | null };
  const payload = { version: 'steer-selector-identity-attestation/v1', organizationId: trust.organizationId, repository: trust.repository,
    branch: trust.branch, identityIssuer: trust.identityIssuer, attestor: trust.attestor, keyId: trust.keyId,
    subject: 'synthetic-selector', type, sessionId: 'synthetic-selector-session', authenticatedAt: '2026-09-07T12:00:00.100000000Z',
    authenticationExpiresAt: '2026-09-07T12:00:00.250000000Z', recordedAt: '2026-09-07T12:00:00.150000000Z' };
  const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const raw = (text: string, domain = 'steer-selector-identity-attestation/v1\0') => ({ version: 'steer-selector-identity-proof/v1', payload: text,
    signatureBase64: sign(null, Buffer.from(domain + text), keys.privateKey).toString('base64') });
  const encode = () => raw(JSON.stringify(payload));
  const expected = () => ({ organizationId: trust.organizationId, repository: trust.repository, branch: trust.branch,
    identityIssuer: trust.identityIssuer, subject: payload.subject, type: payload.type, sessionId: payload.sessionId,
    authenticatedAt: payload.authenticatedAt, selectedAt: '2026-09-07T12:00:00.200000000Z', selectionRecordedAt: '2026-09-07T12:00:00.300000000Z',
    trustDigest: digest(trust), proofDigest: digest(encode()) });
  const evaluate = (proof: unknown = encode(), wanted: unknown = expected(), selected: unknown = trust, at: unknown = '2026-09-07T12:00:00.400000000Z') =>
    verifySelectorIdentityAttestation(proof, selected, wanted, at);
  return { trust, payload, digest, raw, encode, expected, evaluate };
}

export function identifySelection(f: ReturnType<typeof chain>, type: 'human' | 'agent' = 'human') {
  const selected = authorizeSelection(f, type), identity = selectorIdentityFixture(type), now = Date.now();
  Object.assign(identity.trust, { organizationId: selected.grant.organizationId, repository: selected.proof.payload.repository,
    branch: selected.proof.payload.branch, identityIssuer: selected.authorization.issuer,
    notBefore: new Date(now - 90000).toISOString(), notAfter: new Date(now + 60000).toISOString() });
  Object.assign(identity.payload, { organizationId: identity.trust.organizationId, repository: identity.trust.repository, branch: identity.trust.branch,
    identityIssuer: identity.trust.identityIssuer, subject: selected.grant.subject, authenticatedAt: new Date(now - 30000).toISOString(),
    authenticationExpiresAt: new Date(now + 30000).toISOString(), recordedAt: new Date(now - 20000).toISOString() });
  const reference = { trust: { path: '.steer/selector-identity-trust.json', digest: '' }, proof: { path: '.steer/selector-identity-proof.json', digest: '' },
    sessionId: identity.payload.sessionId, authenticatedAt: identity.payload.authenticatedAt };
  const publishIdentity = () => {
    const proof = identity.encode(); reference.trust.digest = identity.digest(identity.trust); reference.proof.digest = identity.digest(proof);
    Object.assign(selected.proof.payload, { selectorSessionId: reference.sessionId, selectorAuthenticatedAt: reference.authenticatedAt,
      selectorIdentityDigest: reference.proof.digest, selectorIdentityTrustDigest: reference.trust.digest });
    f.sources.set(reference.trust.path, JSON.stringify(identity.trust)); f.sources.set(reference.proof.path, JSON.stringify(proof)); selected.publish();
  };
  publishIdentity();
  return { ...selected, identity, reference, publishIdentity, configuration: { ...selected.configuration,
    selection: { ...selected.configuration.selection, attestation: { ...selected.attestation,
      authorization: { ...selected.authorization, identity: reference } } } } };
}
