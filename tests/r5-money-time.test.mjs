import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { createMoneyTimeVerifier, policyDigest } from '../intent/0064/money-time.candidate.mjs';
import { makeCostGraph, makeSpendGraph, mutateSpendGraph } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { costDecision, spendDecision } from '../intent/0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { jcs, sha256, TRUST_REGISTRY, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';

// Synthetic, module-private test signers; no real provider or spending evidence.
const payload = (value) => Object.fromEntries(Object.entries(value).filter(([key]) => !['recordDigest', 'signature'].includes(key)));
function seal(input, domain) {
  const key = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), createHash('sha256').update(`steer-r3-r1-${domain}`).digest()]), format: 'der', type: 'pkcs8' });
  const record = payload(input), digest = sha256(jcs(record));
  return { ...record, recordDigest: digest, signature: { algorithm: 'Ed25519', keyId: `${domain}-key-v1`, signedDigest: digest, valueBase64: sign(null, Buffer.from(digest), key).toString('base64') } };
}
const fixture = (kind) => JSON.parse(kind === 'spend' ? makeSpendGraph() : makeCostGraph({ 'cost-forecast': 'forecast-allow', 'cost-invoice': 'invoice-two-lines-reordered', 'cost-aggregate': 'subcent-aggregate-before-round' }[kind]));
const kindOf = (graph) => graph.kind ? `cost-${graph.kind}` : 'spend';
// Independent inventory construction; never asks candidate code for expected rows.
function slots(graph) {
  const result = [];
  const add = (path, parent, key, domain, field = null, object = false) => result.push({ path, domain, field,
    read: () => object ? jcs(parent[key]) : parent[key], write: (value) => { parent[key] = object ? JSON.parse(value) : value; } });
  const authorization = (path, parent, key) => {
    add(path, parent, key, 'money', 'sealedAt'); const record = JSON.parse(parent[key]);
    add(`${path}/providerProof`, record, 'providerProof', 'provider', 'recordedAt', true);
    const slot = result.at(-1), write = slot.write; slot.write = (value) => { write(value); parent[key] = jcs(record); };
  };
  if (!graph.kind) {
    graph.authorizationChainBytes.forEach((_, index) => authorization(`graph/authorizationChainBytes/${index}`, graph.authorizationChainBytes, index));
    for (const [key, domain, field] of [['consumerBytes', 'money', 'requestedAt'], ['replayLedgerBytes', 'replay-authority', 'snapshotAt'], ['casHeadBytes', 'cas-authority', 'snapshotAt'], ['casReservationBytes', 'cas-authority', 'recordedAt']]) add(`graph/${key}`, graph, key, domain, field);
  } else {
    authorization('graph/authorizationBytes', graph, 'authorizationBytes');
    add('graph/priceBytes', graph, 'priceBytes', 'money');
    add('graph/priceProviderProofBytes', graph, 'priceProviderProofBytes', 'provider-usage', 'recordedAt');
    for (const [key, domain, field] of [['recordsBytes', 'money', null], ['providerUsageRecordsBytes', 'provider-usage', 'recordedAt'], ['providerInvoiceRecordsBytes', 'provider-invoice', 'issuedAt']])
      graph[key].forEach((_, index) => add(`graph/${key}/${index}`, graph[key], index, domain, field));
  }
  return result;
}
function wrap(graph, alter = () => {}, signer = 'verifier', incomplete = false) {
  const graphBytes = jcs(graph), kind = kindOf(graph); let inventory;
  try { inventory = slots(graph).map((slot) => {
    const serialized = slot.read(), record = JSON.parse(serialized);
    return { path: slot.path, domain: slot.domain, bytesDigest: sha256(serialized), recordDigest: record.recordDigest ?? null,
      timeBasis: slot.field === null ? 'observed-as-of' : `signed:${slot.field}`, recordedAt: slot.field === null ? graph.decisionAt : record[slot.field] ?? null };
  }); } catch (error) {
    // Known malformed frozen negatives cannot form a complete inventory. Supply
    // an empty signed claim so the public candidate, not this helper, must deny.
    if (!incomplete) throw error; inventory = [];
  }
  const observation = { version: 'steer-money-observation/v1', kind, graphDigest: sha256(graphBytes), policyDigest,
    registryDigest: sha256(jcs(TRUST_REGISTRY)), inventoryDigest: sha256(jcs(inventory)), recordCount: inventory.length, recordedAt: graph.decisionAt };
  alter(observation, inventory);
  return { version: 'steer-money-time/v1', policyDigest, kind, graphBytes, observationBytes: jcs(seal(observation, signer)) };
}
const evaluate = (input, evaluatedAt = JSON.parse(input.graphBytes).decisionAt) => createMoneyTimeVerifier(jcs({ version: 'steer-audit-clock/v1', evaluatedAt })).verify(jcs(input));
const denied = (result) => assert.deepEqual(result, { decision: 'DENY', firstError: 'MONEY_TIME_INVALID', effects: zeroEffects(), executionAuthorized: false });
const kinds = ['spend', 'cost-forecast', 'cost-invoice', 'cost-aggregate'];

