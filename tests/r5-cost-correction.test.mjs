import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { correctedCostDecision as corrected, correctionPolicyDigest } from '../intent/0057/cost-correction.candidate.mjs';
import { makeCostGraph } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { costDecision as frozen } from '../intent/0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { jcs, sha256, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';

// Module-private synthetic money signer, same public test anchor as frozen fixtures.
// Never exported or used for real provider/human evidence.
const seed = createHash('sha256').update('steer-r3-r1-money').digest();
const key = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]), format: 'der', type: 'pkcs8' });
function seal(record) {
  const payload = Object.fromEntries(Object.entries(record).filter(([field]) => !['recordDigest', 'signature'].includes(field)));
  const digest = sha256(jcs(payload));
  return { ...payload, recordDigest: digest, signature: { algorithm: 'Ed25519', keyId: 'money-key-v1', signedDigest: digest, valueBase64: sign(null, Buffer.from(digest), key).toString('base64') } };
}
function fixture() {
  const graph = JSON.parse(makeCostGraph('invoice-two-lines-reordered'));
  graph.kind = 'reconciliation'; graph.decisionAt = '2026-10-02T00:00:00Z';
  graph.recordsBytes = graph.recordsBytes.map((bytes) => jcs(seal({ ...JSON.parse(bytes), kind: 'reconciliation' })));
  const variances = [], reconciliations = [];
  for (const [index, bytes] of graph.recordsBytes.entries()) {
    const record = JSON.parse(bytes), invoice = graph.providerInvoiceRecordsBytes.map(JSON.parse).find((row) => row.recordDigest === record.providerInvoiceDigest);
    const variance = seal({ varianceId: `variance-${index}`, invoiceDigest: record.providerInvoiceDigest, usageDigest: record.providerUsageDigest,
      ledgerDigest: record.recordDigest, providerTotalNanoUsd: invoice.totalNanoUsd, ledgerTotalNanoUsd: record.totalNanoUsd, varianceNanoUsd: '0', status: 'within-threshold', recordedAt: '2026-10-01T00:00:01Z' });
    const reconciliation = seal({ reconciliationId: `reconciliation-${index}`, predecessorInvoiceDigest: record.providerInvoiceDigest,
      predecessorUsageDigest: record.providerUsageDigest, predecessorLedgerDigest: record.recordDigest, varianceDigest: variance.recordDigest,
      successorStatus: 'reconciled', reconciledAt: '2026-10-02T00:00:00Z' });
    variances.push(jcs(variance)); reconciliations.push(jcs(reconciliation));
  }
  return { version: 'steer-r5-004-correction/v1', policyDigest: correctionPolicyDigest, graphBytes: jcs(graph), varianceRecordsBytes: variances, reconciliationRecordsBytes: reconciliations };
}
function changeVariance(input, patch) {
  const variance = seal({ ...JSON.parse(input.varianceRecordsBytes[1]), ...patch });
  input.varianceRecordsBytes[1] = jcs(variance);
  input.reconciliationRecordsBytes[1] = jcs(seal({ ...JSON.parse(input.reconciliationRecordsBytes[1]), varianceDigest: variance.recordDigest }));
}

test('R5-004: frozen two-line graph accepts one pair; corrected graph requires both before aggregating', () => {
  const input = fixture(), graph = JSON.parse(input.graphBytes), before = jcs(input);
  assert.equal(frozen(jcs({ ...graph, varianceBytes: input.varianceRecordsBytes[0], reconciliationBytes: input.reconciliationRecordsBytes[0] })).decision, 'ALLOW');
  for (const key of ['varianceRecordsBytes', 'reconciliationRecordsBytes']) {
    const missing = structuredClone(input); missing[key].pop();
    assert.equal(corrected(jcs(missing)).firstError, 'LINEAGE_MULTIPLICITY_INVALID');
  }
  const result = corrected(jcs(input));
  assert.equal(result.decision, 'ALLOW'); assert.equal(result.reconciledLineCount, 2);
  assert.equal(result.aggregateNanoUsd, '9800000'); assert.equal(result.roundedCents, '1');
  assert.deepEqual(result.effects, zeroEffects()); assert.equal(jcs(input), before);
});

test('all 32 independent array reorderings preserve exact lineage and aggregate', () => {
  const baseline = fixture();
  for (let mask = 0; mask < 32; mask++) {
    const input = structuredClone(baseline), graph = JSON.parse(input.graphBytes);
    for (const [bit, field] of ['recordsBytes', 'providerUsageRecordsBytes', 'providerInvoiceRecordsBytes'].entries()) if (mask & (1 << bit)) graph[field].reverse();
    if (mask & 8) input.varianceRecordsBytes.reverse(); if (mask & 16) input.reconciliationRecordsBytes.reverse();
    input.graphBytes = jcs(graph);
    assert.deepEqual(corrected(jcs(input)), corrected(jcs(baseline)), `permutation ${mask}`);
  }
});

