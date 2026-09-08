import assert from 'node:assert/strict';
import test from 'node:test';
import { createIntentDevelopmentTransport } from '../app/intent-development-transport.ts';
import { developmentFixture } from '../../../packages/tool-registry/test/intent-development.fixture.ts';

test('recorded editor uses fixed same-origin bounded tools, verifies exact evidence and never sends source/model credentials', async () => {
  const f = await developmentFixture(), calls: unknown[] = [];
  const transport = createIntentDevelopmentTransport('https://steer.example', async (url, init) => {
    assert.equal(init?.credentials, 'same-origin'); assert.equal(init?.cache, 'no-store'); assert.equal(init?.redirect, 'error');
    assert.equal(init?.mode, 'same-origin'); assert.equal(init?.referrerPolicy, 'no-referrer'); assert.equal(new Headers(init?.headers).get('authorization'), null);
    const input = JSON.parse(String(init?.body)); calls.push(input); assert.doesNotMatch(String(init?.body), /originalText|profiles|budget|api.key/i);
    if (String(url).endsWith('.review')) return Response.json(f.review);
    if (String(url).endsWith('.prepare')) return Response.json(f.prepared);
    if (String(url).endsWith('.start')) return Response.json(f.started);
    assert.ok(String(url).endsWith('.read')); return Response.json(f.ready);
  });
  assert.deepEqual(await transport.review(f.input), { output: f.review, envelope: f.envelope });
  assert.deepEqual(await transport.prepare(f.prepareInput), f.prepared); assert.deepEqual(await transport.start(f.startInput), f.started);
  assert.deepEqual(await transport.read(f.readInput), f.ready); assert.equal(calls.length, 4);
  transport.close(); await assert.rejects(transport.read(f.readInput)); assert.equal(calls.length, 4);
});
test('substituted identity, source, direction, snapshots or false authority claims cannot be accepted', async () => {
  const f = await developmentFixture();
  for (const output of [{ ...f.review, draftId: f.prepared.reference!.operationId }, { ...f.review, sourceSnapshotDigest: 'f'.repeat(64) },
    { ...f.review, evidence: { ...f.review.evidence, documents: [{ sourceId: 'brief-1', content: 'Altered' }] } },
    { ...f.review, semanticReviewComplete: true }]) await assert.rejects(createIntentDevelopmentTransport('https://steer.example', async () => Response.json(output)).review(f.input));
  for (const output of [{ ...f.prepared, choice: { ...f.choice, reason: 'Silently different' } }, { ...f.prepared, revision: 2 }, { ...f.prepared, savedToGit: true }])
    await assert.rejects(createIntentDevelopmentTransport('https://steer.example', async () => Response.json(output)).prepare(f.prepareInput));
  await assert.rejects(createIntentDevelopmentTransport('https://steer.example', async () => Response.json({ ...f.ready, organizationId: 'foreign' })).read(f.readInput));
});
test('failed, redirected, malformed, oversized and non-JSON replies are sanitized and never retried', async () => {
  const f = await developmentFixture();
  for (const response of [Response.json({ private: 'PRIVATE' }, { status: 403 }), Response.json({ private: 'PRIVATE' }, { status: 503 }),
    new Response('PRIVATE'), new Response(new Uint8Array([0xff]), { headers: { 'content-type': 'application/json' } }),
    new Response('x'.repeat(600001), { headers: { 'content-type': 'application/json' } })]) {
    let calls = 0; const transport = createIntentDevelopmentTransport('https://steer.example', async () => { calls++; return response; });
    await assert.rejects(transport.start(f.startInput), error => { assert.doesNotMatch(String(error), /PRIVATE/); return true; }); assert.equal(calls, 1);
  }
  for (const origin of ['http://localhost', 'https://user:password@steer.example', 'https://steer.example/path']) assert.throws(() => createIntentDevelopmentTransport(origin));
});
test('closing aborts even a noncooperative fetch and prevents late results and parallel requests', async () => {
  const f = await developmentFixture(); let release!: (value: Response) => void;
  const transport = createIntentDevelopmentTransport('https://steer.example', async () => new Promise(resolve => { release = resolve; }));
  const first = transport.start(f.startInput); await assert.rejects(transport.read(f.readInput));
  transport.close(); await assert.rejects(first); release(Response.json(f.started)); await assert.rejects(transport.review(f.input));
});
