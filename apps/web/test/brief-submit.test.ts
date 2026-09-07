import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createBriefSubmissionClient, type SubmissionState } from '../app/brief-submit-client.ts';
import { createBriefSubmitTransport } from '../app/brief-submit-transport.ts';

const now = Date.now(), origin = 'https://steer.example', key = '16700000-0000-4000-8000-000000000001';
const scope = { organizationId: 'org', subject: 'human', expiresAt: new Date(now + 60000).toISOString() };
const markdown = '# Exact synthetic draft\n', digest = createHash('sha256').update(markdown).digest('hex');
const preview = { kind: 'brief-preview', ...scope, templateVersion: 'steer-brief/v1', markdown, contentDigest: digest, missing: [], saved: false, confirmed: false, executionAuthorized: false };
const { expiresAt: _unused, ...validPreview } = preview;
const destination = { kind: 'brief-destination-observation', organizationId: 'org', repository: 'github:1', branch: 'main',
  paths: ['items/0167-synthetic/BRIEF.md'], observedHead: 'a'.repeat(40), observedAt: new Date(now).toISOString(), writeAuthorized: false, gateVerified: false };
const draft = { title: 'Synthetic', problem: 'A', outcome: 'B', users: ['C'], systems: [], constraints: [], openQuestions: [], successMeasure: 'D' };
const input = { preview: validPreview, destination, path: destination.paths[0]!, draft };
function fixture() {
  const states: SubmissionState[] = [], calls: { url: string; body: Record<string, any> }[] = [];
  let time = now, pending: Record<string, any> | undefined, mode = 'unknown';
  let change = (value: unknown): unknown => value;
  const fetcher: typeof fetch = async (url, options) => {
    assert.equal(options?.credentials, 'same-origin'); assert.equal(options?.mode, 'same-origin'); assert.equal(options?.redirect, 'error');
    assert.equal(options?.cache, 'no-store'); assert.equal(options?.referrerPolicy, 'no-referrer'); assert.ok(options?.signal);
    const body = JSON.parse(String(options?.body)); calls.push({ url: String(url), body });
    if (String(url).endsWith('/intent.brief.save')) pending = body;
    assert.ok(pending);
    const reference = { organizationId: pending.organizationId, repository: pending.repository, branch: pending.branch, path: pending.path, idempotencyKey: pending.idempotencyKey, subject: scope.subject };
    const result = mode === 'committed' ? { ...reference, outcome: 'committed', expectedHead: pending.expectedHead, revision: 'b'.repeat(40), contentDigest: digest,
      blobSha: createHash('sha1').update(`blob ${Buffer.byteLength(markdown)}\0${markdown}`).digest('hex'),
      requestDigest: createHash('sha256').update(JSON.stringify({ version: 'steer-brief-create/v1', subject: scope.subject, input: pending, contentDigest: digest })).digest('hex') } : { ...reference, outcome: mode };
    return Response.json(change({ result, gateSigned: false }));
  };
  const client = createBriefSubmissionClient(scope, origin, value => states.push(value), { fetch: fetcher, now: () => time, uuid: () => key });
  return { client, states, calls, fetcher, time: (next: number) => { time = next; }, mode: (next: string) => { mode = next; }, change: (next: typeof change) => { change = next; } };
}
test('explicit enabled submission dispatches one immutable request; unknown status and edits never resubmit', async () => {
  const f = fixture(); await f.client.submit(input, false); assert.equal(f.calls.length, 0); assert.equal(f.client.attempted(), false);
  const mutable = structuredClone(input), run = f.client.submit(mutable, true); mutable.draft.title = 'Changed after click'; mutable.destination.observedHead = 'c'.repeat(40);
  await f.client.submit(input, true); await run;
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0]!.body.draft.title, 'Synthetic'); assert.equal(f.calls[0]!.body.expectedHead, 'a'.repeat(40));
  assert.equal(f.calls[0]!.body.idempotencyKey, key); assert.equal(f.client.attempted(), true);
  f.mode('not-found'); await f.client.check(); await f.client.submit(input, true);
  assert.equal(f.calls.length, 2); assert.ok(f.calls[1]!.url.endsWith('/intent.brief.save.status'));
  assert.deepEqual(Object.keys(f.calls[1]!.body).sort(), ['branch', 'idempotencyKey', 'organizationId', 'path', 'repository']); f.client.close();
});
test('status survives destination display expiry and accepts only the full exact committed receipt', async () => {
  const f = fixture(); await f.client.submit(input, true); f.time(now + 20000); f.mode('committed'); await f.client.check();
  assert.equal(f.states.at(-1)!.kind, 'observed');
  for (const patch of [{ subject: 'other' }, { idempotencyKey: '16700000-0000-4000-8000-000000000002' }, { path: 'items/0167-other/BRIEF.md' },
    { requestDigest: '0'.repeat(64) }, { contentDigest: '0'.repeat(64) }, { expectedHead: 'd'.repeat(40) }, { blobSha: 'd'.repeat(40) }, { revision: 'a'.repeat(40) }]) {
    f.change(value => { const v = value as { result: object }; return { ...v, result: { ...v.result, ...patch } }; });
    await f.client.check(); assert.equal(f.states.at(-1)!.kind, 'unknown');
  }
  f.change(value => ({ ...value as object, gateSigned: true })); await f.client.check(); assert.equal(f.states.at(-1)!.kind, 'unknown');
  assert.equal(f.calls.filter(call => call.url.endsWith('/intent.brief.save')).length, 1); f.client.close();
});
test('bad review, identity, destination or UUID fails before I/O; corrupt preview cannot dispatch', async () => {
  for (const value of [{ ...input, path: 'items/0167-other/BRIEF.md' }, { ...input, preview: { ...validPreview, subject: 'other' } },
    { ...input, destination: { ...destination, writeAuthorized: true } }, { ...input, destination: { ...destination, observedAt: new Date(now - 15000).toISOString() } }]) {
    const f = fixture(); await f.client.submit(value, true); assert.equal(f.calls.length, 0); f.client.close();
  }
  const f = fixture(); await f.client.submit({ ...input, preview: { ...validPreview, markdown: 'corrupt' } }, true); assert.equal(f.calls.length, 0); f.client.close();
  const states: SubmissionState[] = [];
  const bad = createBriefSubmissionClient(scope, origin, state => states.push(state), { fetch: f.fetcher, now: () => now, uuid: () => 'bad' });
  await bad.submit(input, true); assert.equal(f.calls.length, 0); bad.close();
});
test('closing during ignored-abort fetch discards late receipts and retains the attempted latch', async () => {
  let entered!: () => void, release!: () => void; const started = new Promise<void>(resolve => { entered = resolve; });
  const states: SubmissionState[] = [], f = fixture();
  const client = createBriefSubmissionClient(scope, origin, state => states.push(state), { now: () => now, uuid: () => key,
    fetch: async (...args) => { entered(); await new Promise<void>(resolve => { release = resolve; }); return f.fetcher(...args); } });
  const run = client.submit(input, true); await started; client.close(); release(); await run;
  assert.equal(states.length, 1); assert.equal(states[0]!.kind, 'submitting'); assert.equal(client.attempted(), true);
  await client.submit(input, true); await client.check(); assert.equal(f.calls.length, 1);
});
test('expiry and rollback do not reveal stale status or allow a second save', async () => {
  const f = fixture(); await f.client.submit(input, true); f.time(now + 60000); await f.client.check(); assert.equal(f.states.at(-1)!.kind, 'expired');
  assert.equal(f.calls.length, 1); await f.client.submit(input, true); assert.equal(f.calls.length, 1); f.client.close();
  const rollback = fixture(); await rollback.client.submit(input, true); rollback.mode('committed');
  rollback.change(value => { rollback.time(now - 1); return value; }); await rollback.client.check();
  assert.equal(rollback.states.at(-1)!.kind, 'expired'); rollback.client.close();
});
test('mutation transport rejects unsafe origin, redirects, malformed and oversized response; closed state denies work', async () => {
  for (const origin of ['http://steer.example', 'https://steer.example/path', 'https://user@steer.example']) assert.throws(() => createBriefSubmitTransport(origin));
  for (const response of [new Response('{}', { status: 503 }), new Response('bad', { headers: { 'content-type': 'application/json' } }),
    new Response('x'.repeat(65537), { headers: { 'content-type': 'application/json' } }), new Response('{}', { headers: { 'content-type': 'text/html' } })]) {
    const client = createBriefSubmitTransport(origin, async () => response); await assert.rejects(client.submit({})); client.close(); await assert.rejects(client.submit({}));
  }
  const redirect = Response.json({}); Object.defineProperty(redirect, 'redirected', { value: true });
  const redirected = createBriefSubmitTransport(origin, async () => redirect); await assert.rejects(redirected.submit({})); redirected.close();
  let calls = 0; const bounded = createBriefSubmitTransport(origin, async () => { calls++; return Response.json({}); });
  await assert.rejects(bounded.submit({ text: 'x'.repeat(16384) })); assert.equal(calls, 0); bounded.close();
});
test('mutation deadline covers ignored-abort headers and stalled bodies without overlap or automatic retry', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const header = createBriefSubmitTransport(origin, async () => new Promise<Response>(() => {}));
  const pending = header.submit({}); await assert.rejects(header.submit({})); context.mock.timers.tick(10000); await assert.rejects(pending); header.close();
  let cancelled = false;
  const body = createBriefSubmitTransport(origin, async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'content-type': 'application/json' } }));
  const reading = body.submit({}); await new Promise(resolve => setImmediate(resolve));
  context.mock.timers.tick(10000); await assert.rejects(reading); assert.equal(cancelled, true); body.close();
});