test('duplicate, orphan, cross-line, corrupt, amount and timestamp evidence denies with zero effects', () => {
  const cases = [
    (x) => { x.varianceRecordsBytes[1] = x.varianceRecordsBytes[0]; },
    (x) => { x.reconciliationRecordsBytes[1] = x.reconciliationRecordsBytes[0]; },
    (x) => { const v = JSON.parse(x.varianceRecordsBytes[1]); v.varianceId = JSON.parse(x.varianceRecordsBytes[0]).varianceId; x.varianceRecordsBytes[1] = jcs(seal(v)); },
    (x) => { const r = JSON.parse(x.reconciliationRecordsBytes[1]); r.reconciliationId = JSON.parse(x.reconciliationRecordsBytes[0]).reconciliationId; x.reconciliationRecordsBytes[1] = jcs(seal(r)); },
    (x) => { const v = JSON.parse(x.varianceRecordsBytes[1]); v.ledgerDigest = 'f'.repeat(64); x.varianceRecordsBytes[1] = jcs(seal(v)); },
    (x) => { const r = JSON.parse(x.reconciliationRecordsBytes[1]); r.varianceDigest = JSON.parse(x.varianceRecordsBytes[0]).recordDigest; x.reconciliationRecordsBytes[1] = jcs(seal(r)); },
    (x) => { const v = JSON.parse(x.varianceRecordsBytes[1]); v.invoiceDigest = JSON.parse(x.varianceRecordsBytes[0]).invoiceDigest; x.varianceRecordsBytes[1] = jcs(seal(v)); },
    (x) => { const r = JSON.parse(x.reconciliationRecordsBytes[1]); r.predecessorUsageDigest = JSON.parse(x.reconciliationRecordsBytes[0]).predecessorUsageDigest; x.reconciliationRecordsBytes[1] = jcs(seal(r)); },
    (x) => changeVariance(x, { providerTotalNanoUsd: '0', ledgerTotalNanoUsd: '0' }),
    (x) => changeVariance(x, { recordedAt: '2026-10-03T00:00:00Z' }),
    (x) => { const r = JSON.parse(x.reconciliationRecordsBytes[1]); r.reconciledAt = '2026-10-02T00:00:01Z'; x.reconciliationRecordsBytes[1] = jcs(seal(r)); },
    (x) => { const r = JSON.parse(x.reconciliationRecordsBytes[1]); r.signature.valueBase64 = Buffer.alloc(64).toString('base64'); x.reconciliationRecordsBytes[1] = jcs(r); },
  ];
  for (const [index, mutate] of cases.entries()) {
    const input = fixture(); mutate(input); const result = corrected(jcs(input));
    assert.equal(result.decision, 'DENY', `case ${index}`); assert.deepEqual(result.effects, zeroEffects());
    assert.equal('aggregateNanoUsd' in result, false);
  }
});

test('internally consistent signed amount/time claims are checked against actual lineage facts', () => {
  const amount = fixture(); changeVariance(amount, { providerTotalNanoUsd: '0', ledgerTotalNanoUsd: '0' });
  assert.equal(corrected(jcs(amount)).firstError, 'RECONCILIATION_AMOUNT_INVALID');
  const time = fixture(); changeVariance(time, { recordedAt: '2026-10-03T00:00:00Z' });
  assert.equal(corrected(jcs(time)).firstError, 'RECONCILIATION_TIME_INVALID');
});

test('all six prior reconciliation cases retain expected results and base authorization remains mandatory', () => {
  for (const kind of ['reconcile-before-invoice', 'reconcile-at-24h', 'reconcile-after-24h', 'predecessor-gap', 'predecessor-fork', 'provider-unavailable-late']) {
    const source = makeCostGraph(kind), graph = JSON.parse(source);
    const envelope = { version: 'steer-r5-004-correction/v1', policyDigest: correctionPolicyDigest,
      graphBytes: jcs({ ...graph, varianceBytes: '', reconciliationBytes: '' }), varianceRecordsBytes: [graph.varianceBytes], reconciliationRecordsBytes: [graph.reconciliationBytes] };
    assert.equal(corrected(jcs(envelope)).decision, frozen(source).decision, kind);
  }
  for (const field of ['authorizationBytes', 'priceBytes', 'priceProviderProofBytes']) {
    const input = fixture(), graph = JSON.parse(input.graphBytes), record = JSON.parse(graph[field]);
    record.signature.valueBase64 = Buffer.alloc(64).toString('base64'); graph[field] = jcs(record); input.graphBytes = jcs(graph);
    assert.equal(corrected(jcs(input)).firstError, 'BASE_COST_REJECTED', field);
  }
});

test('legacy, stale, noncanonical, wrong-kind and oversized requests cannot select a weaker path', () => {
  const input = fixture();
  for (const bytes of [null, {}, input.graphBytes, jcs(input) + ' ', jcs({ ...input, policyDigest: '0'.repeat(64) }),
    jcs({ ...input, extra: true }), 'x'.repeat(8388609), jcs({ ...input, graphBytes: makeCostGraph('invoice-at-close') })])
    assert.equal(corrected(bytes).decision, 'DENY');
  const graph = JSON.parse(input.graphBytes); graph.providerInvoiceRecordsBytes[0] = '{}';
  assert.equal(corrected(jcs({ ...input, graphBytes: jcs(graph) })).decision, 'DENY');
});
