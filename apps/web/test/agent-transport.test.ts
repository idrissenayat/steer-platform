import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAgentTransport } from '../app/agent-transport.ts';
const input = { organizationId: 'org', intent: 'Build a booking flow', clarification: '' };
const output = { kind: 'intent-agent-candidate', organizationId: 'org', subject: 'human', sourceDigest: 'a'.repeat(64), configurationRevision: 'test', message: 'Who books?', questions: ['Who books?'], documents: null, saved: false, gateSigned: false, executionAuthorized: false };

test('only fixed same-origin authenticated command is called; no retries or read-preview substitution', async () => {
  let calls = 0;
  const transport = createAgentTransport('https://steer.example', async (url, init) => {
    calls++; assert.equal(url, 'https://steer.example/v1/tools/intent.agent.develop');
    assert.equal(init?.credentials, 'same-origin'); assert.equal(init?.redirect, 'error'); assert.equal(init?.cache, 'no-store');
    assert.deepEqual(JSON.parse(String(init?.body)), input); return Response.json(output);
  });
  assert.deepEqual(await transport.develop(input), output); assert.equal(calls, 1); transport.close();
  await assert.rejects(transport.develop(input)); assert.equal(calls, 1);
});
test('errors have actionable messages, not server content, and UTF-8 body bounds run before I/O', async () => {
  for (const [status, message] of [[401, /session ended/], [403, /not enabled/], [503, /budget may be unavailable/]] as const) {
    let calls = 0; const transport = createAgentTransport('https://steer.example', async () => { calls++; return Response.json({ secret: 'provider text' }, { status }); });
    await assert.rejects(transport.develop(input), message); assert.equal(calls, 1);
  }
  const transport = createAgentTransport('https://steer.example', async () => { assert.fail('Oversized input must not be sent'); });
  await assert.rejects(transport.develop({ ...input, intent: '😀'.repeat(5000) }), /too large/);
});
test('insecure origins, malformed output and oversized output are rejected', async () => {
  assert.throws(() => createAgentTransport('http://localhost'));
  for (const response of [Response.json({ success: true }), Response.json({ ...output, saved: true }), new Response('x'.repeat(600001), { headers: { 'content-type': 'application/json' } })]) {
    await assert.rejects(createAgentTransport('https://steer.example', async () => response).develop(input));
  }
});
