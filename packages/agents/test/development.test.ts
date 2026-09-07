import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createIntentDevelopment, type DevelopmentPermit } from '../src/development.ts';
import { createMastraDevelopmentRuntime } from '../src/mastra.ts';

const input = { organizationId: 'org', intent: 'Build an accessible appointment booking flow.', clarification: '' };
const ready = { message: 'Here are your drafts.', questions: [], brief: '# Brief\nBooking intent', spec: '# Spec\nAC-01: Book a slot' };
const allow: DevelopmentPermit = { reserve: async () => true };
const create = (generate: Parameters<typeof createIntentDevelopment>[0]['runtime']['generate'], permit = allow) =>
  createIntentDevelopment({ organizationId: 'org', configurationRevision: 'candidate-v1', runtime: { generate }, permit });

test('clarification is one bounded call, not a standard questionnaire or pretend document bundle', async () => {
  let calls = 0;
  const service = create(async role => { calls++; assert.equal(role, 'architect');
    return { message: 'One detail would help.', questions: ['Who books?'], brief: null, spec: null }; });
  const result = await service.develop(input, 'human', async () => {});
  assert.equal(calls, 1); assert.equal(result.documents, null); assert.equal(result.saved, false);
  assert.deepEqual(result.questions, ['Who books?']);
});

test('ready intent creates Brief and Spec then an isolated Test Agent Exam; no authority or saves', async () => {
  const calls: { role: string; source: string }[] = []; let reservations = 0; let checks = 0;
  const result = await create(async (role, source) => {
    calls.push({ role, source }); return role === 'architect' ? ready : { exam: '# Exam\nNOT RUN: AC-01' };
  }, { reserve: async () => { reservations++; return true; } }).develop(input, 'human', async () => { checks++; });
  assert.deepEqual(calls.map(call => call.role), ['architect', 'test-agent']);
  assert.deepEqual(JSON.parse(calls[1]!.source), { source: { intent: input.intent, clarification: '' }, brief: ready.brief, spec: ready.spec });
  assert.equal(calls[1]!.source.includes(ready.message), false);
  assert.equal(reservations, 2); assert.ok(checks >= 7); assert.match(result.sourceDigest, /^[a-f0-9]{64}$/);
  assert.equal(result.documents?.exam, '# Exam\nNOT RUN: AC-01');
  assert.equal(result.saved, false); assert.equal(result.gateSigned, false); assert.equal(result.executionAuthorized, false);
});

test('missing budget, wrong organization and revoked access cause no model calls', async () => {
  let calls = 0; const generate = async () => { calls++; return ready; };
  await assert.rejects(create(generate, { reserve: async () => false }).develop(input, 'human', async () => {}));
  await assert.rejects(create(generate).develop({ ...input, organizationId: 'other' }, 'human', async () => {}));
  await assert.rejects(create(generate).develop(input, 'human', async () => { throw new Error('revoked'); }));
  assert.equal(calls, 0);
});

test('rechecks budget and identity before independent Exam; never returns partial success', async () => {
  let calls = 0; let reservations = 0;
  await assert.rejects(create(async () => { calls++; return ready; }, { reserve: async () => ++reservations < 2 }).develop(input, 'human', async () => {}));
  assert.equal(calls, 1);
  let revoked = false; calls = 0;
  await assert.rejects(create(async () => { revoked = true; calls++; return ready; }).develop(input, 'human', async () => { if (revoked) throw new Error(); }));
  assert.equal(calls, 1);
});

test('malformed, contradictory, incomplete and excessive model output are rejected, not fabricated', async () => {
  for (const output of [{ ...ready, brief: null }, { ...ready, questions: ['Who?'] }, { ...ready, questions: Array(4).fill('Who?') }, { ...ready, spec: 'x'.repeat(30001) }, { secret: 'not a document' }]) {
    let calls = 0;
    await assert.rejects(create(async () => { calls++; return output; }).develop(input, 'human', async () => {}));
    assert.equal(calls, 1);
  }
});

test('busy service does not duplicate calls; rejected operation can be explicitly attempted later', async () => {
  let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; });
  const service = create(async () => { await wait; throw new Error('provider failed'); });
  const first = service.develop(input, 'human', async () => {});
  await assert.rejects(service.develop(input, 'human', async () => {})); release(); await assert.rejects(first);
});

test('Mastra uses only the configured LiteLLM endpoint, native schema, one call, bounded tokens and no storage', async () => {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const runtime = createMastraDevelopmentRuntime({ gatewayUrl: 'http://127.0.0.1:4000/v1', gatewayKey: 'fake-fixture-only',
    model: 'steer-intent', maxOutputTokens: 2000, transport: async (url, init) => {
      const body = JSON.parse(String(init?.body)); calls.push({ url: String(url), body });
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer fake-fixture-only');
      return Response.json({ id: 'fixture', object: 'chat.completion', created: 1, model: 'steer-intent',
        choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(ready) }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } });
    } });
  assert.deepEqual(await runtime.generate('architect', JSON.stringify(input), new AbortController().signal), ready);
  assert.equal(calls.length, 1); assert.equal(calls[0]?.url, 'http://127.0.0.1:4000/v1/chat/completions');
  assert.equal(calls[0]?.body.store, false); assert.equal(calls[0]?.body.max_tokens, 2000);
  assert.ok(calls[0]?.body.response_format);
});

test('provider failures do not retry or log source text', async () => {
  let calls = 0; const logs: unknown[] = []; const saved = { error: console.error, warn: console.warn, log: console.log };
  console.error = console.warn = console.log = (...args: unknown[]) => { logs.push(args); };
  try {
    const runtime = createMastraDevelopmentRuntime({ gatewayUrl: 'http://127.0.0.1:4000/v1', gatewayKey: 'fake-fixture-only', model: 'steer-intent', maxOutputTokens: 1000,
      transport: async () => { calls++; return Response.json({ error: { message: 'private-provider-content' } }, { status: 500 }); } });
    await assert.rejects(runtime.generate('architect', 'private-intent-content', new AbortController().signal), { message: 'Model generation did not complete.' });
    assert.equal(calls, 1); assert.equal(JSON.stringify(logs).includes('private-'), false);
  } finally { Object.assign(console, saved); }
});

test('direct provider URLs, userinfo, queries and excessive token budgets cannot configure the adapter', () => {
  for (const gatewayUrl of ['https://api.openai.com/v1', 'http://127.0.0.1:4000/v1?x=y', 'http://key@localhost:4000/v1']) {
    assert.throws(() => createMastraDevelopmentRuntime({ gatewayUrl, gatewayKey: 'fixture', model: 'steer-intent', maxOutputTokens: 2000 }));
  }
});
