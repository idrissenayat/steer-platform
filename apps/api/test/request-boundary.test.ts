import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequestBoundary } from '../src/request-boundary.ts';
import { readRequestBody, RequestBodyError } from '../src/request-body.ts';
import { createApi } from '../src/app.ts';

const request = () => new Request('https://steer.example/health/live');
const streamed = (stream: ReadableStream<Uint8Array>, signal?: AbortSignal) => new Request('https://steer.example/', {
  method: 'POST', body: stream, duplex: 'half', ...(signal ? { signal } : {}),
} as RequestInit);

test('admission caps actual concurrent work, releases success/failure and never trusts forwarding identity', async () => {
  let resolve: (response: Response) => void = () => {}; let calls = 0;
  const guarded = createRequestBoundary(async () => { calls++; return new Promise<Response>((done) => { resolve = done; }); }, { maxInFlight: 1 });
  const pending = guarded(request());
  const rejected = await guarded(new Request(request(), { headers: { 'x-forwarded-for': 'different-client', 'x-steer-role': 'admin' } }));
  assert.equal(rejected.status, 503); assert.equal(rejected.headers.get('retry-after'), '1'); assert.equal(calls, 1);
  resolve(new Response('ok')); assert.equal((await pending).status, 200);
  const next = guarded(request()); assert.equal(calls, 2); resolve(new Response('ok')); await next;
  const failing = createRequestBoundary(() => { throw new Error('private-provider-secret'); }, { maxInFlight: 1 });
  for (let i = 0; i < 2; i++) { const result = await failing(request()); assert.equal(result.status, 500); assert.ok(!(await result.text()).includes('private-provider-secret')); }
});

test('bounded global token bucket refills using monotonic time, denies bad clocks and validates startup', async () => {
  let time = 0; let calls = 0;
  const guarded = createRequestBoundary(() => { calls++; return new Response('ok'); }, { burst: 2, requestsPerSecond: 2, clock: () => time });
  assert.equal((await guarded(request())).status, 200); assert.equal((await guarded(request())).status, 200);
  assert.equal((await guarded(request())).status, 429); assert.equal(calls, 2);
  time = 500; assert.equal((await guarded(request())).status, 200);
  time = 400; assert.equal((await guarded(request())).status, 503);
  time = NaN; assert.equal((await guarded(request())).status, 503);
  for (const options of [{ burst: 0 }, { maxInFlight: 0 }, { requestsPerSecond: Infinity }, { clock: () => NaN }]) {
    assert.throws(() => createRequestBoundary(() => new Response(), options), /Invalid request limit/);
  }
});

test('oversized URL/headers and aborted requests never dispatch and return nonreflecting no-store errors', async () => {
  let calls = 0; const guarded = createRequestBoundary(() => { calls++; return new Response(); });
  const controller = new AbortController(); controller.abort();
  for (const [input, status] of [
    [new Request(`https://steer.example/?secret=${'x'.repeat(8192)}`), 414],
    [new Request(request(), { headers: { cookie: 's'.repeat(16384) } }), 431],
    [new Request(request(), { signal: controller.signal }), 408],
  ] as const) {
    const result = await guarded(input); assert.equal(result.status, status); assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.ok(!(await result.text()).includes('secret='));
  }
  assert.equal(calls, 0);
});

test('body reader bounds actual bytes, zero-body mutations and stalled cancellation', async () => {
  assert.equal(new TextDecoder().decode(await readRequestBody(new Request('https://steer.example/', { method: 'POST', body: 'ok' }), 2)), 'ok');
  const neverCancel = () => new Promise<void>(() => {});
  const oversized = streamed(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(3)); }, cancel: neverCancel }));
  await assert.rejects(readRequestBody(oversized, 2, 100), (error: unknown) => error instanceof RequestBodyError && error.reason === 'size');
  const nonempty = streamed(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(1)); }, cancel: neverCancel }));
  await assert.rejects(readRequestBody(nonempty, 0, 100), (error: unknown) => error instanceof RequestBodyError && error.reason === 'size');
  const stalled = streamed(new ReadableStream({ cancel: neverCancel }));
  await assert.rejects(readRequestBody(stalled, 10, 20), (error: unknown) => error instanceof RequestBodyError && error.reason === 'timeout');
});

test('body reader handles disconnect and endless empty chunks without unbounded buffering or timer starvation', async () => {
  const controller = new AbortController();
  const pending = readRequestBody(streamed(new ReadableStream(), controller.signal), 10, 100);
  controller.abort(); await assert.rejects(pending, (error: unknown) => error instanceof RequestBodyError && error.reason === 'aborted');
  const empty = streamed(new ReadableStream({ pull(c) { c.enqueue(new Uint8Array()); } }));
  await assert.rejects(readRequestBody(empty, 0, 20), (error: unknown) => error instanceof RequestBodyError && ['size', 'timeout'].includes(error.reason));
});

test('authenticated API reports a disconnected body as 408 instead of invoking a tool', async () => {
  const controller = new AbortController(); controller.abort();
  const app = createApi({ authenticate: async () => ({}) });
  const result = await app.fetch(new Request('https://steer.example/v1/tools/session.context', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: controller.signal,
  }));
  assert.equal(result.status, 408);
});
