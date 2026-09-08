import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecordedScopeMastraRuntime, createRecordedScopeMastraVerifier, type RecordedScopeResult, type RecordedRequest, type RecordedResponse } from '../src/recorded-mastra.ts';
import { scopeReviewFixture } from '../../tool-registry/test/intent-scope-review.fixture.ts';
import { validateIntentScopeBatchResults } from '@steer/tool-registry/intent-scope-batches';

const gateway = { gatewayUrl: 'http://127.0.0.1:4000/v1', gatewayKey: 'synthetic-scope-key' };
const providerResponse = (output: unknown) => ({ id: 'synthetic-completion', object: 'chat.completion', model: 'synthetic-model', created: 1,
  choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(output) } }],
  usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 } });
async function fixture(count = 4) {
  const f = await scopeReviewFixture(count);
  return { ...f, options: { ...gateway, scope: f.scope, evidence: f.evidence, profile: { ...f.profile, allowedResponseModels: ['synthetic-model'] } } };
}
test('actual Mastra scope requests and raw receipts compose into batch coverage with exact context, no shared memory or semantic quality claim', async () => {
  const f = await fixture(50), order: string[] = [], results: RecordedScopeResult[] = [];
  const observations: Array<{ batchId: string; request: RecordedRequest; response: RecordedResponse<RecordedScopeResult> }> = [];
  let request!: RecordedRequest, response!: RecordedResponse<RecordedScopeResult>;
  const runtime = await createRecordedScopeMastraRuntime({ ...f.options, transport: async (_, init) => {
    order.push('transport'); const wire = JSON.parse(String(init?.body)), context = JSON.parse(wire.messages[1].content);
    assert.equal(wire.messages.length, 2); assert.equal(wire.messages[0].content, f.profile.instructions);
    assert.equal(wire.store, false); assert.equal(wire.tools, undefined); assert.equal(init?.redirect, 'error');
    assert.equal(wire.messages[1].content, f.prepared.batches.find(b => b.metadata.batchId === context.binding.batchId)!.packet.request.source);
    assert.equal(request.requestBody, String(init?.body));
    return new Response(JSON.stringify(providerResponse(f.result(f.prepared.batches.find(b => b.metadata.batchId === context.binding.batchId)!))) + '\r\n',
      { headers: { 'content-type': 'application/json', 'x-request-id': 'synthetic-request-id' } });
  } });
  assert.deepEqual(runtime.plan, f.prepared.plan); assert.equal(runtime.preparationDigest, f.prepared.preparationDigest);
  for (const b of runtime.plan.batches) {
    const value = await runtime.generate(b.batchId, { recordRequest: async v => { request = v; order.push('request'); },
      authorizeDispatch: async () => { order.push('authorize'); }, recordResponse: async v => { response = v; order.push('response'); } }, new AbortController().signal);
    assert.equal(value.role, 'scope-reviewer'); assert.deepEqual(value, response.result);
    assert.ok(response.responseBody.endsWith('\r\n')); assert.equal(response.providerRequestId, 'synthetic-request-id');
    assert.deepEqual(runtime.verify(b.batchId, request, response).result, value);
    observations.push({ batchId: b.batchId, request, response }); results.push(value);
  }
  assert.deepEqual(order, ['request', 'authorize', 'transport', 'response', 'request', 'authorize', 'transport', 'response']);
  const combined = await validateIntentScopeBatchResults(f.evidence, results.map(r => ({ planDigest: r.planDigest, batchId: r.batchId, assessment: r.output })), f.profile.profileRevision);
  assert.equal(combined.structuralAssessmentComplete, true); assert.equal(combined.semanticQualityVerified, false); assert.equal(combined.authoritativeClearance, false);
  assert.ok(!JSON.stringify(observations).includes(gateway.gatewayKey));
  const oldFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error('Verifier cannot use network'); };
    const verifier = await createRecordedScopeMastraVerifier({ scope: f.scope, evidence: f.evidence, profile: f.options.profile });
    assert.deepEqual(Object.keys(verifier), ['verifyRequest','verify']);
    for(const o of observations) assert.equal(verifier.verifyRequest(o.batchId,o.request),undefined);
    assert.throws(()=>verifier.verifyRequest(observations[1]!.batchId,observations[0]!.request));
    assert.throws(()=>verifier.verifyRequest(observations[0]!.batchId,{...observations[0]!.request,requestBody:'{}'}));
    for (const o of observations) assert.deepEqual(verifier.verify(o.batchId, o.request, o.response).result, o.response.result);
    assert.throws(() => verifier.verify(observations[1]!.batchId, observations[0]!.request, observations[0]!.response));
    const o = observations[0]!;
    assert.throws(() => verifier.verify(o.batchId, { ...o.request, requestBody: o.request.requestBody.replace('Email only', 'SMS only') }, o.response));
    assert.throws(() => verifier.verify(o.batchId, o.request, { ...o.response, result: { ...o.response.result, planDigest: 'f'.repeat(64) } }));
    assert.throws(() => verifier.verify(o.batchId, o.request, { ...o.response, usage: { ...o.response.usage, totalTokens: 61 } }));
    const changed = await createRecordedScopeMastraVerifier({ scope: f.scope, evidence: { ...f.evidence, permissionsRevision: 'new-permissions' }, profile: f.options.profile });
    assert.throws(() => changed.verifyRequest(o.batchId,o.request));
    assert.throws(() => changed.verify(o.batchId, o.request, o.response));
    const changedModels = await createRecordedScopeMastraVerifier({ scope: f.scope, evidence: f.evidence, profile: { ...f.options.profile, allowedResponseModels: ['synthetic-model', 'another-model'] } });
    assert.throws(() => changedModels.verifyRequest(o.batchId,o.request));
    assert.throws(() => changedModels.verify(o.batchId, o.request, o.response));
  } finally { globalThis.fetch = oldFetch; }
});
test('invented citations, stale binding, wrong profile, refusal, tools and corrupt usage cannot produce a recorded scope result', async () => {
  const f = await fixture(), batchId = f.prepared.batches[0]!.metadata.batchId;
  const mutations: Array<(v: any) => void> = [v => { v.output.findings[0].citations[0].quote += 'invented'; },
    v => { v.output.assessmentInputDigest = 'f'.repeat(64); }, v => { v.output.configurationRevision = 'other'; },
    v => { v.output.findings[0].targetId = 'intent/9999'; }, v => { v.output.findings[0].assessedSourceIds.push('missing'); },
    v => { v.output.authoritativeClearance = true; }, v => { v.response.model = 'wrong'; },
    v => { v.response.choices[0].message.refusal = 'private-refusal'; }, v => { v.response.choices[0].finish_reason = 'length'; },
    v => { v.response.choices[0].message.tool_calls = [{ id: 'bad' }]; }, v => { v.response.usage.total_tokens = 61; },
    v => { v.response.usage.completion_tokens = 9000; }, v => { v.response.error = { message: 'private-error' }; }];
  for (const mutate of mutations) {
    let calls = 0, recorded = 0; const output = f.result(f.prepared.batches[0]!), response = providerResponse(output);
    mutate({ output, response }); response.choices[0]!.message.content = JSON.stringify(output);
    const runtime = await createRecordedScopeMastraRuntime({ ...f.options, transport: async () => { calls++; return Response.json(response); } });
    await assert.rejects(runtime.generate(batchId, { recordRequest: async () => {}, authorizeDispatch: async () => {}, recordResponse: async () => { recorded++; } }, new AbortController().signal),
      { message: 'Recorded model generation is unavailable.' });
    assert.equal(calls, 1); assert.equal(recorded, 0);
  }
});
test('missing acknowledgements and source-authority denial stop dispatch; lost response acknowledgement cannot trigger automatic retry', async () => {
  const f = await fixture(), batchId = f.prepared.batches[0]!.metadata.batchId;
  for (const failure of ['request', 'authority', 'response'] as const) {
    let calls = 0; const runtime = await createRecordedScopeMastraRuntime({ ...f.options, transport: async () => { calls++; return Response.json(providerResponse(f.result(f.prepared.batches[0]!))); } });
    await assert.rejects(runtime.generate(batchId, { recordRequest: async () => { if (failure === 'request') throw new Error('private-ack'); },
      authorizeDispatch: async () => { if (failure === 'authority') throw new Error('private-authority'); },
      recordResponse: async () => { if (failure === 'response') throw new Error('private-ack'); } }, new AbortController().signal));
    assert.equal(calls, failure === 'response' ? 1 : 0);
  }
});
test('omitted findings, abstentions and global access gaps remain incomplete after recorded SDK responses', async () => {
  for (const mode of ['omit', 'abstain', 'access'] as const) {
    const f = await fixture(); if (mode === 'access') f.evidence.accessGapCount = 1;
    const runtime = await createRecordedScopeMastraRuntime({ ...f.options, evidence: f.evidence, transport: async (_, init) => {
      const context = JSON.parse(JSON.parse(String(init?.body)).messages[1].content), output: any = f.result(f.prepared.batches[0]!);
      output.assessmentInputDigest = context.binding.assessmentInputDigest;
      if (mode === 'omit') output.findings.pop(); if (mode === 'abstain') output.findings[0].relation = 'insufficient-evidence';
      return Response.json(providerResponse(output));
    } });
    const r = await runtime.generate(runtime.plan.batches[0]!.batchId, { recordRequest: async () => {}, authorizeDispatch: async () => {}, recordResponse: async () => {} }, new AbortController().signal);
    const combined = await validateIntentScopeBatchResults(f.evidence, [{ planDigest: r.planDigest, batchId: r.batchId, assessment: r.output }], f.profile.profileRevision);
    assert.equal(combined.state, 'incomplete'); assert.equal(combined.structuralAssessmentComplete, false);
  }
});
test('wrong batch, stale current intent, altered instructions and cancelled requests fail before transport', async () => {
  const f = await fixture(); let calls = 0;
  const options = { ...f.options, transport: async () => { calls++; throw new Error('Transport must not be reached'); } };
  await assert.rejects(createRecordedScopeMastraRuntime({ ...options, gatewayUrl: 'https://api.openai.com/v1' }));
  await assert.rejects(createRecordedScopeMastraRuntime({ ...options, profile: { ...options.profile, instructions: 'private-changed' } as any }), { message: 'Recorded model generation is unavailable.' });
  await assert.rejects(createRecordedScopeMastraRuntime({ ...options, scope: { ...f.scope, originalText: 'changed' } }));
  const runtime = await createRecordedScopeMastraRuntime(options), hooks = { recordRequest: async () => {}, authorizeDispatch: async () => {}, recordResponse: async () => {} };
  await assert.rejects(runtime.generate('f'.repeat(64), hooks, new AbortController().signal));
  const cancellation = new AbortController(); cancellation.abort();
  await assert.rejects(runtime.generate(runtime.plan.batches[0]!.batchId, hooks, cancellation.signal)); assert.equal(calls, 0);
});
test('scope cancellation discards a late successful response and cannot authorize another call', async () => {
  const f = await fixture(); let release!: (v: Response) => void, entered!: () => void, calls = 0, stored = 0, cancelled = false;
  const ready = new Promise<void>(r => { entered = r; });
  const runtime = await createRecordedScopeMastraRuntime({ ...f.options, transport: async () => { calls++; entered(); return new Promise<Response>(r => { release = r; }); } });
  const cancellation = new AbortController(), run = runtime.generate(runtime.plan.batches[0]!.batchId, { recordRequest: async () => {}, authorizeDispatch: async () => {}, recordResponse: async () => { stored++; } }, cancellation.signal);
  await ready; cancellation.abort(); await assert.rejects(run);
  release(new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'content-type': 'application/json' } }));
  await new Promise(r => setImmediate(r)); assert.equal(calls, 1); assert.equal(stored, 0); assert.equal(cancelled, true);
});