test('forecast, invoice, aggregate, first spend and replay audit preserve results but never authorize execution', () => {
  for (const [kind, count, observed] of [['spend', 8, 0], ['cost-forecast', 5, 2], ['cost-invoice', 10, 3], ['cost-aggregate', 7, 4]]) {
    const graph = fixture(kind), input = wrap(graph), original = jcs(input), result = evaluate(input);
    const base = kind === 'spend' ? spendDecision(jcs(graph)) : costDecision(jcs(graph));
    assert.equal(result.decision, 'VERIFIED'); assert.equal(result.recordedDecision, base.decision);
    assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects());
    assert.equal(result.timedRecordCount, count); assert.equal(result.observedAsOfCount, observed);
    if (kind !== 'spend') { assert.equal(result.aggregateNanoUsd, base.aggregateNanoUsd); assert.equal(result.roundedCents, base.roundedCents); }
    assert.equal(jcs(input), original);
  }
  const replay = JSON.parse(mutateSpendGraph(makeSpendGraph(), 'replay')), result = evaluate(wrap(replay));
  assert.equal(result.decision, 'VERIFIED'); assert.equal(result.recordedDecision, 'REPLAY_NOOP'); assert.equal(result.executionAuthorized, false);
});

test('every original signature and both nested authorization proofs remain mandatory', () => {
  for (const kind of kinds) for (let index = 0; index < slots(fixture(kind)).length; index++) {
    const graph = fixture(kind), slot = slots(graph)[index], record = JSON.parse(slot.read());
    record.signature.valueBase64 = Buffer.alloc(64).toString('base64'); slot.write(jcs(record));
    denied(evaluate(wrap(graph)));
  }
});

test('all signed time slots reject pre-key and future claims with freshly re-signed observations', () => {
  for (const kind of kinds) for (const value of ['2026-08-31T23:59:59Z', '2026-10-03T00:00:00Z', 'not-a-time']) {
    for (let index = 0; index < slots(fixture(kind)).length; index++) {
      const graph = fixture(kind), slot = slots(graph)[index]; if (slot.field === null) continue;
      slot.write(jcs(seal({ ...JSON.parse(slot.read()), [slot.field]: value }, slot.domain)));
      denied(evaluate(wrap(graph)));
    }
  }
  // Counterexamples must reach an old acceptance, not merely be malformed inputs.
  for (const field of ['replayLedgerBytes', 'casHeadBytes']) {
    const graph = fixture('spend'), record = JSON.parse(graph[field]); record.snapshotAt = '2026-08-31T23:59:59Z';
    graph[field] = jcs(seal(record, field === 'replayLedgerBytes' ? 'replay-authority' : 'cas-authority'));
    assert.equal(spendDecision(jcs(graph)).decision, 'ALLOW'); denied(evaluate(wrap(graph)));
  }
  for (const kind of kinds.filter((value) => value !== 'spend')) {
    const graph = fixture(kind), record = JSON.parse(graph.priceProviderProofBytes); record.recordedAt = '2026-08-31T23:59:59Z';
    graph.priceProviderProofBytes = jcs(seal(record, 'provider-usage'));
    assert.equal(costDecision(jcs(graph)).decision, 'ALLOW'); denied(evaluate(wrap(graph)));
  }
});

