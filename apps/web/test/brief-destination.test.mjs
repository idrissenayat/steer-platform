import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { transformWithOxc } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDestinationController, destinationMessages } from '../app/brief-destination-client.ts';

const base = Date.parse('2026-09-07T00:00:00.000Z'), expiry = new Date(base + 60000).toISOString();
const output = { kind: 'brief-destination-observation', organizationId: 'org', repository: 'github:52', branch: 'codex/fixture',
  paths: ['items/0149-demo/BRIEF.md'], observedHead: 'a'.repeat(40), observedAt: new Date(base).toISOString(), writeAuthorized: false, gateVerified: false };
function setup(transport = async () => Response.json(output), expiresAt = expiry) {
  let time = base; const states = [], timers = [], calls = [];
  const input = { organizationId: 'org' };
  const owner = createDestinationController(input, expiresAt, 'https://steer.example', (state) => states.push(state), {
    now: () => time,
    fetch: async (url, init) => { calls.push({ url, init }); return transport(url, init); },
    schedule: (callback, delay) => { const timer = { callback, delay, cancelled: false }; timers.push(timer); return () => { timer.cancelled = true; }; },
  });
  input.organizationId = 'changed';
  return { owner, states, timers, calls, clock: (next) => { time = next; } };
}

test('destination display is manual, fixed-origin, scoped and read-only with a bounded clear timer', async () => {
  const f = setup(); assert.equal(f.calls.length, 0); assert.equal(f.states.length, 0);
  await f.owner.load(); assert.deepEqual(f.states, [{ kind: 'loading' }, { kind: 'observed', destination: output }]);
  assert.equal(f.calls.length, 1); const { url, init } = f.calls[0];
  assert.equal(url, 'https://steer.example/v1/tools/intent.brief.destination');
  assert.deepEqual(JSON.parse(init.body), { organizationId: 'org' });
  assert.equal(init.credentials, 'same-origin'); assert.equal(init.cache, 'no-store'); assert.equal(init.redirect, 'error');
  assert.equal(f.timers[0].delay, 15000); f.clock(base + 15000); f.timers[0].callback();
  assert.deepEqual(f.states.at(-1), { kind: 'stale' }); assert.equal(f.calls.length, 1); f.owner.close();
});
test('wrong scope, malformed heads, authority claims, duplicate paths, stale/future timestamps and extra fields suppress details', async () => {
  for (const value of [null, { ...output, organizationId: 'foreign' }, { ...output, observedHead: 'bad' },
    { ...output, writeAuthorized: true }, { ...output, gateVerified: true }, { ...output, token: 'private' },
    { ...output, paths: [...output.paths, ...output.paths] }, { ...output, paths: ['intent/0001/BRIEF.md'] },
    { ...output, observedAt: new Date(base - 15000).toISOString() }, { ...output, observedAt: new Date(base + 1).toISOString() }]) {
    const f = setup(async () => Response.json(value)); await f.owner.load();
    assert.deepEqual(f.states, [{ kind: 'loading' }, { kind: 'unavailable' }]); assert.equal(f.timers.length, 0); f.owner.close();
  }
});
test('failed refresh discards prior details and does not leak server errors or trigger retries', async () => {
  let succeeds = true; const f = setup(async () => succeeds ? Response.json(output) : new Response('private token', { status: 503 }));
  await f.owner.load(); succeeds = false; await f.owner.load();
  assert.equal(f.timers[0].cancelled, true); assert.deepEqual(f.states.at(-2), { kind: 'loading' });
  assert.deepEqual(f.states.at(-1), { kind: 'unavailable' }); assert.equal(f.calls.length, 2);
  assert.ok(!JSON.stringify(f.states).includes('private')); f.owner.close();
});
test('all unavailable access and transport conditions return only generic display state', async () => {
  for (const status of [401, 403, 404, 422, 500, 503]) {
    const f = setup(async () => new Response('private', { status })); await f.owner.load();
    assert.deepEqual(f.states.at(-1), { kind: 'unavailable' }); f.owner.close();
  }
  for (const transport of [async () => { throw new Error('private'); }, async () => new Response('<html>private</html>', { status: 200 })]) {
    const f = setup(transport); await f.owner.load(); assert.deepEqual(f.states.at(-1), { kind: 'unavailable' }); f.owner.close();
  }
});
test('invalidate, expire and unmount suppress late responses even when fetch ignores abort', async () => {
  for (const action of ['invalidate', 'expire', 'close']) {
    let release; const pending = new Promise((resolve) => { release = resolve; });
    const f = setup(async () => { await pending; return Response.json(output); });
    const work = f.owner.load(); f.owner[action](); await work;
    const before = structuredClone(f.states); release(); await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(f.states, before); assert.ok(f.calls[0].init.signal.aborted);
    assert.ok(!f.states.some((state) => state.kind === 'observed')); assert.equal(f.timers.length, 0); f.owner.close();
  }
});
test('overlapping refreshes fence older responses and callbacks', async () => {
  let release, reads = 0; const pending = new Promise((resolve) => { release = resolve; });
  const next = { ...output, observedHead: 'b'.repeat(40) };
  const f = setup(async () => { if (++reads === 1) { await pending; return Response.json(output); } return Response.json(next); });
  const old = f.owner.load(); await f.owner.load(); await old; release(); await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(f.states.at(-1), { kind: 'observed', destination: next });
  const timer = f.timers[0]; await f.owner.load(); timer.callback();
  assert.equal(f.states.at(-1).kind, 'observed'); assert.equal(timer.cancelled, true); f.owner.close();
});
test('session expiry clips display lifetime and denies reads; invalid and backwards clocks fail closed', async () => {
  const short = setup(undefined, new Date(base + 1000).toISOString()); await short.owner.load();
  assert.equal(short.timers[0].delay, 1000); short.clock(base + 1000); short.timers[0].callback();
  assert.deepEqual(short.states.at(-1), { kind: 'expired' }); await short.owner.load(); assert.equal(short.calls.length, 1); short.owner.close();
  for (const time of [base - 1, Number.NaN, base + 60000]) {
    let f; f = setup(async () => { f.clock(time); return Response.json(output); });
    await f.owner.load(); assert.deepEqual(f.states.at(-1), { kind: 'expired' }); f.owner.close();
  }
  assert.throws(() => setup(undefined, 'invalid'));
});
test('closing clears timers and prevents future requests or stale-state emissions', async () => {
  const f = setup(); await f.owner.load(); f.owner.close(); const before = structuredClone(f.states);
  await f.owner.load(); f.owner.invalidate(); f.timers[0].callback();
  assert.deepEqual(f.states, before); assert.equal(f.calls.length, 1); assert.equal(f.timers[0].cancelled, true);
  assert.match(destinationMessages.observed, /branch may change/); assert.match(destinationMessages.unavailable, /Refresh access/);
});

