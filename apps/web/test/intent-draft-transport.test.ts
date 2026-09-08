import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createIntentDraftTransport } from '../app/intent-draft-transport.ts';
import { fingerprintIntentScope } from '@steer/tool-registry/intent-revision-contracts';
import { discoveryFixture } from '../../../packages/tool-registry/test/intent-draft-discovery.fixture.ts';

test('discovery uses a fixed authenticated read-only path and validates scoped cursor metadata', async () => {
  const f = discoveryFixture(); let calls = 0;
  const transport = createIntentDraftTransport('https://steer.example', async (url, init) => {
    calls++; assert.equal(String(url), 'https://steer.example/v1/tools/intent.draft.discover');
    assert.equal(init?.credentials, 'same-origin'); assert.equal(init?.cache, 'no-store');
    assert.deepEqual(JSON.parse(String(init?.body)), f.input); return Response.json(f.output);
  });
  assert.deepEqual(await transport.discover(f.input), f.output); transport.close();
  await assert.rejects(transport.discover(f.input)); assert.equal(calls, 1);
  for (const patch of [{ repository: 'github:99' }, { cursor: { createdAt: f.entry.createdAt, draftId: f.entry.draftId } }, { savedToGit: true }])
    await assert.rejects(createIntentDraftTransport('https://steer.example', async () => Response.json({ ...f.output, ...patch })).discover(f.input));
});

const scope = { organizationId: 'org', productId: 'product', repository: 'github:52' };
const id = '00000000-0000-4000-8000-000000000001', mutationId = '00000000-0000-4000-8000-000000000002';
const content = { originalText: 'Exact فارسی\n  text', clarificationTurns: ['one', 'two'], documents: { brief: '# B\n' + 'a'.repeat(18000), spec: '# S', exam: '# E' } };
const input = { ...scope, draftId: id, mutationId, expectedRevision: 0, expectedDigest: null, content };
const { scopeInputDigest } = await fingerprintIntentScope({ ...scope, draftId: id, sourceRevision: 1,
  originalText: content.originalText, clarificationTurns: content.clarificationTurns, documents: { brief: content.documents.brief, spec: content.documents.spec } });
const reference = { draftId: id, revision: 1, sourceRevision: 1, scopeInputDigest, revisionDigest: 'a'.repeat(64), latestRevision: 1, savedToGit: false as const };
const ack = { outcome: 'acknowledged', mutationId, ...reference };
const created = { outcome: 'created', requestId: mutationId, draftId: id, createdAt: '2026-09-08T00:00:00.000Z',
  useUntil: '2026-09-09T00:00:00.000Z', retentionDeadline: '2026-09-10T00:00:00.000Z', contentPreserved: false, savedToGit: false };

test('draft transport sends exact large UTF-8 snapshots to fixed authenticated paths with no automatic retry', async () => {
  const calls: string[] = [];
  const transport = createIntentDraftTransport('https://steer.example', async (url, init) => {
    calls.push(String(url)); assert.equal(init?.credentials, 'same-origin'); assert.equal(init?.mode, 'same-origin');
    assert.equal(init?.cache, 'no-store'); assert.equal(init?.redirect, 'error'); assert.equal(init?.referrerPolicy, 'no-referrer');
    assert.equal(new Headers(init?.headers).get('authorization'), null);
    if (String(url).endsWith('create')) return Response.json(created);
    if (String(url).endsWith('append')) { assert.deepEqual(JSON.parse(String(init?.body)), input); return Response.json(ack); }
    return Response.json({ ...reference, content });
  });
  assert.deepEqual(await transport.create({ ...scope, requestId: mutationId }), created);
  assert.deepEqual(await transport.append(input), ack);
  assert.deepEqual(await transport.read({ ...scope, draftId: id, revision: 'latest' }), { ...reference, content });
  assert.deepEqual(calls.map(v => v.split('/').at(-1)), ['intent.draft.create', 'intent.draft.append', 'intent.draft.read']);
  transport.close(); await assert.rejects(transport.append(input)); assert.equal(calls.length, 3);
});

test('reference creation verifies echoed request, lifecycle order and false preservation claim', async () => {
  for (const output of [{ ...created, requestId: id }, { ...created, contentPreserved: true },
    { ...created, useUntil: created.createdAt }, { ...created, useUntil: '2027-01-01T00:00:00.000Z' }]) {
    await assert.rejects(createIntentDraftTransport('https://steer.example', async () => Response.json(output)).create({ ...scope, requestId: mutationId }));
  }
});

test('append acknowledgements must bind exact mutation, parent, draft and scope; older duplicate ACK remains distinguishable', async () => {
  for (const output of [{ ...ack, mutationId: id }, { ...ack, draftId: mutationId }, { ...ack, revision: 2, latestRevision: 2 },
    { ...ack, scopeInputDigest: 'b'.repeat(64) }, { ...ack, savedToGit: true }, { ...ack, gateSigned: true }]) {
    await assert.rejects(createIntentDraftTransport('https://steer.example', async () => Response.json(output)).append(input));
  }
  const output = await createIntentDraftTransport('https://steer.example', async () => Response.json({ ...ack, latestRevision: 3 })).append(input);
  assert.equal(output.outcome, 'acknowledged'); if (output.outcome === 'acknowledged') assert.equal(output.latestRevision, 3);
});

