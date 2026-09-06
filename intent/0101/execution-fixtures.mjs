// Closed two-line synthetic cost reproduction; no provider or general signer API.
import assert from 'node:assert/strict';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { makeCostGraph } from '../0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { jcs, sha256, TRUST_REGISTRY } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { correctionPolicyDigest } from '../0057/cost-correction.candidate.mjs';
import { createPrivacyCostTimeVerifier, policyDigest } from '../0063/privacy-cost-time.candidate.mjs';
const evaluatedAt = '2026-10-02T00:00:00Z', keys = new Map();
function seal(input, domain) {
  if (!keys.has(domain)) keys.set(domain, createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'),
    createHash('sha256').update(`steer-r3-r1-${domain}`).digest()]), format: 'der', type: 'pkcs8' }));
  const payload = Object.fromEntries(Object.entries(input).filter(([key]) => !['recordDigest', 'signature'].includes(key))), digest = sha256(jcs(payload));
  return { ...payload, recordDigest: digest, signature: { algorithm: 'Ed25519', keyId: `${domain}-key-v1`, signedDigest: digest,
    valueBase64: sign(null, Buffer.from(digest), keys.get(domain)).toString('base64') } };
}
function positive() {
  const graph = JSON.parse(makeCostGraph('invoice-two-lines-reordered')); graph.kind = 'reconciliation'; graph.decisionAt = evaluatedAt;
  graph.recordsBytes = graph.recordsBytes.map((bytes) => jcs(seal({ ...JSON.parse(bytes), kind: 'reconciliation' }, 'money')));
  const varianceRecordsBytes = [], reconciliationRecordsBytes = [];
  for (const [index, bytes] of graph.recordsBytes.entries()) {
    const record = JSON.parse(bytes), invoice = graph.providerInvoiceRecordsBytes.map(JSON.parse).find((row) => row.recordDigest === record.providerInvoiceDigest);
    const variance = seal({ varianceId: `variance-${index}`, invoiceDigest: record.providerInvoiceDigest, usageDigest: record.providerUsageDigest,
      ledgerDigest: record.recordDigest, providerTotalNanoUsd: invoice.totalNanoUsd, ledgerTotalNanoUsd: record.totalNanoUsd, varianceNanoUsd: '0',
      status: 'within-threshold', recordedAt: '2026-10-01T00:00:01Z' }, 'money');
    const successor = seal({ reconciliationId: `reconciliation-${index}`, predecessorInvoiceDigest: record.providerInvoiceDigest,
      predecessorUsageDigest: record.providerUsageDigest, predecessorLedgerDigest: record.recordDigest, varianceDigest: variance.recordDigest,
      successorStatus: 'reconciled', reconciledAt: evaluatedAt }, 'money');
    varianceRecordsBytes.push(jcs(variance)); reconciliationRecordsBytes.push(jcs(successor));
  }
  return { version: 'steer-r5-004-correction/v1', policyDigest: correctionPolicyDigest, graphBytes: jcs(graph), varianceRecordsBytes, reconciliationRecordsBytes };
}
function envelope(correction) {
  const graph = JSON.parse(correction.graphBytes), inventory = [];
  const add = (path, bytes, domain, field = null) => {
    const record = JSON.parse(bytes); inventory.push({ path, domain, bytesDigest: sha256(bytes), recordDigest: record.recordDigest,
      timeBasis: field === null ? 'observed-as-of' : `signed:${field}`, recordedAt: field === null ? evaluatedAt : record[field] });
  };
  add('graph/authorizationBytes', graph.authorizationBytes, 'money', 'sealedAt');
  add('graph/authorizationBytes/providerProof', jcs(JSON.parse(graph.authorizationBytes).providerProof), 'provider', 'recordedAt');
  add('graph/priceBytes', graph.priceBytes, 'money'); add('graph/priceProviderProofBytes', graph.priceProviderProofBytes, 'provider-usage', 'recordedAt');
  for (const [name, domain, field] of [['recordsBytes', 'money', null], ['providerUsageRecordsBytes', 'provider-usage', 'recordedAt'], ['providerInvoiceRecordsBytes', 'provider-invoice', 'issuedAt']])
    graph[name].forEach((bytes, index) => add(`graph/${name}/${index}`, bytes, domain, field));
  for (const [name, field] of [['varianceRecordsBytes', 'recordedAt'], ['reconciliationRecordsBytes', 'reconciledAt']])
    correction[name].forEach((bytes, index) => add(`correction/${name}/${index}`, bytes, 'money', field));
  const correctionBytes = jcs(correction);
  return jcs({ version: 'steer-privacy-cost-time/v1', policyDigest, kind: 'cost-reconciliation', correctionBytes,
    observationBytes: jcs(seal({ version: 'steer-evidence-observation/v1', kind: 'cost-reconciliation', correctionDigest: sha256(correctionBytes), policyDigest,
      registryDigest: sha256(jcs(TRUST_REGISTRY)), inventoryDigest: sha256(jcs(inventory)), recordCount: inventory.length, recordedAt: evaluatedAt }, 'verifier')) });
}
export function multilineCostExecutionCase(kind, permutation = 0) {
  assert.ok(['positive', 'missing-variance', 'missing-successor', 'missing-both'].includes(kind));
  assert.ok(Number.isInteger(permutation) && permutation >= 0 && permutation < 32);
  assert.ok(kind === 'positive' || permutation === 0);
  const complete = positive(), input = structuredClone(complete), graph = JSON.parse(input.graphBytes);
  const legacyBytes = jcs({ ...graph, varianceBytes: input.varianceRecordsBytes[0], reconciliationBytes: input.reconciliationRecordsBytes[0] });
  ['recordsBytes', 'providerUsageRecordsBytes', 'providerInvoiceRecordsBytes'].forEach((key, index) => { if (permutation & (1 << index)) graph[key].reverse(); });
  if (permutation & 8) input.varianceRecordsBytes.reverse(); if (permutation & 16) input.reconciliationRecordsBytes.reverse(); input.graphBytes = jcs(graph);
  if (['missing-variance', 'missing-both'].includes(kind)) input.varianceRecordsBytes.pop();
  if (['missing-successor', 'missing-both'].includes(kind)) input.reconciliationRecordsBytes.pop();
  return { complete, input, legacyBytes, correctionBytes: jcs(input), positiveBytes: envelope(complete), bytes: envelope(input), evaluatedAt,
    verifier: createPrivacyCostTimeVerifier(jcs({ version: 'steer-audit-clock/v1', evaluatedAt })) };
}