test('actual destination component server-renders an accessible non-writing initial state without running effects', async () => {
  const require = createRequire(import.meta.url);
  const source = readFileSync(new URL('../app/brief-destination.tsx', import.meta.url), 'utf8');
  const transformed = await transformWithOxc(source, '/synthetic/brief-destination.tsx', { jsx: { runtime: 'automatic' } });
  const compiled = transformed.code
    .replaceAll('"react/jsx-runtime"', JSON.stringify(pathToFileURL(require.resolve('react/jsx-runtime')).href))
    .replaceAll("'react'", JSON.stringify(pathToFileURL(require.resolve('react')).href))
    .replaceAll('"react"', JSON.stringify(pathToFileURL(require.resolve('react')).href))
    .replaceAll("'./brief-destination-client'", JSON.stringify(new URL('../app/brief-destination-client.ts', import.meta.url).href))
    .replaceAll('"./brief-destination-client"', JSON.stringify(new URL('../app/brief-destination-client.ts', import.meta.url).href));
  const { default: Component } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  const html = renderToStaticMarkup(createElement(Component, { organizationId: 'org', expiresAt: expiry }));
  assert.match(html, /aria-labelledby="destination-title"/); assert.match(html, /role="status"/);
  assert.match(html, /type="button"[^>]*disabled=""/); assert.match(html, /Check destination/);
  assert.match(html, /Saving is not enabled/); assert.doesNotMatch(html, /<form|<input|<select|github:52/);
  const author = readFileSync(new URL('../app/brief-author.tsx', import.meta.url), 'utf8');
  assert.match(author, /<BriefDestination key=\{`\$\{organizationId\}:\$\{subject\}:\$\{expiresAt\}`\}/);
});