test('readback must bind requested scope/revision, not another owner product or altered content', async () => {
  for (const output of [{ ...reference, content: { ...content, originalText: 'substituted' } },
    { ...reference, draftId: mutationId, content }, { ...reference, content, approval: true }]) {
    await assert.rejects(createIntentDraftTransport('https://steer.example', async () => Response.json(output)).read({ ...scope, draftId: id, revision: 'latest' }));
  }
  const transport = createIntentDraftTransport('https://steer.example', async () => Response.json({ ...reference, content }));
  await assert.rejects(transport.read({ ...scope, productId: 'other', draftId: id, revision: 'latest' }));
  await assert.rejects(transport.read({ ...scope, draftId: id, revision: 2 }));
});

test('historical draft read retains exact older content with a newer latest revision over the same authenticated read-only endpoint', async () => {
  let calls = 0;
  const transport = createIntentDraftTransport('https://steer.example', async (url, init) => {
    calls++; assert.equal(String(url), 'https://steer.example/v1/tools/intent.draft.read');
    assert.equal(init?.credentials, 'same-origin'); assert.equal(init?.cache, 'no-store');
    assert.deepEqual(JSON.parse(String(init?.body)), { ...scope, draftId: id, revision: 1 });
    return Response.json({ ...reference, latestRevision: 3, content });
  });
  const observed = await transport.read({ ...scope, draftId: id, revision: 1 });
  assert.equal(observed.revision, 1); assert.equal(observed.latestRevision, 3); assert.deepEqual(observed.content, content);
  assert.equal(observed.savedToGit, false); assert.equal(calls, 1); transport.close();
});

test('all uncertain HTTP failures are sanitized and sent once, including post-write access denial', async () => {
  for (const status of [401, 403, 409, 500, 503]) {
    let calls = 0; const transport = createIntentDraftTransport('https://steer.example', async () => { calls++; return Response.json({ secret: 'PRIVATE-BODY' }, { status }); });
    await assert.rejects(transport.append(input), error => { assert.doesNotMatch(String(error), /PRIVATE-BODY/); return true; });
    assert.equal(calls, 1);
  }
});

test('invalid origin/input and oversized append fail before network, including UTF-8 and escaped controls', async () => {
  for (const origin of ['http://localhost', 'https://user:secret@steer.example', 'https://steer.example/path', 'https://steer.example/']) assert.throws(() => createIntentDraftTransport(origin));
  const transport = createIntentDraftTransport('https://steer.example', async () => assert.fail('must not send'));
  for (const text of ['漢'.repeat(30000), '\u0000'.repeat(30000)]) await assert.rejects(transport.append({ ...input,
    content: { ...content, documents: { brief: text, spec: text, exam: text } } }));
  await assert.rejects(transport.append({ ...input, expectedRevision: 2 }));
});

test('non-JSON, oversized/chunked/invalid Unicode bodies and extra fields cannot become draft results', async () => {
  const responses = [new Response('secret'), new Response('x'.repeat(600001), { headers: { 'content-type': 'application/json' } }),
    new Response(new Uint8Array([0xff]), { headers: { 'content-type': 'application/json' } }),
    new Response(new ReadableStream({ start(c) { for (let i = 0; i < 10001; i++) c.enqueue(new Uint8Array([32])); c.close(); } }), { headers: { 'content-type': 'application/json' } })];
  for (const response of responses) await assert.rejects(createIntentDraftTransport('https://steer.example', async () => response).append(input));
});

test('timeout and close terminate ignored aborts; late fetch completion cannot be shown', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let resolve!: (response: Response) => void;
  const transport = createIntentDraftTransport('https://steer.example', async () => new Promise(r => { resolve = r; }));
  const result = transport.append(input); const rejected = assert.rejects(result);
  await assert.rejects(transport.read({ ...scope, draftId: id, revision: 'latest' }));
  t.mock.timers.tick(40001); await rejected;
  resolve(Response.json(ack)); await Promise.resolve();
  const second = transport.append(input); const secondRejected = assert.rejects(second); transport.close(); await secondRejected;
  resolve(Response.json(ack));
  let cancelled = 0;
  const stalled = createIntentDraftTransport('https://steer.example', async () => new Response(new ReadableStream({
    cancel() { cancelled++; },
  }), { headers: { 'content-type': 'application/json' } }));
  const body = stalled.append(input); const bodyRejected = assert.rejects(body);
  await Promise.resolve(); await Promise.resolve();
  t.mock.timers.tick(40001); await bodyRejected; assert.equal(cancelled, 1);
});
