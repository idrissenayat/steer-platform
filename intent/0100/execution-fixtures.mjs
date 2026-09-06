// Closed synthetic fixture builders. No real keys, provider access or general signer export.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { makeAuthorizationBundle, mutateAuthorizationBundle, makeSpendGraph, mutateSpendGraph, makeCostGraph, makePrivacyGraph, mutatePrivacyGraph } from '../0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { jcs, sha256, TRUST_REGISTRY } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createAuthorizationTimeVerifier, policyDigest as authorizationPolicy } from '../0066/authorization-time.candidate.mjs';
import { createMoneyTimeVerifier, policyDigest as moneyPolicy } from '../0064/money-time.candidate.mjs';
import { createPrivacyCostTimeVerifier, policyDigest as timePolicy } from '../0063/privacy-cost-time.candidate.mjs';
import { correctionPolicyDigest as privacyPolicy } from '../0056/privacy-correction.candidate.mjs';
import { correctionPolicyDigest as costPolicy } from '../0057/cost-correction.candidate.mjs';
const kinds = JSON.parse(readFileSync(new URL('../0001/reviews/domain/round-3/remediation/NORMATIVE-EXECUTION-INVENTORY.candidate.json', import.meta.url))).dimensions;
const now = '2026-09-04T12:00:30Z', registryDigest = sha256(jcs(TRUST_REGISTRY)), keys = new Map();
const clock = (evaluatedAt) => jcs({ version: 'steer-audit-clock/v1', evaluatedAt });
function seal(input, domain) {
  if (!keys.has(domain)) keys.set(domain, createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'),
    createHash('sha256').update(`steer-r3-r1-${domain}`).digest()]), format: 'der', type: 'pkcs8' }));
  const payload = Object.fromEntries(Object.entries(input).filter(([key]) => !['recordDigest', 'signature'].includes(key))), digest = sha256(jcs(payload));
  return { ...payload, recordDigest: digest, signature: { algorithm: 'Ed25519', keyId: `${domain}-key-v1`, signedDigest: digest,
    valueBase64: sign(null, Buffer.from(digest), keys.get(domain)).toString('base64') } };
}
// Inventory is independently specified here, not requested from candidate code.
function row(path, bytes, domain, field, asOf) {
  const record = JSON.parse(bytes);
  return { path, domain, bytesDigest: sha256(bytes), recordDigest: record.recordDigest ?? null,
    timeBasis: field === null ? 'observed-as-of' : `signed:${field}`, recordedAt: field === null ? asOf : record[field] ?? null };
}
function authorizationEnvelope(bundle, incomplete = false) {
  const bundleBytes = jcs(bundle); let inventory, recordedAt;
  try {
    recordedAt = JSON.parse(bundle.requestBytes).requestedAt;
    inventory = [['requestBytes', 'record', 'requestedAt'], ['upstreamCredentialBytes', 'upstream', 'issuedAt'], ['downstreamCredentialBytes', 'downstream', 'issuedAt'],
      ['delegationBytes', 'delegation', 'issuedAt'], ['assignmentBytes', 'assignment', null], ['authorityBytes', 'authority', 'decidedAt'],
      ['providerResourcesBytes', 'provider', 'recordedAt'], ['replayLedgerBytes', 'replay-authority', 'snapshotAt'], ['casHeadBytes', 'cas-authority', 'snapshotAt'],
      ['reservationBytes', 'cas-authority', 'recordedAt']].map(([key, domain, field]) => row(`bundle/${key}`, bundle[key], domain, field, recordedAt));
  } catch (error) { if (!incomplete) throw error; inventory = []; recordedAt = now; }
  return jcs({ version: 'steer-authorization-time/v1', policyDigest: authorizationPolicy, bundleBytes,
    observationBytes: jcs(seal({ version: 'steer-authorization-observation/v1', bundleDigest: sha256(bundleBytes), policyDigest: authorizationPolicy,
      registryDigest, inventoryDigest: sha256(jcs(inventory)), recordCount: inventory.length, recordedAt }, 'verifier')) });
}
export function authorizationExecutionCase(kind) {
  assert.ok(kinds.authorizationKinds.includes(kind)); const positive = makeAuthorizationBundle(), changed = mutateAuthorizationBundle(positive, kind);
  return { positive, changed, positiveBytes: authorizationEnvelope(positive), bytes: authorizationEnvelope(changed, !['positive', 'retry'].includes(kind)),
    evaluatedAt: now, verifier: createAuthorizationTimeVerifier(clock(now)) };
}
function moneyInventory(graph) {
  const inventory = [], add = (path, bytes, domain, field = null) => inventory.push(row(path, bytes, domain, field, graph.decisionAt));
  const authorization = (path, bytes) => { add(path, bytes, 'money', 'sealedAt'); add(`${path}/providerProof`, jcs(JSON.parse(bytes).providerProof), 'provider', 'recordedAt'); };
  if (!graph.kind) {
    graph.authorizationChainBytes.forEach((bytes, index) => authorization(`graph/authorizationChainBytes/${index}`, bytes));
    for (const [key, domain, field] of [['consumerBytes', 'money', 'requestedAt'], ['replayLedgerBytes', 'replay-authority', 'snapshotAt'],
      ['casHeadBytes', 'cas-authority', 'snapshotAt'], ['casReservationBytes', 'cas-authority', 'recordedAt']]) add(`graph/${key}`, graph[key], domain, field);
  } else {
    authorization('graph/authorizationBytes', graph.authorizationBytes); add('graph/priceBytes', graph.priceBytes, 'money');
    add('graph/priceProviderProofBytes', graph.priceProviderProofBytes, 'provider-usage', 'recordedAt');
    for (const [key, domain, field] of [['recordsBytes', 'money', null], ['providerUsageRecordsBytes', 'provider-usage', 'recordedAt'], ['providerInvoiceRecordsBytes', 'provider-invoice', 'issuedAt']])
      graph[key].forEach((bytes, index) => add(`graph/${key}/${index}`, bytes, domain, field));
  }
  return inventory;
}
function moneyEnvelope(sourceBytes, kind, incomplete = false) {
  const graph = JSON.parse(sourceBytes); let inventory;
  try { inventory = moneyInventory(graph); } catch (error) { if (!incomplete) throw error; inventory = []; }
  const recordedAt = typeof graph === 'object' ? graph.decisionAt : now;
  return jcs({ version: 'steer-money-time/v1', policyDigest: moneyPolicy, kind, graphBytes: sourceBytes,
    observationBytes: jcs(seal({ version: 'steer-money-observation/v1', kind, graphDigest: sha256(sourceBytes), policyDigest: moneyPolicy,
      registryDigest, inventoryDigest: sha256(jcs(inventory)), recordCount: inventory.length, recordedAt }, 'verifier')) });
}
export function spendExecutionCase(kind) {
  assert.ok(kinds.spendKinds.includes(kind)); const positive = makeSpendGraph(), sourceBytes = kind === 'unknown-kind' ? '"unknown"' : mutateSpendGraph(positive, kind);
  const at = JSON.parse(sourceBytes).decisionAt, evaluatedAt = !at || at === 'not-a-time' ? now : at;
  return { sourceBytes, positiveBytes: moneyEnvelope(positive, 'spend'), positiveVerifier: createMoneyTimeVerifier(clock(now)),
    bytes: moneyEnvelope(sourceBytes, 'spend', !['positive', 'replay'].includes(kind)), verifier: createMoneyTimeVerifier(clock(evaluatedAt)), evaluatedAt };
}
function correctionEnvelope(kind, input, incomplete = false) {
  const graph = JSON.parse(input.graphBytes); let inventory = [];
  try {
    if (kind === 'privacy') {
      for (const [name, domain] of [['sourceAuthorityBytes', 'authority'], ['useAuthorizationBytes', 'authority'], ['sanitizerRunBytes', 'record'], ['inspectionBytes', 'record']])
        inventory.push(row(`graph/${name}`, graph[name], domain, null, graph.decisionAt));
      for (const [name, domain, field] of [['rawCopies', 'record', 'createdAt'], ['rawAuthorities', 'authority', null], ['rawReceipts', 'provider', 'recordedAt']])
        graph[name].forEach((value, index) => inventory.push(row(`graph/${name}/${index}/recordBytes`, value.recordBytes, domain, field, graph.decisionAt)));
    } else {
      inventory = moneyInventory(graph);
      for (const [name, field] of [['varianceRecordsBytes', 'recordedAt'], ['reconciliationRecordsBytes', 'reconciledAt']])
        input[name].forEach((bytes, index) => inventory.push(row(`correction/${name}/${index}`, bytes, 'money', field, graph.decisionAt)));
    }
  } catch (error) { if (!incomplete) throw error; inventory = []; }
  const correctionBytes = jcs(input);
  return jcs({ version: 'steer-privacy-cost-time/v1', policyDigest: timePolicy, kind, correctionBytes,
    observationBytes: jcs(seal({ version: 'steer-evidence-observation/v1', kind, correctionDigest: sha256(correctionBytes), policyDigest: timePolicy,
      registryDigest, inventoryDigest: sha256(jcs(inventory)), recordCount: inventory.length, recordedAt: graph.decisionAt }, 'verifier')) });
}
function reconciliation(sourceBytes) {
  const graph = JSON.parse(sourceBytes), varianceRecordsBytes = [graph.varianceBytes], reconciliationRecordsBytes = [graph.reconciliationBytes];
  graph.varianceBytes = ''; graph.reconciliationBytes = '';
  return { version: 'steer-r5-004-correction/v1', policyDigest: costPolicy, graphBytes: jcs(graph), varianceRecordsBytes, reconciliationRecordsBytes };
}
export function costExecutionCase(kind) {
  assert.ok(kinds.costKinds.includes(kind)); let sourceBytes = kind === 'unknown-kind' ? '"unknown"' : makeCostGraph(kind), graph = JSON.parse(sourceBytes);
  const plural = graph.kind === 'reconciliation', overflow = kind.startsWith('overflow-');
  if (overflow) {
    graph = JSON.parse(makeCostGraph('subcent-aggregate-before-round')); const rate = kind === 'overflow-add' ? '1' : '2';
    const price = seal({ ...JSON.parse(graph.priceBytes), nanoUsdPerUnit: rate }, 'money'); graph.priceBytes = jcs(price);
    graph.priceProviderProofBytes = jcs(seal({ ...JSON.parse(graph.priceProviderProofBytes), priceDigest: price.recordDigest }, 'provider-usage'));
    const record = JSON.parse(graph.recordsBytes[0]);
    graph.recordsBytes = (kind === 'overflow-add' ? ['9000000000000000000', '1'] : ['9000000000000000000']).map((units, index) =>
      jcs(seal({ ...record, recordId: `overflow-${index}`, units, nanoUsdPerUnit: rate, totalNanoUsd: (BigInt(units) * BigInt(rate)).toString() }, 'money')));
    sourceBytes = jcs(graph);
  }
  const positiveKind = plural ? 'reconcile-at-24h' : graph.kind === 'invoice' ? 'invoice-two-lines-reordered' : graph.kind === 'aggregate' ? 'subcent-aggregate-before-round' : 'forecast-allow';
  const positiveSourceBytes = makeCostGraph(positiveKind), positiveAt = JSON.parse(positiveSourceBytes).decisionAt, evaluatedAt = graph.decisionAt ?? now;
  const wrap = (bytes, incomplete = false) => plural ? correctionEnvelope('cost-reconciliation', reconciliation(bytes), incomplete) : moneyEnvelope(bytes, typeof JSON.parse(bytes) === 'object' ? `cost-${JSON.parse(bytes).kind}` : 'cost-forecast', incomplete);
  const factory = plural ? createPrivacyCostTimeVerifier : createMoneyTimeVerifier;
  return { sourceBytes, positiveSourceBytes, positiveKind, plural, evaluatedAt, positiveAt, positiveBytes: wrap(positiveSourceBytes), bytes: wrap(sourceBytes, true),
    positiveVerifier: factory(clock(positiveAt)), verifier: factory(clock(evaluatedAt)) };
}
export function privacyExecutionCase(kind) {
  assert.ok(kinds.privacyGraphKinds.includes(kind)); const positive = makePrivacyGraph(), sourceBytes = kind === 'positive' ? positive : mutatePrivacyGraph(positive, kind);
  const input = (graphBytes) => ({ version: 'steer-r5-005-correction/v1', policyDigest: privacyPolicy, graphBytes });
  return { sourceBytes, positiveBytes: correctionEnvelope('privacy', input(positive)), bytes: correctionEnvelope('privacy', input(sourceBytes), kind !== 'positive'),
    evaluatedAt: now, verifier: createPrivacyCostTimeVerifier(clock(now)) };
}
