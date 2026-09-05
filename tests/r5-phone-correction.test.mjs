import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { correctedPrivacyGraphDecision as corrected, correctionPolicyDigest } from '../intent/0056/privacy-correction.candidate.mjs';
import { makePrivacyGraph, mutatePrivacyGraph } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { privacyGraphDecision as frozen } from '../intent/0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { jcs, sha256, sealRecord, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { inspectPrivacyPhoneText } from '../packages/domain/src/privacy-phone.ts';

const envelope = (graphBytes) => jcs({ version: 'steer-r5-005-correction/v1', policyDigest: correctionPolicyDigest, graphBytes });
const resealSyntheticRecord = (bytes, patch) => jcs(sealRecord({ ...Object.fromEntries(Object.entries(JSON.parse(bytes)).filter(([key]) => !['recordDigest', 'signature'].includes(key))), ...patch }));
function withPhone(text, index = 0) {
  const graph = JSON.parse(makePrivacyGraph());
  const bytes = Buffer.concat([Buffer.from(graph.prompts[index].bytesBase64, 'base64'), Buffer.from(' '), Buffer.from(text)]);
  graph.prompts[index].bytesBase64 = bytes.toString('base64'); graph.prompts[index].sha256 = sha256(bytes);
  const digest = sha256(jcs(graph.prompts));
  graph.encryptedCorpus.promptInventoryDigest = digest;
  for (const derivative of graph.derivatives) derivative.corpusDigest = digest;
  graph.sanitizerRunBytes = resealSyntheticRecord(graph.sanitizerRunBytes, { promptInventoryDigest: digest });
  graph.inspectionBytes = resealSyntheticRecord(graph.inspectionBytes, { promptInventoryDigest: digest, runDigest: JSON.parse(graph.sanitizerRunBytes).recordDigest });
  return jcs(graph);
}

test('R5-005: exact Unicode counterexamples accepted by frozen graph are rejected by the policy-bound correction', () => {
  for (const text of ['+٤٤ ٢٠ ٧٩٤٦ ٠٩٥٨', '٠٠٤٤ ٢٠ ٧٩٤٦ ٠٩٥٨', '+४४ २० ७९४६ ०९५८', '००४४ २० ७९४६ ०९५८',
    encodeURIComponent('+٤٤ ٢٠ ٧٩٤٦ ٠٩٥٨'), Buffer.from('+٤٤ ٢٠ ٧٩٤٦ ٠٩٥٨').toString('base64')]) {
    const graph = withPhone(text); const before = graph;
    assert.equal(frozen(graph).decision, 'ACCEPT', 'Counterexample must reach the frozen accept path.');
    const result = corrected(envelope(graph));
    assert.equal(result.decision, 'REJECT'); assert.equal(result.firstError, 'UNICODE_PHONE_DETECTED');
    assert.deepEqual(result.effects, zeroEffects()); assert.equal(graph, before);
    assert.ok(!JSON.stringify(result).includes(text));
  }
});

test('all prompt positions and inspection uncertainty remain default closed', () => {
  for (const index of [0, 9, 19]) {
    const graph = withPhone('+٤٤ ٢٠ ٧٩٤٦ ٠٩٥٨', index);
    assert.equal(frozen(graph).decision, 'ACCEPT');
    assert.equal(corrected(envelope(graph)).firstError, 'UNICODE_PHONE_DETECTED');
  }
  for (const text of ['x'.repeat(65536), Buffer.from([0xff]), Buffer.alloc(16, 0xff).toString('base64')]) {
    const graph = withPhone(text);
    assert.equal(corrected(envelope(graph)).decision, 'REJECT');
  }
  for (const length of [6, 7, 15, 16]) {
    const graph = withPhone('+' + '٤'.repeat(length));
    assert.equal(frozen(graph).decision, 'ACCEPT');
    assert.equal(corrected(envelope(graph)).decision, length === 7 || length === 15 ? 'REJECT' : 'ACCEPT');
  }
});

test('all 19 declared frozen privacy graph cases retain their expected decisions through the correction', () => {
  const controls = JSON.parse(readFileSync(new URL('../intent/0001/reviews/domain/round-3/remediation/CONTROL-FIXTURES.candidate.json', import.meta.url)));
  assert.equal(controls.privacyGraphKinds.length, 19);
  const source = makePrivacyGraph();
  for (const kind of controls.privacyGraphKinds) {
    const graph = kind === 'positive' ? source : mutatePrivacyGraph(source, kind);
    const result = corrected(envelope(graph));
    assert.equal(result.decision, kind === 'positive' ? 'ACCEPT' : 'REJECT', kind);
    assert.deepEqual(result.effects, zeroEffects());
  }
});

test('all ten prior phone detector cases retain their declared boundaries', () => {
  const cases = JSON.parse(readFileSync(new URL('../intent/0001/reviews/domain/round-3/remediation/PRIVACY-DETECTOR-CASES.candidate.json', import.meta.url))).cases.filter((row) => row.class === 'phone');
  assert.equal(cases.length, 10);
  for (const row of cases) assert.equal(inspectPrivacyPhoneText(row.text) === 'phone', row.expectedHit, row.id);
});

test('corrected candidate retains valid evidence and all base denials; old or drifted envelopes never authorize', () => {
  const source = makePrivacyGraph(); const wrapped = envelope(source);
  assert.equal(frozen(source).decision, 'ACCEPT'); assert.equal(corrected(wrapped).decision, 'ACCEPT');
  assert.equal(corrected(wrapped).correctionPolicyDigest, correctionPolicyDigest);
  assert.deepEqual(corrected(wrapped).effects, zeroEffects());
  const badGraph = JSON.parse(source); badGraph.prompts[0].sha256 = '0'.repeat(64);
  assert.equal(corrected(envelope(jcs(badGraph))).firstError, 'BASE_PRIVACY_REJECTED');
  for (const value of [source, null, {}, 'x'.repeat(8388609), wrapped + ' ',
    wrapped.replace(correctionPolicyDigest, '0'.repeat(64)), jcs({ ...JSON.parse(wrapped), extra: true })])
    assert.equal(corrected(value).decision, 'REJECT');
});
