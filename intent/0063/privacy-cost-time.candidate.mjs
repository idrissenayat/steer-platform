// Offline audit candidate only. No provider, spending, deletion or gate effects.
import { readFileSync } from 'node:fs';
import { exactKeys, jcs, parseCanonical, sha256, strictTime, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createTimedRecordVerifier } from '../0058/record-verifier.candidate.mjs';
import { correctedPrivacyGraphDecision, correctionPolicyDigest as privacyPolicy } from '../0056/privacy-correction.candidate.mjs';
import { correctedCostDecision, correctionPolicyDigest as costPolicy } from '../0057/cost-correction.candidate.mjs';

const registryBytes = jcs(JSON.parse(readFileSync(new URL('../0001/reviews/domain/round-3/remediation/TRUST-REGISTRY.candidate.json', import.meta.url), 'utf8')));
const timed = createTimedRecordVerifier(registryBytes);
export const policyDigest = sha256(jcs({ version: 'steer-privacy-cost-time/v1', privacyPolicy, costPolicy,
  registryDigest: timed.registryDigest, timePolicyDigest: timed.timePolicyDigest, observationDomain: 'verifier', arrayLimit: 64, recordLimit: 16384,
  rules: 'exact correction bytes and complete ordered record inventory; independent observation at graph decision; native signed time when present, otherwise observed-as-of, never inferred issuance; explicit trusted evaluation time; original checks mandatory; zero execution' }));
const requireValue = (value) => { if (!value) throw new Error('TIME_EVIDENCE_INVALID'); };
const time = (value) => { const result = strictTime(value); requireValue(result !== null); return result; };
const bytes = (value, limit) => typeof value === 'string' && value.length > 0 && value.length <= limit;

// Record paths, domains and time bases are selected by code, not supplied by the
// attestor. Absence of an issuance field is NOT filled with a guessed timestamp.
function inventoryFor(kind, correction, graph, observedAt, evaluatedAt, observerAnchor) {
  const inventory = [];
  const add = (path, serialized, domain, timeField = null) => {
    requireValue(bytes(serialized, 16384));
    const record = parseCanonical(serialized);
    const recordedAt = timeField === null ? observedAt : record[timeField];
    requireValue(time(recordedAt) <= time(observedAt));
    const verified = timed.verifyBytes(serialized, { domain, recordedAt, evaluatedAt });
    requireValue(verified.anchorDigest !== observerAnchor);
    inventory.push({ path, domain, bytesDigest: sha256(serialized), recordDigest: record.recordDigest,
      timeBasis: timeField === null ? 'observed-as-of' : `signed:${timeField}`, recordedAt });
  };
  const array = (path, rows, domain, field, nested = false) => {
    requireValue(Array.isArray(rows) && rows.length <= 64);
    rows.forEach((row, index) => add(`${path}/${index}${nested ? '/recordBytes' : ''}`, nested ? row.recordBytes : row, domain, field));
  };
  if (kind === 'privacy') {
    add('graph/sourceAuthorityBytes', graph.sourceAuthorityBytes, 'authority');
    add('graph/useAuthorizationBytes', graph.useAuthorizationBytes, 'authority');
    add('graph/sanitizerRunBytes', graph.sanitizerRunBytes, 'record');
    add('graph/inspectionBytes', graph.inspectionBytes, 'record');
    array('graph/rawCopies', graph.rawCopies, 'record', 'createdAt', true);
    array('graph/rawAuthorities', graph.rawAuthorities, 'authority', null, true);
    array('graph/rawReceipts', graph.rawReceipts, 'provider', 'recordedAt', true);
    // Evaluation cannot resurrect an old source/use grant by selecting its old
    // decision time. This still grants no new corpus use or disposal authority.
    const source = parseCanonical(graph.sourceAuthorityBytes), use = parseCanonical(graph.useAuthorizationBytes);
    requireValue(time(evaluatedAt) < time(source.validThrough) && time(evaluatedAt) < time(use.validThrough));
    for (const copy of graph.rawCopies) {
      const receipt = graph.rawReceipts.find((row) => row.copyId === copy.copyId);
      requireValue(receipt && time(parseCanonical(copy.recordBytes).createdAt) <= time(parseCanonical(receipt.recordBytes).recordedAt));
    }
  } else {
    add('graph/authorizationBytes', graph.authorizationBytes, 'money', 'sealedAt');
    const authorization = parseCanonical(graph.authorizationBytes);
    add('graph/authorizationBytes/providerProof', jcs(authorization.providerProof), 'provider', 'recordedAt');
    add('graph/priceBytes', graph.priceBytes, 'money');
    add('graph/priceProviderProofBytes', graph.priceProviderProofBytes, 'provider-usage', 'recordedAt');
    array('graph/recordsBytes', graph.recordsBytes, 'money', null);
    array('graph/providerUsageRecordsBytes', graph.providerUsageRecordsBytes, 'provider-usage', 'recordedAt');
    array('graph/providerInvoiceRecordsBytes', graph.providerInvoiceRecordsBytes, 'provider-invoice', 'issuedAt');
    array('correction/varianceRecordsBytes', correction.varianceRecordsBytes, 'money', 'recordedAt');
    array('correction/reconciliationRecordsBytes', correction.reconciliationRecordsBytes, 'money', 'reconciledAt');
  }
  return inventory;
}

