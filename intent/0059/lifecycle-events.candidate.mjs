// Closed event/history candidate. Validation is not lifecycle-effect authorization.
import { readFileSync } from 'node:fs';
import { compilePreciseSchema, schemaPolicyDigest } from '../0070/precision-schemas.candidate.mjs';
import { exactInstant as strictTime } from '../0069/exact-time.candidate.mjs';
import { exactKeys, jcs, parseCanonical, sha256, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createTimedRecordVerifier } from '../0058/record-verifier.candidate.mjs';
import { lifecycleEventFollows, eventOrderPolicyDigest } from '../0071/event-order.candidate.mjs';

const schema = compilePreciseSchema('LIFECYCLE-EVENT.schema.json');
const registryBytes = jcs(JSON.parse(readFileSync(new URL('../0001/reviews/domain/round-3/remediation/TRUST-REGISTRY.candidate.json', import.meta.url), 'utf8')));
const verifier = createTimedRecordVerifier(registryBytes);
export const correctionPolicyBytes = jcs({ version: 'steer-r5-001-events/v1', finding: 'PREFLIGHT-R3-R5-001',
  registryDigest: verifier.registryDigest, timePolicyDigest: verifier.timePolicyDigest, schemaPolicyDigest, contract: 'closed current and prior lifecycle events with complete provider proof binding',
  eventOrderPolicyDigest, times: 'exact instants with policy-ranked equal-time order; recordedAt equals occurredAt; key valid at event and evaluation time',
  scope: 'same organization/item/environment; does not authorize a record disposition', historyLimit: 128, recordLimit: 65536, envelopeLimit: 8388608,
});
export const correctionPolicyDigest = sha256(correctionPolicyBytes);
const blocked = (firstError) => ({ state: 'blocked-policy-conflict', firstError, effects: zeroEffects() });
export function correctedLifecycleEventDecision(serialized) {
  return verifyLifecycleEvents(serialized, verifier, correctionPolicyDigest);
}

export function createLifecycleEventVerifier(trustedRegistryBytes) {
  let selected;
  try {
    selected = createTimedRecordVerifier(trustedRegistryBytes);
    const registry = parseCanonical(trustedRegistryBytes);
    for (const original of parseCanonical(registryBytes).bindings) {
      const matches = registry.bindings.filter((key) => key.domain === original.domain && key.keyId === original.keyId);
      if (matches.length !== 1 || ['algorithm', 'publicKeyHex', 'notBefore', 'notAfter'].some((field) => matches[0][field] !== original[field]) ||
          (original.revokedAt !== null && (matches[0].revokedAt === null || strictTime(matches[0].revokedAt) > strictTime(original.revokedAt))))
        throw new Error('CURRENT_EVENT_TRUST_INVALID');
    }
  } catch { throw new Error('CURRENT_EVENT_CONFIGURATION_INVALID'); }
  const policyBytes = jcs({ ...parseCanonical(correctionPolicyBytes), registryDigest: selected.registryDigest }), policyDigest = sha256(policyBytes);
  return Object.freeze({ policyBytes, policyDigest,
    verify(serialized, evaluationTime) {
      try {
        if (strictTime(evaluationTime) === null || typeof serialized !== 'string' || serialized.length > 8388608 ||
            parseCanonical(serialized).evaluationTime !== evaluationTime) throw new Error('CLOCK_INVALID');
        return { ...verifyLifecycleEvents(serialized, selected, policyDigest), executionAuthorized: false };
      } catch { return { ...blocked('EVENT_CURRENT_CLOCK_INVALID'), executionAuthorized: false }; }
    },
  });
}

function verifyLifecycleEvents(serialized, verifier, expectedPolicyDigest) {
  try {
    if (typeof serialized !== 'string' || serialized.length > 8388608) return blocked('EVENT_ENVELOPE_INVALID');
    const envelope = parseCanonical(serialized);
    if (!exactKeys(envelope, ['version', 'policyDigest', 'scope', 'eventBytes', 'historyBytes', 'evaluationTime']) ||
        envelope.version !== 'steer-r5-001-events/v1' || envelope.policyDigest !== expectedPolicyDigest ||
        !exactKeys(envelope.scope, ['organization', 'itemId', 'environmentId']) ||
        typeof envelope.scope.organization !== 'string' || !envelope.scope.organization || envelope.scope.organization.length > 256 ||
        ['itemId', 'environmentId'].some((field) => envelope.scope[field] !== null &&
          (typeof envelope.scope[field] !== 'string' || !envelope.scope[field] || envelope.scope[field].length > 256)) ||
        !Array.isArray(envelope.historyBytes) || envelope.historyBytes.length > 128 || strictTime(envelope.evaluationTime) === null)
      return blocked('EVENT_ENVELOPE_INVALID');
    const inputs = [...envelope.historyBytes, envelope.eventBytes];
    if (inputs.some((bytes) => typeof bytes !== 'string' || !bytes.length || bytes.length > 65536)) return blocked('EVENT_INPUT_INVALID');
    const ids = new Set(), digests = new Set(), proofIds = new Set(), proofDigests = new Set(); let prior = null, current;
    for (const bytes of inputs) {
      const event = parseCanonical(bytes);
      if (schema(event).length) return blocked('EVENT_SCHEMA_INVALID');
      if (Object.keys(envelope.scope).some((field) => event[field] !== envelope.scope[field])) return blocked('EVENT_SCOPE_INVALID');
      const at = strictTime(event.occurredAt);
      if (at === null || !lifecycleEventFollows(prior, event)) return blocked('EVENT_ORDER_INVALID');
      const eventChecked = verifier.verifyBytes(bytes, { domain: 'record', recordedAt: event.occurredAt, evaluatedAt: envelope.evaluationTime });
      const rawProof = parseCanonical(event.providerProofBytes);
      const { record: proof, anchorDigest } = verifier.verifyBytes(event.providerProofBytes, { domain: 'provider', recordedAt: rawProof.recordedAt, evaluatedAt: envelope.evaluationTime });
      if (anchorDigest === eventChecked.anchorDigest) return blocked('EVENT_PROVIDER_INDEPENDENCE_INVALID');
      if (!exactKeys(proof, ['providerRecordId', 'eventId', 'eventBindingDigest', 'recordedAt', 'recordDigest', 'signature'])) return blocked('EVENT_PROOF_SCHEMA_INVALID');
      const payload = Object.fromEntries(Object.entries(event).filter(([field]) => !['providerProofDigest', 'providerProofBytes', 'recordDigest', 'signature'].includes(field)));
      if (proof.eventId !== event.eventId || proof.providerRecordId !== event.providerRecordId || proof.recordedAt !== event.occurredAt ||
          proof.eventBindingDigest !== sha256(jcs(payload)) || proof.recordDigest !== event.providerProofDigest) return blocked('EVENT_PROOF_BINDING_INVALID');
      if (ids.has(event.eventId.toLowerCase()) || digests.has(event.recordDigest) || proofIds.has(proof.providerRecordId) || proofDigests.has(proof.recordDigest)) return blocked('EVENT_REPLAY');
      ids.add(event.eventId.toLowerCase()); digests.add(event.recordDigest); proofIds.add(proof.providerRecordId); proofDigests.add(proof.recordDigest);
      prior = event; current = event;
    }
    return { state: 'validated-trigger', firstError: null, effects: zeroEffects(), eventId: current.eventId, eventDigest: current.recordDigest,
      verifiedHistoryCount: envelope.historyBytes.length, correctionPolicyDigest: expectedPolicyDigest };
  } catch { return blocked('EVENT_TIMED_EVIDENCE_INVALID'); }
}
