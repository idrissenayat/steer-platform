import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer, connect } from 'node:net';
import { connect as connectTls } from 'node:tls';
import { startLocalIdentityListener } from '../src/identity-listener.ts';
import { createLocalTlsHarness, reserveLocalPort, localHttpsRequest } from './local-tls-harness.ts';

let tls: Awaited<ReturnType<typeof createLocalTlsHarness>>;
before(async () => { tls = await createLocalTlsHarness(); });
after(async () => { await tls?.close(); });
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; };

test('local listener rejects nonlocal/canonical configuration and invalid TLS, cleaning owned application once', async () => {
  for (const publicOrigin of ['https://remote.example:3000', 'http://localhost:3000', 'https://localhost', 'https://localhost:3000/path']) {
    let stops = 0;
    await assert.rejects(startLocalIdentityListener({ publicOrigin, tls }, { fetch: async () => new Response(), shutdown: async () => { stops++; } }),
      /^Error: Local identity listener could not be initialized\.$/);
    assert.equal(stops, 1);
  }
  let stops = 0;
  await assert.rejects(startLocalIdentityListener({ publicOrigin: `https://localhost:${await reserveLocalPort()}`, tls: { key: 'invalid-private-value', cert: tls.cert } },
    { fetch: async () => new Response(), shutdown: async () => { stops++; } }), /^Error: Local identity listener could not be initialized\.$/);
  assert.equal(stops, 1);
});

test('actual HTTPS listener requires trusted TLS, rejects Host aliases and bounds raw headers', async () => {
  const origin = `https://localhost:${await reserveLocalPort()}`; let calls = 0;
  const listener = await startLocalIdentityListener({ publicOrigin: origin, tls }, {
    fetch: async (request) => { calls++; assert.equal(new URL(request.url).origin, origin); return new Response('synthetic'); }, shutdown: async () => {},
  });
  try {
    assert.equal((await localHttpsRequest(origin, tls.cert, '/', { headers: { 'x-forwarded-host': 'other.example', 'x-forwarded-proto': 'http' } })).status, 200);
    assert.equal((await localHttpsRequest(origin, tls.cert, '/', { headers: { host: 'other.example' } })).status, 400);
    assert.equal((await localHttpsRequest(origin, tls.cert, '/', { headers: { 'x-large': 'x'.repeat(17000) } })).status, 431);
    await assert.rejects(localHttpsRequest(origin, undefined)); assert.equal(calls, 1);
  } finally { await listener.shutdown(); }
  assert.deepEqual(listener.status(), { state: 'stopped', activeRequests: 0, forcedConnections: false, listening: false });
  await assert.rejects(localHttpsRequest(origin, tls.cert));
});

test('bind collision fails safely and confirms owned application cleanup', async () => {
  const occupied = createServer(); await new Promise<void>((resolve) => occupied.listen(0, '127.0.0.1', resolve));
  const address = occupied.address(); assert.ok(address && typeof address !== 'string'); let stops = 0;
  try {
    await assert.rejects(startLocalIdentityListener({ publicOrigin: `https://localhost:${address.port}`, tls },
      { fetch: async () => new Response(), shutdown: async () => { stops++; } }), /^Error: Local identity listener could not be initialized\.$/);
    assert.equal(stops, 1); assert.equal(occupied.listening, true);
  } finally { await new Promise<void>((resolve) => occupied.close(() => resolve())); }
});

