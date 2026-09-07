// Synthetic keys/signing only. Production has verification, never this signer.
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { verifyGateSelectionAttestation } from '../src/identity/gate-selection-proof.ts';
export function selectionProofFixture() {
  const keys = generateKeyPairSync('ed25519');
  const identity = {} as { selectorIssuer?: string; selectorType?: 'human' | 'agent' };
  const authorization = {} as { selectorAuthorizationPath?: string; selectorAuthorizationRevision?: string; selectorAuthorizationDigest?: string };
  const trust = { version: 'steer-gate-selection-trust/v1', organizationId: 'synthetic', repository: 'github:1', branch: 'synthetic',
    selectorSubject: 'synthetic-selector', attestor: 'https://selection.synthetic.invalid', keyId: 'synthetic-selection-key',
    publicKeyHex: keys.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex'),
    notBefore: '2026-09-07T12:00:00Z', notAfter: '2026-09-07T12:01:00Z', revokedAt: null as string | null, ...identity };
  const payload = { version: 'steer-gate-selection-attestation/v1', attestor: trust.attestor, keyId: trust.keyId,
    organizationId: trust.organizationId, repository: trust.repository, branch: trust.branch, selectorSubject: trust.selectorSubject,
    recordItem: 'synthetic-item', platformRevision: 'a'.repeat(40), decisionDigest: 'b'.repeat(64),
    selectionPath: '.steer/gate-policy-selection.json', selectionDigest: 'c'.repeat(64), configurationDigest: 'd'.repeat(64),
    selectionId: 'synthetic-selection-1', selectedAt: '2026-09-07T12:00:00.100000000Z',
    recordedAt: '2026-09-07T12:00:00.200000000Z', validBefore: '2026-09-07T12:00:30Z', ...identity, ...authorization };
  const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const raw = (text: string, prefix = 'steer-gate-selection-attestation/v1\0') => ({ version: 'steer-gate-selection-proof/v1', payload: text,
    signatureBase64: sign(null, Buffer.from(prefix + text), keys.privateKey).toString('base64') });
  const encode = () => raw(JSON.stringify(payload));
  const expected = () => ({ organizationId: payload.organizationId, repository: payload.repository, branch: payload.branch,
    selectorSubject: payload.selectorSubject, recordItem: payload.recordItem, platformRevision: payload.platformRevision,
    decisionDigest: payload.decisionDigest, selectionPath: payload.selectionPath, selectionDigest: payload.selectionDigest,
    configurationDigest: payload.configurationDigest, selectionId: payload.selectionId, selectedAt: payload.selectedAt,
    trustDigest: digest(trust), proofDigest: digest(encode()),
    ...(payload.selectorIssuer === undefined ? {} : { selectorIssuer: payload.selectorIssuer, selectorType: payload.selectorType,
      selectorAuthorizationPath: payload.selectorAuthorizationPath, selectorAuthorizationRevision: payload.selectorAuthorizationRevision,
      selectorAuthorizationDigest: payload.selectorAuthorizationDigest }) });
  const evaluate = (proof: unknown = encode(), wanted: unknown = expected(), selected: unknown = trust, at: unknown = '2026-09-07T12:00:00.300000000Z') =>
    verifyGateSelectionAttestation(proof, selected, wanted, at);
  return { trust, payload, raw, encode, digest, expected, evaluate };
}