test('evaluation uses current authority for spend/forecast but permits historical invoice and aggregate audits', () => {
  const spend = wrap(fixture('spend'));
  assert.equal(evaluate(spend, '2026-09-04T12:00:59Z').decision, 'VERIFIED'); denied(evaluate(spend, '2026-09-04T12:01:00Z'));
  denied(evaluate(spend, '2026-09-04T12:00:29Z'));
  const forecast = wrap(fixture('cost-forecast'));
  assert.equal(evaluate(forecast, '2026-09-30T23:59:59Z').decision, 'VERIFIED'); denied(evaluate(forecast, '2026-10-01T00:00:00Z'));
  for (const kind of ['cost-invoice', 'cost-aggregate']) {
    assert.equal(evaluate(wrap(fixture(kind)), '2027-08-31T23:59:59Z').decision, 'VERIFIED');
    denied(evaluate(wrap(fixture(kind)), '2027-09-01T00:00:00Z'));
  }
  // Snapshot age has its own bound even if a store asserts a long validity.
  const graph = fixture('spend');
  for (const [key, domain, field] of [['replayLedgerBytes', 'replay-authority', 'snapshotAt'], ['casHeadBytes', 'cas-authority', 'snapshotAt'], ['casReservationBytes', 'cas-authority', 'recordedAt']]) {
    const record = JSON.parse(graph[key]); record[field] = '2026-09-04T12:00:30Z'; record.validThrough = '2026-09-04T12:10:00Z'; graph[key] = jcs(seal(record, domain));
  }
  assert.equal(evaluate(wrap(graph), '2026-09-04T12:05:30Z').decision, 'VERIFIED'); denied(evaluate(wrap(graph), '2026-09-04T12:05:31Z'));
});

test('replay cannot bypass reservation timing, currentness or independent inventory binding', () => {
  for (const patch of [{ recordedAt: '2026-10-01T00:00:00Z' }, { recordedAt: 'not-a-time' }, { validThrough: '2026-09-04T12:00:30Z' }]) {
    const graph = JSON.parse(mutateSpendGraph(makeSpendGraph(), 'replay'));
    graph.casReservationBytes = jcs(seal({ ...JSON.parse(graph.casReservationBytes), ...patch }, 'cas-authority'));
    assert.equal(spendDecision(jcs(graph)).decision, 'REPLAY_NOOP'); denied(evaluate(wrap(graph)));
  }
  for (const kind of kinds) {
    for (const change of [(x) => { x.graphDigest = 'e'.repeat(64); }, (x) => { x.policyDigest = 'e'.repeat(64); },
      (x) => { x.registryDigest = 'e'.repeat(64); }, (x) => { x.recordedAt = '2026-09-04T11:00:30Z'; },
      (x) => { x.recordCount--; }, (x) => { x.kind = 'other'; }, (x) => { x.unknown = true; },
      (x, inventory) => { inventory.pop(); x.inventoryDigest = sha256(jcs(inventory)); x.recordCount--; },
      (x, inventory) => { inventory.reverse(); x.inventoryDigest = sha256(jcs(inventory)); }]) denied(evaluate(wrap(fixture(kind), change)));
    for (const signer of ['money', 'provider', 'cas-authority', 'record']) denied(evaluate(wrap(fixture(kind), () => {}, signer)));
  }
});