/** Composition supplies the evaluation clock, never an untrusted tool argument.
 * Construct for each audit; no Date.now fallback and no request-selected registry.
 * The independent attestation proves observation of bytes, NOT their issuance. */
export function createPrivacyCostTimeVerifier(contextBytes) {
  let evaluatedAt;
  try {
    requireValue(bytes(contextBytes, 1024)); const context = parseCanonical(contextBytes);
    requireValue(exactKeys(context, ['version', 'evaluatedAt']) && context.version === 'steer-audit-clock/v1');
    time(context.evaluatedAt); evaluatedAt = context.evaluatedAt;
  } catch { throw new Error('TIME_CONTEXT_INVALID'); }
  return Object.freeze({
    verify(serialized) {
      // One fixed rejection shape: no raw prompt, source, money or error echo.
      const reject = () => ({ decision: 'DENY', firstError: 'TIME_EVIDENCE_INVALID', effects: zeroEffects() });
      try {
        requireValue(bytes(serialized, 12582912)); const envelope = parseCanonical(serialized);
        requireValue(exactKeys(envelope, ['version', 'policyDigest', 'kind', 'correctionBytes', 'observationBytes']) &&
          envelope.version === 'steer-privacy-cost-time/v1' && envelope.policyDigest === policyDigest &&
          ['privacy', 'cost-reconciliation'].includes(envelope.kind) && bytes(envelope.correctionBytes, 8388608) && bytes(envelope.observationBytes, 65536));
        const correction = parseCanonical(envelope.correctionBytes);
        requireValue(bytes(correction.graphBytes, 4194304)); const graph = parseCanonical(correction.graphBytes);
        requireValue(time(graph.decisionAt) <= time(evaluatedAt));
        const observation = parseCanonical(envelope.observationBytes);
        requireValue(exactKeys(observation, ['version', 'kind', 'correctionDigest', 'policyDigest', 'registryDigest', 'inventoryDigest', 'recordCount', 'recordedAt', 'recordDigest', 'signature']) &&
          observation.version === 'steer-evidence-observation/v1' && observation.kind === envelope.kind &&
          observation.correctionDigest === sha256(envelope.correctionBytes) && observation.policyDigest === policyDigest &&
          observation.registryDigest === timed.registryDigest && observation.recordedAt === graph.decisionAt);
        const observer = timed.verifyBytes(envelope.observationBytes, { domain: 'verifier', recordedAt: observation.recordedAt, evaluatedAt });
        const inventory = inventoryFor(envelope.kind, correction, graph, observation.recordedAt, evaluatedAt, observer.anchorDigest);
        requireValue(observation.inventoryDigest === sha256(jcs(inventory)) && observation.recordCount === inventory.length);
        // Keep the 0056 Unicode and 0057 all-line lineage checks mandatory, after
        // every original signature (including nested provider proof) is timed.
        const result = envelope.kind === 'privacy' ? correctedPrivacyGraphDecision(envelope.correctionBytes) : correctedCostDecision(envelope.correctionBytes);
        requireValue(result.decision === (envelope.kind === 'privacy' ? 'ACCEPT' : 'ALLOW'));
        return { ...result, timePolicyDigest: policyDigest, evaluatedAt, observationDigest: observation.recordDigest,
          timedRecordCount: inventory.length, observedAsOfCount: inventory.filter((row) => row.timeBasis === 'observed-as-of').length };
      } catch { return reject(); }
    },
  });
}
