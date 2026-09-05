import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProjectionTransport } from '../app/projection-transport.ts';
import { createProjectionConsumer } from '@steer/tool-registry/projection-consumer';

const origin = 'https://steer.example';
const scope = { organizationId: 'synthetic-org', repository: 'owner/repo' };
const cursor = { ...scope, generation: 'a1234567-1234-4123-8123-123456789012', position: '1' };
const record = { recordKey: 'intent/0001/BRIEF.md', sourceRevision: 'a'.repeat(40), contentDigest: 'b'.repeat(64) };
const snapshot = { ...scope, outcome: 'snapshot', records: [record], cursor };
const json = (value) => Response.json(value);

test('transport fixes endpoints, origin, cookie mode and headers without bearer authority or retries', async () => {
  const calls = [];
  const transport = createProjectionTransport(origin, async (url, init) => { calls.push({ url, init }); return json(snapshot); });
  assert.deepEqual(await transport.port.snapshot(scope), snapshot);
  await transport.port.changes({ ...scope, cursor, limit: 100 });
  assert.deepEqual(calls.map(({ url }) => url), [`${origin}/v1/tools/projection.snapshot.read`, `${origin}/v1/tools/projection.changes.read`]);
  for (const { init } of calls) {
    assert.equal(init.method, 'POST'); assert.equal(init.credentials, 'same-origin'); assert.equal(init.mode, 'same-origin');
    assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store'); assert.equal(init.referrerPolicy, 'no-referrer');
    assert.deepEqual(init.headers, { accept: 'application/json', 'content-type': 'application/json' });
  }
  for (const url of ['http://steer.example', `${origin}/`, `${origin}/other`, 'https://secret@steer.example', `${origin}?x=1`]) {
    assert.throws(() => createProjectionTransport(url));
  }
});

test('transport rejects status, redirects, wrong MIME and malformed encoding without exposing provider content', async () => {
  for (const response of [new Response('private 401', { status: 401 }), new Response('private 403', { status: 403 }),
    new Response('private 429', { status: 429, headers: { 'retry-after': '1' } }), new Response('private 503', { status: 503 }),
    new Response('private redirect', { status: 302, headers: { location: 'https://other.example' } }),
    new Response('private html', { headers: { 'content-type': 'text/html' } }),
    new Response('private bad json', { headers: { 'content-type': 'application/json' } }),
    new Response(new Uint8Array([0xff]), { headers: { 'content-type': 'application/json' } })]) {
    let calls = 0;
    const transport = createProjectionTransport(origin, async () => { calls++; return response; });
    await assert.rejects(transport.port.snapshot(scope), { message: 'References could not be verified. Refresh access and try again.' });
    assert.equal(calls, 1);
  }
  const response = json(snapshot); Object.defineProperty(response, 'redirected', { value: true });
  await assert.rejects(createProjectionTransport(origin, async () => response).port.snapshot(scope));
});

test('transport bounds actual bytes and chunks independent of advertised length and cancels invalid streams', async () => {
  let cancelled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(4 * 1024 * 1024 + 1)); }, cancel() { cancelled = true; } });
  const transport = createProjectionTransport(origin, async () => new Response(body, { headers: { 'content-type': 'application/json', 'content-length': '1' } }));
  await assert.rejects(transport.port.snapshot(scope)); assert.equal(cancelled, true);
  let count = 0;
  const empty = new ReadableStream({ pull(controller) { count++; controller.enqueue(new Uint8Array()); } });
  await assert.rejects(createProjectionTransport(origin, async () => new Response(empty, { headers: { 'content-type': 'application/json' } })).port.snapshot(scope));
  assert.ok(count <= 16386);
  let calls = 0;
  await assert.rejects(createProjectionTransport(origin, async () => { calls++; return json(snapshot); }).port.snapshot({ ...scope, repository: 'x'.repeat(17000) }));
  assert.equal(calls, 0);
});

test('transport closes pending work, suppresses late responses and permanently stops new admission', async () => {
  let resolve; let calls = 0; let cancelled = false;
  const transport = createProjectionTransport(origin, async () => { calls++; return new Promise((done) => { resolve = done; }); });
  const pending = transport.port.snapshot(scope);
  await assert.rejects(transport.port.snapshot(scope), /unavailable/);
  transport.close(); await assert.rejects(pending);
  resolve(new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'content-type': 'application/json' } }));
  await new Promise((done) => setImmediate(done)); assert.equal(cancelled, true);
  await assert.rejects(transport.port.snapshot(scope)); assert.equal(calls, 1);
});

test('transport deadline covers stalled headers and bodies even when a test port ignores abort', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const header = createProjectionTransport(origin, async () => new Promise(() => {}));
  const pending = header.port.snapshot(scope); context.mock.timers.tick(10000); await assert.rejects(pending);
  let cancelled = false;
  const body = createProjectionTransport(origin, async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'content-type': 'application/json' } }));
  const reading = body.port.snapshot(scope); await Promise.resolve(); await Promise.resolve();
  context.mock.timers.tick(10000); await assert.rejects(reading); assert.equal(cancelled, true);
});

test('consumer plus transport clears access-denied or invalid results and recovers only with a new snapshot', async () => {
  let mode = 'snapshot'; const calls = [];
  const transport = createProjectionTransport(origin, async (url) => {
    calls.push(url);
    if (mode === 'deny') return new Response('secret', { status: 403 });
    if (mode === 'foreign') return json({ ...snapshot, organizationId: 'other' });
    return json(snapshot);
  });
  const consumer = createProjectionConsumer(scope, transport.port);
  assert.equal((await consumer.sync()).records.length, 1);
  mode = 'deny'; assert.equal((await consumer.sync()).phase, 'failed'); assert.deepEqual(consumer.view().records, []);
  mode = 'foreign'; assert.equal((await consumer.sync()).phase, 'failed');
  mode = 'snapshot'; assert.equal((await consumer.sync()).phase, 'ready');
  assert.ok(calls[1].endsWith('projection.changes.read')); assert.ok(calls[2].endsWith('projection.snapshot.read'));
  transport.close(); await consumer.close(); assert.equal(consumer.view().phase, 'closed');
});
