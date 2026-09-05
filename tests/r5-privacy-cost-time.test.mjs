import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { createPrivacyCostTimeVerifier, policyDigest } from '../intent/0063/privacy-cost-time.candidate.mjs';
import { correctedPrivacyGraphDecision, correctionPolicyDigest as privacyPolicy } from '../intent/0056/privacy-correction.candidate.mjs';
import { correctedCostDecision, correctionPolicyDigest as costPolicy } from '../intent/0057/cost-correction.candidate.mjs';
import { makePrivacyGraph, makeCostGraph } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { jcs, sha256, TRUST_REGISTRY, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';

// Synthetic module-private fixture keys only, never provider credentials.
function seal(input, domain) {
  const key = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), createHash('sha256').update(`steer-r3-r1-${domain}`).digest()]), format: 'der', type: 'pkcs8' });
  const payload = Object.fromEntries(Object.entries(input).filter(([key]) => !['recordDigest', 'signature'].includes(key))), digest = sha256(jcs(payload));
  return { ...payload, recordDigest: digest, signature: { algorithm: 'Ed25519', keyId: `${domain}-key-v1`, signedDigest: digest, valueBase64: sign(null, Buffer.from(digest), key).toString('base64') } };
}
function correction(kind, lineCount = 2) {
  if (kind === 'privacy') return { version: 'steer-r5-005-correction/v1', policyDigest: privacyPolicy, graphBytes: makePrivacyGraph() };
  const graph = JSON.parse(makeCostGraph('invoice-two-lines-reordered'));
  graph.kind = 'reconciliation'; graph.decisionAt = '2026-10-02T00:00:00Z';
  const original = JSON.parse(graph.recordsBytes[0]), usageOriginal = JSON.parse(graph.providerUsageRecordsBytes[0]), invoiceOriginal = JSON.parse(graph.providerInvoiceRecordsBytes[0]);
  graph.recordsBytes = []; graph.providerUsageRecordsBytes = []; graph.providerInvoiceRecordsBytes = [];
  const variances = [], reconciliations = [];
  for (let index = 0; index < lineCount; index++) {
    const usage = seal({ ...usageOriginal, usageId: `usage-${index}` }, 'provider-usage');
    const invoiceBytes = jcs({ invoiceId: `invoice-${index}`, usageId: usage.usageId, units: usage.units, totalNanoUsd: invoiceOriginal.totalNanoUsd, currency: 'USD' });
    const invoice = seal({ ...invoiceOriginal, invoiceId: `invoice-${index}`, usageId: usage.usageId, usageDigest: usage.recordDigest,
      invoiceBytesBase64: Buffer.from(invoiceBytes).toString('base64'), invoiceDigest: sha256(invoiceBytes) }, 'provider-invoice');
    const ledger = seal({ ...original, kind: 'reconciliation', recordId: `ledger-${index}`, providerUsageDigest: usage.recordDigest,
      providerInvoiceDigest: invoice.recordDigest, providerInvoiceBytesDigest: invoice.invoiceDigest }, 'money');
    const variance = seal({ varianceId: `variance-${index}`, invoiceDigest: invoice.recordDigest, usageDigest: usage.recordDigest, ledgerDigest: ledger.recordDigest,
      providerTotalNanoUsd: invoice.totalNanoUsd, ledgerTotalNanoUsd: ledger.totalNanoUsd, varianceNanoUsd: '0', status: 'within-threshold', recordedAt: '2026-10-01T00:00:01Z' }, 'money');
    const successor = seal({ reconciliationId: `successor-${index}`, predecessorInvoiceDigest: invoice.recordDigest, predecessorUsageDigest: usage.recordDigest,
      predecessorLedgerDigest: ledger.recordDigest, varianceDigest: variance.recordDigest, successorStatus: 'reconciled', reconciledAt: graph.decisionAt }, 'money');
    graph.recordsBytes.push(jcs(ledger)); graph.providerUsageRecordsBytes.push(jcs(usage)); graph.providerInvoiceRecordsBytes.push(jcs(invoice));
    variances.push(jcs(variance)); reconciliations.push(jcs(successor));
  }
  return { version: 'steer-r5-004-correction/v1', policyDigest: costPolicy, graphBytes: jcs(graph), varianceRecordsBytes: variances, reconciliationRecordsBytes: reconciliations };
}

