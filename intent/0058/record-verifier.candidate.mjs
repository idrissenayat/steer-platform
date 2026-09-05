// Offline candidate verifier. Trust is supplied by composition, never by a request.
import { createPublicKey, verify } from 'node:crypto';
import { exactKeys, jcs, parseCanonical, sha256 } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { exactInstant as strictTime, timePolicyDigest } from '../0069/exact-time.candidate.mjs';

export function createTimedRecordVerifier(trustedRegistryBytes) {
  const invalid = () => { throw new Error('TRUST_CONFIGURATION_INVALID'); };
  if (typeof trustedRegistryBytes !== 'string' || trustedRegistryBytes.length > 65536) invalid();
  let registry;
  try { registry = parseCanonical(trustedRegistryBytes); } catch { invalid(); }
  if (!exactKeys(registry, ['version', 'bindings']) || registry.version !== 'steer-r3-trust-registry/v1' ||
      !Array.isArray(registry.bindings) || !registry.bindings.length || registry.bindings.length > 128) invalid();
  const selectors = new Set();
  const anchors = registry.bindings.map((binding) => {
    if (!exactKeys(binding, ['domain', 'keyId', 'algorithm', 'publicKeyHex', 'notBefore', 'notAfter', 'revokedAt']) ||
        typeof binding.domain !== 'string' || !binding.domain || typeof binding.keyId !== 'string' || !binding.keyId ||
        binding.algorithm !== 'Ed25519' || !/^[0-9a-f]{64}$/.test(binding.publicKeyHex)) invalid();
    const from = strictTime(binding.notBefore), until = strictTime(binding.notAfter), revoked = binding.revokedAt === null ? null : strictTime(binding.revokedAt);
    if (from === null || until === null || from >= until || (binding.revokedAt !== null && revoked === null)) invalid();
    const selector = jcs([binding.domain, binding.keyId, binding.algorithm]); if (selectors.has(selector)) invalid(); selectors.add(selector);
    const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(binding.publicKeyHex, 'hex')]), format: 'der', type: 'spki' });
    return { ...binding, from, until, revoked, key, digest: sha256(binding.publicKeyHex) };
  });
  return Object.freeze({
    registryDigest: sha256(trustedRegistryBytes),
    timePolicyDigest,
    verifyBytes(serialized, context) {
      try {
      const fail = () => { throw new Error('TIMED_RECORD_INVALID'); };
      if (typeof serialized !== 'string' || serialized.length > 65536 ||
          !exactKeys(context, ['domain', 'recordedAt', 'evaluatedAt'])) fail();
      const recorded = strictTime(context.recordedAt), evaluated = strictTime(context.evaluatedAt);
      if (recorded === null || evaluated === null || recorded > evaluated) fail();
      const record = parseCanonical(serialized), signature = record?.signature;
      if (!record || Array.isArray(record) || !exactKeys(signature, ['algorithm', 'keyId', 'signedDigest', 'valueBase64'])) fail();
      const matches = anchors.filter((anchor) => anchor.domain === context.domain && anchor.keyId === signature.keyId && anchor.algorithm === signature.algorithm);
      if (matches.length !== 1) fail(); const anchor = matches[0];
      for (const time of [recorded, evaluated]) if (time < anchor.from || time >= anchor.until || (anchor.revoked !== null && time >= anchor.revoked)) fail();
      const payload = Object.fromEntries(Object.entries(record).filter(([field]) => !['recordDigest', 'signature'].includes(field)));
      const digest = sha256(jcs(payload));
      if (record.recordDigest !== digest || signature.signedDigest !== digest || typeof signature.valueBase64 !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(signature.valueBase64)) fail();
      const bytes = Buffer.from(signature.valueBase64, 'base64');
      if (bytes.toString('base64') !== signature.valueBase64 || !verify(null, Buffer.from(digest), anchor.key, bytes)) fail();
      return { record, anchorDigest: anchor.digest };
      } catch { throw new Error('TIMED_RECORD_INVALID'); }
    },
  });
}
