// Offline audit only. A verified historical decision never authorizes spending.
import { readFileSync } from 'node:fs';
import { costDecision, spendDecision } from '../0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { exactKeys, jcs, parseCanonical, sha256, strictTime, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createTimedRecordVerifier } from '../0058/record-verifier.candidate.mjs';

const registryBytes = jcs(JSON.parse(readFileSync(new URL('../0001/reviews/domain/round-3/remediation/TRUST-REGISTRY.candidate.json', import.meta.url), 'utf8')));
const timed = createTimedRecordVerifier(registryBytes);
export const policyDigest = sha256(jcs({ version: 'steer-money-time/v1', registryDigest: timed.registryDigest,
  kinds: ['spend', 'cost-forecast', 'cost-invoice', 'cost-aggregate'], observationDomain: 'verifier', arrayLimit: 64, recordLimit: 16384,
  freshnessMs: 300000, rules: 'complete exact-byte observation at decision; native event time or explicit observed-as-of; trusted evaluation; current spend/forecast grants; current spend replay/head/reservation; mandatory frozen semantics; audit-only no execution authority' }));
const requireValue = (value) => { if (!value) throw new Error('MONEY_TIME_INVALID'); };
const bytes = (value, limit) => typeof value === 'string' && value.length > 0 && value.length <= limit;
const time = (value) => { const parsed = strictTime(value); requireValue(parsed !== null); return parsed; };
const rows = (value, nonempty = false) => { requireValue(Array.isArray(value) && value.length <= 64 && (!nonempty || value.length > 0)); return value; };

function inventoryFor(kind, graph, evaluatedAt, observerAnchor) {
  const inventory = [], observationAt = graph.decisionAt, observation = time(observationAt), evaluation = time(evaluatedAt);
  const add = (path, serialized, domain, field) => {
    requireValue(bytes(serialized, 16384)); const record = parseCanonical(serialized), recordedAt = field === null ? observationAt : record[field];
    requireValue(time(recordedAt) <= observation);
    const verified = timed.verifyBytes(serialized, { domain, recordedAt, evaluatedAt });
    requireValue(verified.anchorDigest !== observerAnchor);
    inventory.push({ path, domain, bytesDigest: sha256(serialized), recordDigest: record.recordDigest,
      timeBasis: field === null ? 'observed-as-of' : `signed:${field}`, recordedAt });
    return record;
  };
  const authorization = (path, serialized, current) => {
    const value = add(path, serialized, 'money', 'sealedAt');
    const proof = add(`${path}/providerProof`, jcs(value.providerProof), 'provider', 'recordedAt');
    requireValue(time(value.sealedAt) <= time(proof.recordedAt));
    if (current) requireValue(time(value.effectiveAt) <= evaluation && evaluation < time(value.expiresAt));
    return value;
  };
  if (kind === 'spend') {
    rows(graph.authorizationChainBytes, true).forEach((value, index) => authorization(`graph/authorizationChainBytes/${index}`, value, true));
    add('graph/consumerBytes', graph.consumerBytes, 'money', 'requestedAt');
    for (const [key, domain, field] of [['replayLedgerBytes', 'replay-authority', 'snapshotAt'], ['casHeadBytes', 'cas-authority', 'snapshotAt'], ['casReservationBytes', 'cas-authority', 'recordedAt']]) {
      const record = add(`graph/${key}`, graph[key], domain, field);
      requireValue(evaluation < time(record.validThrough) && evaluation - time(record[field]) <= 300000);
    }
  } else {
    requireValue(graph.kind === kind.slice(5) && ['forecast', 'invoice', 'aggregate'].includes(graph.kind));
    authorization('graph/authorizationBytes', graph.authorizationBytes, graph.kind === 'forecast');
    const price = add('graph/priceBytes', graph.priceBytes, 'money', null);
    if (graph.kind === 'forecast') requireValue(time(price.effectiveAt) <= evaluation && evaluation < time(price.expiresAt));
    add('graph/priceProviderProofBytes', graph.priceProviderProofBytes, 'provider-usage', 'recordedAt');
    rows(graph.recordsBytes, true).forEach((value, index) => add(`graph/recordsBytes/${index}`, value, 'money', null));
    rows(graph.providerUsageRecordsBytes).forEach((value, index) => add(`graph/providerUsageRecordsBytes/${index}`, value, 'provider-usage', 'recordedAt'));
    rows(graph.providerInvoiceRecordsBytes).forEach((value, index) => add(`graph/providerInvoiceRecordsBytes/${index}`, value, 'provider-invoice', 'issuedAt'));
    // Reconciliation cannot select the old scalar first-line path here. Its only
    // corrected composition remains 0057/0063 with full plural successor lineage.
    requireValue(graph.varianceBytes === '' && graph.reconciliationBytes === '');
    rows(graph.forecastScenarios);
  }
  return inventory;
}