// Separate test-side inventory builder. It does not call candidate code to
// construct expected inventory or sign an automatically accepted observation.
function slots(kind, input) {
  const graph = JSON.parse(input.graphBytes), result = [];
  const add = (path, parent, key, domain, field = null, object = false) => result.push({ path, domain, field,
    read: () => object ? jcs(parent[key]) : parent[key], write: (value) => { parent[key] = object ? JSON.parse(value) : value; } });
  const rows = (name, parent, domain, field = null, nested = false, prefix = 'graph') => parent[name].forEach((row, index) =>
    add(`${prefix}/${name}/${index}${nested ? '/recordBytes' : ''}`, nested ? row : parent[name], nested ? 'recordBytes' : index, domain, field));
  if (kind === 'privacy') {
    for (const name of ['sourceAuthorityBytes', 'useAuthorizationBytes']) add(`graph/${name}`, graph, name, 'authority');
    for (const name of ['sanitizerRunBytes', 'inspectionBytes']) add(`graph/${name}`, graph, name, 'record');
    rows('rawCopies', graph, 'record', 'createdAt', true); rows('rawAuthorities', graph, 'authority', null, true); rows('rawReceipts', graph, 'provider', 'recordedAt', true);
  } else {
    add('graph/authorizationBytes', graph, 'authorizationBytes', 'money', 'sealedAt');
    const authorization = JSON.parse(graph.authorizationBytes);
    add('graph/authorizationBytes/providerProof', authorization, 'providerProof', 'provider', 'recordedAt', true);
    // Propagate nested-proof changes while preserving the containing signature
    // unless a test intentionally reseals it.
    const nested = result.at(-1), write = nested.write;
    nested.write = (value) => { write(value); graph.authorizationBytes = jcs(authorization); };
    add('graph/priceBytes', graph, 'priceBytes', 'money');
    add('graph/priceProviderProofBytes', graph, 'priceProviderProofBytes', 'provider-usage', 'recordedAt');
    rows('recordsBytes', graph, 'money'); rows('providerUsageRecordsBytes', graph, 'provider-usage', 'recordedAt');
    rows('providerInvoiceRecordsBytes', graph, 'provider-invoice', 'issuedAt');
    rows('varianceRecordsBytes', input, 'money', 'recordedAt', false, 'correction');
    rows('reconciliationRecordsBytes', input, 'money', 'reconciledAt', false, 'correction');
  }
  return { graph, result, save: () => { input.graphBytes = jcs(graph); } };
}
function wrap(kind, input = correction(kind), alter = () => {}, signer = 'verifier') {
  const { graph, result } = slots(kind, input);
  const inventory = result.map((slot) => { const serialized = slot.read(), record = JSON.parse(serialized);
    return { path: slot.path, domain: slot.domain, bytesDigest: sha256(serialized), recordDigest: record.recordDigest,
      timeBasis: slot.field === null ? 'observed-as-of' : `signed:${slot.field}`, recordedAt: slot.field === null ? graph.decisionAt : record[slot.field] }; });
  const correctionBytes = jcs(input), observation = { version: 'steer-evidence-observation/v1', kind, correctionDigest: sha256(correctionBytes), policyDigest,
    registryDigest: sha256(jcs(TRUST_REGISTRY)), inventoryDigest: sha256(jcs(inventory)), recordCount: inventory.length, recordedAt: graph.decisionAt };
  alter(observation, inventory);
  return { version: 'steer-privacy-cost-time/v1', policyDigest, kind, correctionBytes, observationBytes: jcs(seal(observation, signer)) };
}
const evaluate = (envelope, evaluatedAt = JSON.parse(JSON.parse(envelope.correctionBytes).graphBytes).decisionAt) =>
  createPrivacyCostTimeVerifier(jcs({ version: 'steer-audit-clock/v1', evaluatedAt })).verify(jcs(envelope));
function denied(result) {
  assert.deepEqual(result, { decision: 'DENY', firstError: 'TIME_EVIDENCE_INVALID', effects: zeroEffects() });
}

test('explicit-time privacy and plural cost accept all records without rewriting bytes or execution', () => {
  for (const [kind, count, asOf] of [['privacy', 10, 6], ['cost-reconciliation', 14, 3]]) {
    const envelope = wrap(kind), original = jcs(envelope), result = evaluate(envelope);
    assert.equal(result.decision, kind === 'privacy' ? 'ACCEPT' : 'ALLOW');
    assert.equal(result.timedRecordCount, count); assert.equal(result.observedAsOfCount, asOf);
    assert.equal(result.timePolicyDigest, policyDigest); assert.deepEqual(result.effects, zeroEffects());
    if (kind !== 'privacy') { assert.equal(result.aggregateNanoUsd, '9800000'); assert.equal(result.roundedCents, '1'); }
    assert.equal(jcs(envelope), original);
  }
});