test('all frozen spend and non-reconciliation cost cases retain their declared business boundaries', () => {
  const controls = JSON.parse(readFileSync(new URL('../intent/0001/reviews/domain/round-3/remediation/CONTROL-FIXTURES.candidate.json', import.meta.url)));
  const unknown = (kind) => {
    const input = wrap(fixture(kind)); input.graphBytes = '"unknown"';
    input.observationBytes = jcs(seal({ ...JSON.parse(input.observationBytes), graphDigest: sha256(input.graphBytes), inventoryDigest: sha256('[]'), recordCount: 0 }, 'verifier'));
    denied(evaluate(input, '2026-09-04T12:00:30Z'));
  };
  let spendCases = 0, costCases = 0;
  for (const kind of controls.spendKinds) {
    spendCases++;
    if (kind === 'unknown-kind') { assert.equal(spendDecision('"unknown"').decision, 'DENY'); unknown('spend'); continue; }
    const graphBytes = kind === 'positive' ? makeSpendGraph() : mutateSpendGraph(makeSpendGraph(), kind), graph = JSON.parse(graphBytes), base = spendDecision(graphBytes);
    const result = evaluate(wrap(graph, () => {}, 'verifier', base.decision === 'DENY'), graph.decisionAt === 'not-a-time' ? '2026-09-04T12:00:30Z' : graph.decisionAt);
    assert.equal(base.decision, kind === 'positive' ? 'ALLOW' : kind === 'replay' ? 'REPLAY_NOOP' : 'DENY', kind);
    assert.equal(result.decision, ['positive', 'replay'].includes(kind) ? 'VERIFIED' : 'DENY', kind);
  }
  for (const kind of controls.costKinds) {
    if (kind === 'unknown-kind') { costCases++; assert.equal(costDecision('"unknown"').decision, 'DENY'); unknown('cost-forecast'); continue; }
    const graph = JSON.parse(makeCostGraph(kind)); if (graph.kind === 'reconciliation') continue;
    costCases++;
    if (kind.startsWith('overflow-')) {
      // The frozen inventory tests arithmetic primitives. Exercise the same
      // boundaries through actual signed aggregate graphs as well.
      Object.assign(graph, fixture('cost-aggregate'));
      const rate = kind === 'overflow-add' ? '1' : '2', price = seal({ ...JSON.parse(graph.priceBytes), nanoUsdPerUnit: rate }, 'money');
      graph.priceBytes = jcs(price); graph.priceProviderProofBytes = jcs(seal({ ...JSON.parse(graph.priceProviderProofBytes), priceDigest: price.recordDigest }, 'provider-usage'));
      const record = JSON.parse(graph.recordsBytes[0]);
      graph.recordsBytes = (kind === 'overflow-add' ? ['9000000000000000000', '1'] : ['9000000000000000000']).map((units, index) =>
        jcs(seal({ ...record, recordId: `overflow-${index}`, units, nanoUsdPerUnit: rate, totalNanoUsd: (BigInt(units) * BigInt(rate)).toString() }, 'money')));
    }
    const base = costDecision(jcs(graph)), result = evaluate(wrap(graph));
    const accepted = ['forecast-allow', 'invoice-at-close', 'invoice-after-close', 'invoice-two-lines-reordered', 'subcent-aggregate-before-round'].includes(kind);
    assert.equal(base.decision, accepted ? 'ALLOW' : 'DENY', kind);
    if (kind.startsWith('overflow-')) assert.equal(base.firstError, 'NANOUSD_OVERFLOW', kind);
    assert.equal(result.decision, accepted ? 'VERIFIED' : 'DENY', kind);
  }
  assert.equal(spendCases, 20); assert.equal(costCases, 28);
});

test('independent invoice orderings and full 64-record aggregate bound preserve precision', () => {
  for (let mask = 0; mask < 8; mask++) {
    const graph = fixture('cost-invoice'); ['recordsBytes', 'providerUsageRecordsBytes', 'providerInvoiceRecordsBytes'].forEach((key, bit) => { if (mask & (1 << bit)) graph[key].reverse(); });
    const result = evaluate(wrap(graph)); assert.equal(result.decision, 'VERIFIED'); assert.equal(result.aggregateNanoUsd, '9800000'); assert.equal(result.roundedCents, '1');
  }
  const graph = fixture('cost-aggregate'), record = JSON.parse(graph.recordsBytes[0]);
  graph.recordsBytes = Array.from({ length: 64 }, (_, index) => jcs(seal({ ...record, recordId: `line-${index}` }, 'money')));
  const result = evaluate(wrap(graph)); assert.equal(result.decision, 'VERIFIED'); assert.equal(result.timedRecordCount, 68); assert.equal(result.aggregateNanoUsd, '313600000');
  graph.recordsBytes.push(jcs(seal({ ...record, recordId: 'line-65' }, 'money'))); denied(evaluate(wrap(graph)));
});

test('clock, limits, canonical forms and kind selection are default closed with content-free failures', () => {
  for (const value of [null, '{}', jcs({ version: 'steer-audit-clock/v1' }), jcs({ version: 'steer-audit-clock/v1', evaluatedAt: 'bad' }),
    jcs({ version: 'steer-audit-clock/v1', evaluatedAt: '2026-09-04T12:00:30Z', registryBytes: '{}' })]) assert.throws(() => createMoneyTimeVerifier(value), /MONEY_TIME_CONTEXT_INVALID/);
  const input = wrap(fixture('spend')), verifier = createMoneyTimeVerifier(jcs({ version: 'steer-audit-clock/v1', evaluatedAt: '2026-09-04T12:00:30Z' }));
  for (const value of [null, {}, input.graphBytes, jcs(input) + ' ', 'x'.repeat(8388609), jcs({ ...input, evaluatedAt: '2026-09-04T12:00:30Z' }),
    jcs({ ...input, policyDigest: 'f'.repeat(64) }), jcs({ ...input, kind: 'cost-forecast' })]) denied(verifier.verify(value));
  const graph = JSON.parse(makeCostGraph('reconcile-at-24h')); denied(evaluate(wrap(graph)));
});