test('actual TLS handshake and HTTP header stalls are bounded without application dispatch', async () => {
  const port = await reserveLocalPort(); const origin = `https://localhost:${port}`;
  let calls = 0;
  const listener = await startLocalIdentityListener({ publicOrigin: origin, tls }, {
    fetch: async () => { calls++; return new Response(); }, shutdown: async () => {},
  });
  try {
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const started = performance.now(); const socket = connect(port, '127.0.0.1');
        const timer = setTimeout(() => { socket.destroy(); reject(new Error('Synthetic handshake deadline failed.')); }, 8500);
        socket.once('error', () => {});
        socket.once('close', () => { clearTimeout(timer); try { assert.ok(performance.now() - started >= 4900); resolve(); } catch (error) { reject(error); } });
      }),
      new Promise<void>((resolve, reject) => {
        const socket = connectTls({ host: '127.0.0.1', port, ca: tls.cert, servername: 'localhost', rejectUnauthorized: true }); let received = '';
        const timer = setTimeout(() => { socket.destroy(); reject(new Error('Synthetic header deadline failed.')); }, 8500);
        socket.once('secureConnect', () => socket.write('GET / HTTP/1.1\r\nHost:'));
        socket.on('data', (chunk: Buffer) => { received += chunk.toString(); });
        socket.once('error', () => {});
        socket.once('close', () => { clearTimeout(timer); try { assert.match(received, /^HTTP\/1\.1 408 /); resolve(); } catch (error) { reject(error); } });
      }),
    ]);
    assert.equal(calls, 0);
  } finally { await listener.shutdown(); }
});

test('listener shutdown closes admission immediately and awaits both actual requests and resources', async () => {
  const origin = `https://localhost:${await reserveLocalPort()}`;
  const entered = deferred(); const work = deferred(); const resources = deferred(); let stops = 0;
  const listener = await startLocalIdentityListener({ publicOrigin: origin, tls }, {
    fetch: async () => { entered.resolve(); await work.promise; return new Response('finished'); },
    shutdown: async () => { stops++; await resources.promise; },
  });
  const pending = localHttpsRequest(origin, tls.cert); await entered.promise;
  const stop = listener.shutdown(); assert.equal(listener.shutdown(), stop);
  try {
    await Promise.resolve(); assert.equal(stops, 1); assert.equal(listener.status().state, 'draining');
    assert.equal(listener.status().listening, false); assert.equal(listener.status().activeRequests, 1);
    await assert.rejects(localHttpsRequest(origin, tls.cert));
    work.resolve(); assert.equal((await pending).status, 200);
    assert.equal(listener.status().state, 'draining'); resources.resolve(); await stop;
    assert.equal(listener.status().state, 'stopped'); assert.equal(listener.status().activeRequests, 0);
  } finally { work.resolve(); resources.resolve(); await stop; }
});

test('resource shutdown failure remains failed and generic, without retries or reopened admission', async () => {
  let stops = 0; const origin = `https://localhost:${await reserveLocalPort()}`;
  const listener = await startLocalIdentityListener({ publicOrigin: origin, tls }, { fetch: async () => new Response(),
    shutdown: async () => { stops++; throw new Error('private-storage-failure'); } });
  const stop = listener.shutdown(); await assert.rejects(stop, /^Error: Local identity listener shutdown could not be confirmed\.$/);
  assert.equal(listener.shutdown(), stop); assert.equal(stops, 1); assert.equal(listener.status().state, 'failed');
  assert.equal(listener.status().listening, false);
});

test('five-second socket drain aborts actual request but does not claim completion while application ignores it', async () => {
  const origin = `https://localhost:${await reserveLocalPort()}`;
  const entered = deferred(); const work = deferred(); const aborted = deferred();
  const listener = await startLocalIdentityListener({ publicOrigin: origin, tls }, { fetch: async (request) => {
    request.signal.addEventListener('abort', () => aborted.resolve(), { once: true });
    entered.resolve(); await work.promise; return new Response('finished');
  }, shutdown: async () => {} });
  const pending = localHttpsRequest(origin, tls.cert).then(() => 'unexpected-success', () => 'disconnected');
  await entered.promise; const started = performance.now(); const stop = listener.shutdown();
  try {
    await aborted.promise; assert.equal(await pending, 'disconnected');
    assert.ok(performance.now() - started >= 4900); assert.ok(performance.now() - started < 9000);
    assert.equal(listener.status().forcedConnections, true); assert.equal(listener.status().state, 'draining');
    assert.equal(listener.status().activeRequests, 1);
    work.resolve(); await stop; assert.equal(listener.status().state, 'stopped');
  } finally { work.resolve(); await stop; }
});