test('every record and nested proof is timed and signature checked, not just the first cost line', () => {
  for (const kind of ['privacy', 'cost-reconciliation']) {
    const count = slots(kind, correction(kind)).result.length;
    for (let index = 0; index < count; index++) {
      const input = correction(kind), selected = slots(kind, input), slot = selected.result[index];
      const record = JSON.parse(slot.read()); record.signature.valueBase64 = Buffer.alloc(64).toString('base64'); slot.write(jcs(record)); selected.save();
      denied(evaluate(wrap(kind, input)));
    }
  }
});

test('native times before key validity and after graph decision deny, even with fresh independent observation', () => {
  for (const kind of ['privacy', 'cost-reconciliation']) {
    for (const invalidTime of ['2026-08-31T23:59:59Z', '2026-10-03T00:00:00Z']) {
      const size = slots(kind, correction(kind)).result.length;
      for (let index = 0; index < size; index++) {
        const input = correction(kind), selected = slots(kind, input), slot = selected.result[index];
        if (slot.field === null) continue;
        slot.write(jcs(seal({ ...JSON.parse(slot.read()), [slot.field]: invalidTime }, slot.domain))); selected.save();
        denied(evaluate(wrap(kind, input)));
      }
    }
  }
  // An exact counterexample to the old fixed-time path: provider price proof is
  // signed before its key is valid; 0057 accepts it, the composed path rejects.
  const input = correction('cost-reconciliation'), graph = JSON.parse(input.graphBytes);
  graph.priceProviderProofBytes = jcs(seal({ ...JSON.parse(graph.priceProviderProofBytes), recordedAt: '2026-08-31T23:59:59Z' }, 'provider-usage'));
  input.graphBytes = jcs(graph);
  assert.equal(correctedCostDecision(jcs(input)).decision, 'ALLOW'); denied(evaluate(wrap('cost-reconciliation', input)));
});

test('evaluation clock has no default, cannot be request-overridden, and rejects expiration boundaries', () => {
  for (const value of [undefined, null, '{}', jcs({ version: 'steer-audit-clock/v1' }), jcs({ version: 'steer-audit-clock/v1', evaluatedAt: 'bad' }),
    jcs({ version: 'steer-audit-clock/v1', evaluatedAt: '2026-09-04T12:00:30Z', registryBytes: '{}' })])
    assert.throws(() => createPrivacyCostTimeVerifier(value), /TIME_CONTEXT_INVALID/);
  const privacy = wrap('privacy'), cost = wrap('cost-reconciliation');
  assert.equal(evaluate(privacy, '2026-09-04T23:59:59Z').decision, 'ACCEPT');
  denied(evaluate(privacy, '2026-09-05T00:00:00Z'));
  denied(evaluate(cost, '2026-10-01T23:59:59Z'));
  assert.equal(evaluate(cost, '2027-08-31T23:59:59Z').decision, 'ALLOW');
  denied(evaluate(cost, '2027-09-01T00:00:00Z'));
  denied(evaluate({ ...cost, evaluatedAt: '2026-10-02T00:00:00Z' }));
});

test('observation must be independent and bind exact complete bytes, inventory, clock, policy and registry', () => {
  for (const kind of ['privacy', 'cost-reconciliation']) {
    for (const mutate of [
      (x) => { x.correctionDigest = 'f'.repeat(64); }, (x) => { x.policyDigest = 'f'.repeat(64); },
      (x) => { x.registryDigest = 'f'.repeat(64); }, (x) => { x.recordedAt = '2026-09-04T12:00:29Z'; },
      (x) => { x.kind = 'unregistered'; }, (x) => { x.extra = true; }, (x) => { x.recordCount--; },
      (x, rows) => { rows.pop(); x.inventoryDigest = sha256(jcs(rows)); x.recordCount = rows.length; },
      (x, rows) => { rows.reverse(); x.inventoryDigest = sha256(jcs(rows)); },
      (x, rows) => { rows[0].timeBasis = 'issuedAt'; x.inventoryDigest = sha256(jcs(rows)); },
    ]) denied(evaluate(wrap(kind, correction(kind), mutate)));
    for (const domain of ['record', 'money', 'provider']) denied(evaluate(wrap(kind, correction(kind), () => {}, domain)));
    const envelope = wrap(kind), proof = JSON.parse(envelope.observationBytes);
    proof.signature.valueBase64 = Buffer.alloc(64).toString('base64'); envelope.observationBytes = jcs(proof); denied(evaluate(envelope));
  }
});