test('64 authorization links and 64 forecast/invoice lines are fully traversed without changing monetary ceilings', () => {
  const spend = fixture('spend');
  for (let index = 2; index < 64; index++) {
    const previous = JSON.parse(spend.authorizationChainBytes.at(-1)), value = payload(previous);
    delete value.providerProof; value.authorizationId = `spend-${index + 1}`;
    value.predecessorId = previous.authorizationId; value.predecessorDigest = previous.recordDigest;
    for (const scope of Object.keys(value.delta)) for (const costClass of Object.keys(value.delta[scope])) value.delta[scope][costClass] = '0';
    const proof = seal({ ...previous.providerProof, providerRecordId: `provider-${value.authorizationId}`, authorizationId: value.authorizationId,
      authorizationPayloadDigest: sha256(jcs(value)) }, 'provider');
    spend.authorizationChainBytes.push(jcs(seal({ ...value, providerProof: proof }, 'money')));
  }
  const current = JSON.parse(spend.authorizationChainBytes.at(-1)), consumerPayload = payload(JSON.parse(spend.consumerBytes));
  consumerPayload.authorizationId = current.authorizationId; consumerPayload.authorizationDigest = current.recordDigest; delete consumerPayload.requestDigest;
  const consumer = seal({ ...consumerPayload, requestDigest: sha256(jcs(consumerPayload)) }, 'money'); spend.consumerBytes = jcs(consumer);
  spend.casHeadBytes = jcs(seal({ ...JSON.parse(spend.casHeadBytes), tupleDigest: current.recordDigest, requestDigest: consumer.requestDigest }, 'cas-authority'));
  spend.casReservationBytes = jcs(seal({ ...JSON.parse(spend.casReservationBytes), authorizationDigest: current.recordDigest, consumerDigest: consumer.recordDigest,
    requestDigest: consumer.requestDigest }, 'cas-authority'));
  const result = evaluate(wrap(spend)); assert.equal(result.decision, 'VERIFIED'); assert.equal(result.timedRecordCount, 132);
  spend.authorizationChainBytes.push(spend.authorizationChainBytes.at(-1)); denied(evaluate(wrap(spend)));

  for (const kind of ['cost-forecast', 'cost-invoice']) {
    const graph = fixture(kind), original = JSON.parse(graph.recordsBytes[0]), scenario = graph.forecastScenarios[0];
    const initialUsage = graph.providerUsageRecordsBytes[0] && JSON.parse(graph.providerUsageRecordsBytes[0]);
    const initialInvoice = graph.providerInvoiceRecordsBytes[0] && JSON.parse(graph.providerInvoiceRecordsBytes[0]);
    graph.recordsBytes = []; graph.providerUsageRecordsBytes = []; graph.providerInvoiceRecordsBytes = []; graph.forecastScenarios = [];
    for (let index = 0; index < 64; index++) {
      const record = { ...original, recordId: `record-${index}` };
      if (kind === 'cost-forecast') graph.forecastScenarios.push({ ...scenario, recordId: record.recordId });
      else {
        const usage = seal({ ...initialUsage, usageId: `usage-${index}` }, 'provider-usage');
        const invoiceId = `invoice-${index}`, invoiceBytes = jcs({ invoiceId, usageId: usage.usageId, units: usage.units, totalNanoUsd: initialInvoice.totalNanoUsd, currency: 'USD' });
        const invoice = seal({ ...initialInvoice, invoiceId, usageId: usage.usageId, usageDigest: usage.recordDigest,
          invoiceBytesBase64: Buffer.from(invoiceBytes).toString('base64'), invoiceDigest: sha256(invoiceBytes) }, 'provider-invoice');
        graph.providerUsageRecordsBytes.push(jcs(usage)); graph.providerInvoiceRecordsBytes.push(jcs(invoice));
        Object.assign(record, { providerUsageDigest: usage.recordDigest, providerInvoiceDigest: invoice.recordDigest, providerInvoiceBytesDigest: invoice.invoiceDigest });
      }
      graph.recordsBytes.push(jcs(seal(record, 'money')));
    }
    const result = evaluate(wrap(graph)); assert.equal(result.decision, 'VERIFIED'); assert.equal(result.timedRecordCount, kind === 'cost-forecast' ? 68 : 196);
    assert.equal(result.aggregateNanoUsd, '313600000'); assert.equal(result.roundedCents, '31'); assert.equal(result.executionAuthorized, false);
  }
});