// Install the clock in trusted composition for each audit. This is not a tool
// parameter or executable spend policy, and there is no caller registry override.
export function createMoneyTimeVerifier(contextBytes) {
  let evaluatedAt;
  try {
    requireValue(bytes(contextBytes, 1024)); const context = parseCanonical(contextBytes);
    requireValue(exactKeys(context, ['version', 'evaluatedAt']) && context.version === 'steer-audit-clock/v1');
    time(context.evaluatedAt); evaluatedAt = context.evaluatedAt;
  } catch { throw new Error('MONEY_TIME_CONTEXT_INVALID'); }
  return Object.freeze({
    verify(serialized) {
      const reject = () => ({ decision: 'DENY', firstError: 'MONEY_TIME_INVALID', effects: zeroEffects(), executionAuthorized: false });
      try {
        requireValue(bytes(serialized, 8388608)); const input = parseCanonical(serialized);
        requireValue(exactKeys(input, ['version', 'policyDigest', 'kind', 'graphBytes', 'observationBytes']) && input.version === 'steer-money-time/v1' &&
          input.policyDigest === policyDigest && ['spend', 'cost-forecast', 'cost-invoice', 'cost-aggregate'].includes(input.kind) &&
          bytes(input.graphBytes, 4194304) && bytes(input.observationBytes, 65536));
        const graph = parseCanonical(input.graphBytes); requireValue(time(graph.decisionAt) <= time(evaluatedAt));
        const observation = parseCanonical(input.observationBytes);
        requireValue(exactKeys(observation, ['version', 'kind', 'graphDigest', 'policyDigest', 'registryDigest', 'inventoryDigest', 'recordCount', 'recordedAt', 'recordDigest', 'signature']) &&
          observation.version === 'steer-money-observation/v1' && observation.kind === input.kind && observation.graphDigest === sha256(input.graphBytes) &&
          observation.policyDigest === policyDigest && observation.registryDigest === timed.registryDigest && observation.recordedAt === graph.decisionAt);
        const observer = timed.verifyBytes(input.observationBytes, { domain: 'verifier', recordedAt: observation.recordedAt, evaluatedAt });
        const inventory = inventoryFor(input.kind, graph, evaluatedAt, observer.anchorDigest);
        requireValue(observation.recordCount === inventory.length && observation.inventoryDigest === sha256(jcs(inventory)));
        const result = input.kind === 'spend' ? spendDecision(input.graphBytes) : costDecision(input.graphBytes);
        requireValue(result.decision === 'ALLOW' || input.kind === 'spend' && result.decision === 'REPLAY_NOOP');
        return { ...result, decision: 'VERIFIED', recordedDecision: result.decision, executionAuthorized: false,
          timePolicyDigest: policyDigest, evaluatedAt, observationDigest: observation.recordDigest,
          timedRecordCount: inventory.length, observedAsOfCount: inventory.filter((row) => row.timeBasis === 'observed-as-of').length };
      } catch { return reject(); }
    },
  });
}
