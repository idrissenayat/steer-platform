import assert from 'node:assert/strict';
import { intentDraftReadOutputSchema } from '@steer/tool-registry/intent-draft-contracts';
import { verifyDevelopmentReview, type IntentDevelopmentReviewInput } from '@steer/tool-registry/intent-development-review-contracts';
import { summarizeIntentPerformance as summarize, type createIntentPerformanceProbe, type IntentPerformanceSample } from './intent-performance-probe.ts';

/** Read-only benchmark PREFIX, not the complete C22 harness or a live UI run.
 * Setup/teardown/token fixture material is never included in reported metadata. */
export async function testAuthenticatedPerformancePrefix(input: {
  probe: ReturnType<typeof createIntentPerformanceProbe>;
  source: IntentDevelopmentReviewInput; content: unknown; direction: string;
  post(name: string, body: unknown): Promise<Response>; restart(): Promise<void>;
}) {
  const { probe, source, post } = input;
  const draftInput = { organizationId: source.organizationId, productId: source.productId,
    repository: source.repository, draftId: source.draftId, revision: source.revision };
  const readDraft = async () => {
    const result = await probe.measure(() => post('intent.draft.read', draftInput));
    assert.equal(result.error, undefined); assert.ok(result.value); assert.equal(result.value.status, 200);
    const value = intentDraftReadOutputSchema.parse(await result.value.json());
    assert.equal(value.revisionDigest, source.revisionDigest); assert.equal(value.latestRevision, source.revision);
    assert.deepEqual(value.content, input.content);
    assert.ok(result.sample.attempts > 0); assert.equal(result.sample.outstandingAtReturn, 0);
    return result.sample;
  };
  const warm: IntentPerformanceSample[] = [], cold: IntentPerformanceSample[] = [];
  // One explicit primer is discarded as warm-up, not as an observed failure.
  const primer = await readDraft();
  for (let i = 0; i < 20; i++) warm.push(await readDraft());
  for (let i = 0; i < 3; i++) { await input.restart(); cold.push(await readDraft()); }
  const concurrent = await Promise.all(Array.from({ length: 4 }, () => readDraft()));
  const groups = { warm: summarize(warm, 20, warm.map(() => true)), cold: summarize(cold, 3, cold.map(() => true)),
    concurrent: summarize(concurrent, 4, concurrent.map(() => true)) };
  const sourceReview = await probe.measure(() => post('intent.development.review', source));
  assert.equal(sourceReview.error, undefined); assert.ok(sourceReview.value);
  let boundary: 'source-review-request-limit' | 'prefix-only';
  if (sourceReview.value.status === 200) {
    const result = await verifyDevelopmentReview(source, await sourceReview.value.json());
    assert.equal(result.output.evidence.documents.length, 34); boundary = 'prefix-only';
    assert.equal(sourceReview.sample.limited, false);
  } else {
    // A provider limit may hit the current identity lookup (401) or a service's
    // bounded work (503). Accept neither without the probe's own limit evidence.
    assert.ok([401, 503].includes(sourceReview.value.status));
    assert.equal(sourceReview.sample.limited, true); assert.ok(sourceReview.sample.attempts > 200);
    assert.ok(sourceReview.sample.dispatched <= 200);
    assert.doesNotMatch(await sourceReview.value.text(), /PRIVATE|Booking|instructions|requestBody/);
    boundary = 'source-review-request-limit';
  }
  assert.equal(sourceReview.sample.outstandingAtReturn, 0);
  const prefixTargetsMet = Object.values(groups).every(group => group.withinTarget)
    && cold.every(sample => sample.ms <= 5000) && concurrent.every(sample => sample.ms <= 5000)
    && sourceReview.value.status === 200 && sourceReview.sample.ms <= 5000 && sourceReview.sample.attempts <= 200;
  const report = { kind: 'synthetic-authenticated-performance-prefix/v1', direction: input.direction,
    delayMs: 20, maxAttempts: 200, sourceCount: 34, primer, groups,
    sourceReview: { status: sourceReview.value.status, sample: sourceReview.sample }, boundary, prefixTargetsMet,
    completeBenchmark: false, modelCalls: 0, providerSaves: 0, liveAcceptance: false };
  console.log('BENCHMARK PREFIX ONLY (C22 NOT PASSED): ' + JSON.stringify(report));
  return report;
}