test('all 32 cost array permutations retain lineage and 64-line boundary remains supported', () => {
  for (let mask = 0; mask < 32; mask++) {
    const input = correction('cost-reconciliation'), graph = JSON.parse(input.graphBytes);
    ['recordsBytes', 'providerUsageRecordsBytes', 'providerInvoiceRecordsBytes'].forEach((key, bit) => { if (mask & (1 << bit)) graph[key].reverse(); });
    if (mask & 8) input.varianceRecordsBytes.reverse(); if (mask & 16) input.reconciliationRecordsBytes.reverse(); input.graphBytes = jcs(graph);
    assert.equal(evaluate(wrap('cost-reconciliation', input)).aggregateNanoUsd, '9800000');
  }
  const max = evaluate(wrap('cost-reconciliation', correction('cost-reconciliation', 64)));
  assert.equal(max.decision, 'ALLOW'); assert.equal(max.timedRecordCount, 324); assert.equal(max.reconciledLineCount, 64);
  denied(evaluate(wrap('cost-reconciliation', correction('cost-reconciliation', 65))));
});

test('valid observations never bypass original privacy, cost, canonical or envelope checks', () => {
  const privacy = correction('privacy'), graph = JSON.parse(privacy.graphBytes);
  graph.prompts[0].sha256 = 'f'.repeat(64); privacy.graphBytes = jcs(graph);
  assert.equal(correctedPrivacyGraphDecision(jcs(privacy)).decision, 'REJECT'); denied(evaluate(wrap('privacy', privacy)));
  const cost = correction('cost-reconciliation'); cost.varianceRecordsBytes.pop(); denied(evaluate(wrap('cost-reconciliation', cost)));
  const valid = wrap('privacy'), verifier = createPrivacyCostTimeVerifier(jcs({ version: 'steer-audit-clock/v1', evaluatedAt: '2026-09-04T12:00:30Z' }));
  for (const value of [null, {}, '', valid.correctionBytes, jcs(valid) + ' ', 'x'.repeat(12582913), jcs({ ...valid, policyDigest: 'f'.repeat(64) }), jcs({ ...valid, kind: 'forecast' })])
    denied(verifier.verify(value));
});

test('composed privacy rejects old future-receipt and Unicode counterexamples after valid observation', () => {
  const future = correction('privacy'), oldGraph = JSON.parse(future.graphBytes);
  oldGraph.rawReceipts[0].recordBytes = jcs(seal({ ...JSON.parse(oldGraph.rawReceipts[0].recordBytes), recordedAt: '2026-09-04T12:00:31Z' }, 'provider'));
  future.graphBytes = jcs(oldGraph);
  assert.equal(correctedPrivacyGraphDecision(jcs(future)).decision, 'ACCEPT'); denied(evaluate(wrap('privacy', future)));
  for (const text of ['+٤٤ ٢٠ ٧٩٤٦ ٠٩٥٨', encodeURIComponent('+४४ २० ७९४६ ०९५८'), Buffer.from('+٤٤ ٢٠ ٧٩٤٦ ٠٩٥٨').toString('base64')]) {
    const input = correction('privacy'), graph = JSON.parse(input.graphBytes), prompt = graph.prompts[19];
    const content = Buffer.concat([Buffer.from(prompt.bytesBase64, 'base64'), Buffer.from(` ${text}`)]);
    prompt.bytesBase64 = content.toString('base64'); prompt.sha256 = sha256(content);
    const digest = sha256(jcs(graph.prompts)); graph.encryptedCorpus.promptInventoryDigest = digest;
    for (const derivative of graph.derivatives) derivative.corpusDigest = digest;
    const run = seal({ ...JSON.parse(graph.sanitizerRunBytes), promptInventoryDigest: digest }, 'record');
    graph.sanitizerRunBytes = jcs(run);
    graph.inspectionBytes = jcs(seal({ ...JSON.parse(graph.inspectionBytes), promptInventoryDigest: digest, runDigest: run.recordDigest }, 'record'));
    input.graphBytes = jcs(graph);
    assert.equal(correctedPrivacyGraphDecision(jcs(input)).firstError, 'UNICODE_PHONE_DETECTED');
    denied(evaluate(wrap('privacy', input)));
  }
});
