import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRecordedHistoryVerifier } from '../src/recorded-history-verifier.ts';
import { developmentOriginalHash as hash } from '../../../packages/data/src/development-original-contracts.ts';
import { developmentResultCodec } from '../../../packages/data/src/development-results.ts';

type Verifier = ReturnType<typeof createRecordedHistoryVerifier>;
type Input = Parameters<Verifier['verify']>[0];
/** Mutate a copy AFTER synthetic authorized decoding to isolate SDK/lineage
 * failures. These copies have no live owner, keys or current authority. The native
 * positive path separately exercises the full production owned composition. */
export async function testRecordedHistoryCases(input: Input, profiles: Parameters<typeof createRecordedHistoryVerifier>[0]) {
  const verifier = createRecordedHistoryVerifier(profiles);
  const copy = () => ({ ...structuredClone({ snapshot: input.snapshot, contents: input.contents }), check() {} });
  let passed = 0;
  const deny = async (label: string, change: (value: any) => void) => {
    const value = copy(); change(value);
    await assert.rejects(verifier.verify(value), { message: 'Recorded history could not be verified.' }, label); passed++;
  };
  const scopeResponse = (v: any) => v.contents.decoded.scope_observations.find((o: any) => o.value.stage === 'response');
  const scopeRequest = (v: any) => v.contents.decoded.scope_observations.find((o: any) => o.value.stage === 'request');
  const devStep = (v: any, role = 'architect') => v.snapshot.data.steps.find((row: any) => row.step_id === role);
  const devResult = (v: any, role = 'architect') => v.contents.decoded.development_results.find((row: any) => row.metadata.stepId === role);
  const devRequest = (v: any, role = 'architect') => v.contents.decoded.development_observations.find((row: any) => row.metadata.stepId === role && row.value.stage === 'request');
  const devResponse = (v: any, role = 'architect') => v.contents.decoded.development_observations.find((row: any) => row.metadata.stepId === role && row.value.stage === 'response');
  const withoutTestAgent = (v: any) => {
    v.snapshot.data.steps = v.snapshot.data.steps.filter((row: any) => row.step_id !== 'test-agent');
    for (const group of ['development_results', 'development_observations']) v.contents.decoded[group] = v.contents.decoded[group].filter((row: any) => row.metadata.stepId !== 'test-agent');
  };
  for (const [label, change] of [
    ['scope configuration', (v: any) => { v.snapshot.data.scope_runs[0].configuration_digest = 'e'.repeat(64); }],
    ['scope expiry binding', (v: any) => { v.snapshot.data.scope_runs[0].expires_at = '2000-01-01T00:00:00.000Z'; }],
    ['scope draft revision', (v: any) => { v.snapshot.data.scope_runs[0].draft_revision++; }],
    ['scope unknown batch', (v: any) => { v.snapshot.data.scope_batches[0].batch_id = 'f'.repeat(64); }],
    ['scope malformed state', (v: any) => { v.snapshot.data.scope_batches[0].record.state = 'unclaimed'; }],
    ['scope changed binding', (v: any) => { v.snapshot.data.scope_batches[0].record.binding.inputDigest = 'd'.repeat(64); }],
    ['scope SQL reservation', (v: any) => { v.snapshot.data.scope_batches[0].reservation_id = randomUUID(); }],
    ['scope changed rendered request', (v: any) => { scopeRequest(v).value.rendered.request.source += ' altered'; }],
    ['scope changed request body', (v: any) => { const r = scopeRequest(v); r.value.requestBody = JSON.stringify({ ...JSON.parse(r.value.requestBody), store: true }); }],
    ['scope changed response', (v: any) => { const r = scopeResponse(v), b = JSON.parse(r.value.responseBody); b.model = 'not-approved'; r.value.responseBody = JSON.stringify(b); }],
    ['scope missing request', (v: any) => { v.contents.decoded.scope_observations = v.contents.decoded.scope_observations.filter((o: any) => o !== scopeRequest(v)); }],
    ['scope checkpoint mismatch', (v: any) => { v.snapshot.data.scope_batches[0].record.resultDigest = 'e'.repeat(64); }],
    ['scope duplicate response', (v: any) => { v.contents.decoded.scope_observations.push(structuredClone(scopeResponse(v))); }],
    ['scope orphan response', (v: any) => { scopeResponse(v).metadata.reviewId = randomUUID(); }],
    ['development operation configuration', (v: any) => { const op = v.snapshot.data.operations.find((row: any) => row.action === 'develop'); op.binding.configurationDigest = 'c'.repeat(64); }],
    ['development operation expiry', (v: any) => { v.snapshot.data.operations.find((row: any) => row.action === 'develop').expires_at = '2000-01-01T00:00:00.000Z'; }],
    ['development recorded-scope lineage', (v: any) => { v.contents.decoded.development_originals[0].value.direction.scopeReview.reviewId = randomUUID(); }],
    ['development step owner', (v: any) => { devStep(v).record.owner = 'different-owner'; }],
    ['development step reservation', (v: any) => { devStep(v).reservation_id = randomUUID(); }],
    ['development step input', (v: any) => { devStep(v).record.binding.inputDigest = 'c'.repeat(64); }],
    ['development checkpoint reference', (v: any) => { devStep(v).result_ref = randomUUID(); }],
    ['development checkpoint digest', (v: any) => { devStep(v).record.resultDigest = 'e'.repeat(64); }],
    ['development result owner', (v: any) => { devResult(v).metadata.owner = 'different-owner'; }],
    ['development result mismatch', (v: any) => { devResult(v).value.output.brief += ' changed'; }],
    ['Test Agent predecessor', (v: any) => { devStep(v, 'test-agent').predecessor_result_digest = 'e'.repeat(64); }],
    ['Test Agent inherited Exam', (v: any) => { devRequest(v, 'test-agent').value.rendered.request.source += '\nPrior hidden Exam'; }],
    ['development duplicate result', (v: any) => { v.contents.decoded.development_results.push(structuredClone(devResult(v))); }],
    ['development orphan observation', (v: any) => { devResponse(v).metadata.operationId = randomUUID(); }],
    ['development response without request', (v: any) => { v.contents.decoded.development_observations = v.contents.decoded.development_observations.filter((r: any) => r !== devRequest(v)); }],
    ['development response usage', (v: any) => { devResponse(v).value.usage.totalTokens++; }],
  ] as const) await deny(label, change);

  const pending: any = copy(); pending.snapshot.data.scope_batches = [];
  pending.snapshot.data.steps = pending.snapshot.data.steps.filter((row: any) => row.step_id === 'candidate-save');
  for (const group of ['scope_observations', 'development_observations', 'development_results']) pending.contents.decoded[group] = [];
  pending.contents.decoded.development_originals = []; pending.snapshot.data.development_originals = [];
  const waiting = await verifier.verify(pending);
  assert.ok(waiting.scopeReviews.every(review => review.review.state === 'incomplete' && review.batches.every(batch => batch.state === 'pending' && !batch.checkpointVerified)));
  assert.equal(waiting.developments.length, 0);
  assert.equal(waiting.counts.scopeSdkExchanges + waiting.counts.developmentSdkExchanges, 0); passed++;

  const generationPending: any = copy();
  generationPending.snapshot.data.steps = generationPending.snapshot.data.steps.filter((row: any) => row.step_id === 'candidate-save');
  generationPending.contents.decoded.development_observations = []; generationPending.contents.decoded.development_results = [];
  const noGeneration = await verifier.verify(generationPending);
  assert.equal(noGeneration.developments.length, 1);
  assert.ok(noGeneration.developments[0]!.roles.every(role => role.state === 'pending' && !role.responseVerified && role.result === null)); passed++;

  const requestOnly: any = copy(), boundReviewId = requestOnly.contents.decoded.development_originals[0].value.direction.scopeReview.reviewId;
  const selected = requestOnly.snapshot.data.scope_batches.find((row: any) => row.review_id !== boundReviewId); assert.ok(selected);
  selected.record.state = 'outcome-unknown'; selected.record.resultDigest = null;
  requestOnly.contents.decoded.scope_observations = requestOnly.contents.decoded.scope_observations.filter((r: any) =>
    !(r.metadata.reviewId === selected.review_id && r.metadata.batchId === selected.batch_id && r.value.stage === 'response'));
  const unknownScope = await verifier.verify(requestOnly), unknownBatch = unknownScope.scopeReviews.find(r => r.reviewId === selected.review_id)!.batches.find(b => b.batchId === selected.batch_id)!;
  assert.equal(unknownBatch.requestVerified, true); assert.equal(unknownBatch.responseVerified, false); assert.equal(unknownBatch.checkpointVerified, false); passed++;

  const unknown: any = copy(); withoutTestAgent(unknown);
  const step = devStep(unknown); step.record.state = 'outcome-unknown'; step.record.resultDigest = null; step.result_ref = null;
  const uncheckpointed = await verifier.verify(unknown), architect = uncheckpointed.developments[0]!.roles[0]!;
  assert.equal(architect.responseVerified, true); assert.equal(architect.state, 'outcome-unknown'); assert.equal(architect.checkpointVerified, false); assert.equal(architect.result, null); passed++;

  const clarifying: any = copy(); withoutTestAgent(clarifying);
  const result = devResult(clarifying), response = devResponse(clarifying);
  result.value = { role: 'architect', output: { message: 'One required clarification.', questions: ['Which booking rules apply?'], brief: null, spec: null } };
  result.metadata.outputDigest = hash(result.value); result.row.result_digest = developmentResultCodec.resultDigest(result.metadata);
  response.value.result = result.value;
  const body = JSON.parse(response.value.responseBody); body.choices[0].message.content = JSON.stringify(result.value.output); response.value.responseBody = JSON.stringify(body);
  response.metadata.payloadDigest = hash(response.value); response.metadata.outputDigest = hash(result.value);
  devStep(clarifying).record.resultDigest = result.row.result_digest;
  const question = await verifier.verify(clarifying);
  assert.equal(question.developments[0]!.roles[0]!.checkpointVerified, true); assert.equal(question.developments[0]!.roles[1]!.state, 'pending'); passed++;

  const cancelled = copy(); let checks = 0; cancelled.check = () => { if (++checks === 2) throw new Error('Cancelled synthetic lease'); };
  await assert.rejects(verifier.verify(cancelled)); passed++;
  const priorFetch = globalThis.fetch;
  try { globalThis.fetch = async () => { throw new Error('Read-only verifier must never call a provider'); };
    const result = await verifier.verify(copy()); assert.equal(result.counts.scopeSdkExchanges, 4); assert.equal(result.counts.developmentSdkExchanges, 2);
    for (const flag of ['sourcePermissionsVerified', 'profileApprovalVerified', 'semanticQualityVerified', 'candidateExecutionVerified', 'executionAuthorized', 'retryAuthorized', 'gateSigned'] as const) assert.equal(result[flag], false);
    assert.ok(Object.isFrozen(result)); passed++;
  } finally { globalThis.fetch = priorFetch; }
  console.log(`PASS production recorded-history isolation: ${passed} SDK/lineage/partial-state/cancellation cases; no provider calls, current authority or execution proof.`);
  return { cases: passed, syntheticPostDecodeMutations: true, currentAuthorityVerified: false, realModelCalls: 0 };
}
