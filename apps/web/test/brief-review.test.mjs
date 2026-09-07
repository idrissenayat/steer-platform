import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { transformWithOxc } from 'vite';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { briefReviewBinding, createBriefSaveStatusClient, saveStatusMessages } from '../app/brief-review-client.ts';
import { createReadTransport } from '../app/read-transport.ts';

const base = Date.parse('2026-09-07T00:00:00.000Z'), expiry = new Date(base + 60000).toISOString();
const markdown = '# Brief: Synthetic review\n';
const preview = { kind: 'brief-preview', organizationId: 'org', subject: 'synthetic', templateVersion: 'steer-brief/v1', markdown,
  contentDigest: createHash('sha256').update(markdown).digest('hex'), missing: ['problem'], saved: false, confirmed: false, executionAuthorized: false };
const destination = { kind: 'brief-destination-observation', organizationId: 'org', repository: 'github:52', branch: 'codex/fixture',
  paths: ['items/0155-demo/BRIEF.md', 'items/0155-other/BRIEF.md'], observedHead: 'a'.repeat(40), observedAt: new Date(base).toISOString(), writeAuthorized: false, gateVerified: false };
const scope = { organizationId: 'org', repository: 'github:52', branch: 'codex/fixture', path: destination.paths[0] };
const operation = '12345678-1234-4123-8123-123456789012';
const reference = { ...scope, subject: 'synthetic', idempotencyKey: operation };
const receipt = { ...reference, outcome: 'committed', expectedHead: 'a'.repeat(40), revision: 'b'.repeat(40), blobSha: 'c'.repeat(40), requestDigest: 'd'.repeat(64), contentDigest: preview.contentDigest };
const output = result => ({ result, gateSigned: false });

function client(transport = async () => Response.json(output({ ...reference, outcome: 'unknown' }))) {
  let time = base; const states = [], calls = []; const input = { ...scope };
  const owner = createBriefSaveStatusClient(input, reference.subject, expiry, 'https://steer.example', state => states.push(state), {
    now: () => time, fetch: async (url, init) => { calls.push({ url, init }); return transport(url, init); },
  });
  input.organizationId = 'foreign';
  return { owner, states, calls, clock: next => { time = next; } };
}

test('local review is immutable and binds content, target, observation and session without granting authority', () => {
  const binding = briefReviewBinding(preview, destination, scope.path, expiry, base);
  assert.equal(Object.isFrozen(binding), true);
  assert.equal(binding.contentDigest, preview.contentDigest); assert.equal(binding.expectedHead, destination.observedHead);
  assert.equal(binding.subject, reference.subject); assert.equal(binding.path, scope.path);
  assert.equal('idempotencyKey' in binding, false); assert.equal('writeAuthorized' in binding, false);
  for (const [nextPreview, nextDestination, path, end] of [
    [{ ...preview, contentDigest: 'e'.repeat(64) }, destination, scope.path, expiry],
    [{ ...preview, subject: 'other' }, destination, scope.path, expiry],
    [preview, { ...destination, observedHead: 'b'.repeat(40) }, scope.path, expiry],
    [preview, { ...destination, observedAt: new Date(base - 1).toISOString() }, scope.path, expiry],
    [preview, { ...destination, repository: 'github:53' }, scope.path, expiry],
    [preview, { ...destination, branch: 'codex/other' }, scope.path, expiry],
    [preview, destination, destination.paths[1], expiry],
    [preview, destination, scope.path, new Date(base + 30000).toISOString()],
  ]) assert.notDeepEqual(briefReviewBinding(nextPreview, nextDestination, path, end, base), binding);
});
test('invalid or expired destination review cannot bind, including future observations and foreign organizations', () => {
  for (const time of [base - 1, base + 15000, Number.NaN, Number.POSITIVE_INFINITY]) assert.throws(() => briefReviewBinding(preview, destination, scope.path, expiry, time));
  assert.throws(() => briefReviewBinding(preview, destination, scope.path, new Date(base).toISOString(), base));
  assert.throws(() => briefReviewBinding(preview, destination, 'intent/0001/BRIEF.md', expiry, base));
  assert.throws(() => briefReviewBinding(preview, { ...destination, organizationId: 'foreign' }, scope.path, expiry, base));
  assert.throws(() => briefReviewBinding(preview, { ...destination, writeAuthorized: true }, scope.path, expiry, base));
});
test('all status outcomes use one exact same-origin read and never generate an operation, save or retry', async () => {
  for (const result of [{ ...reference, outcome: 'not-found' }, { ...reference, outcome: 'unknown' },
    { ...reference, outcome: 'pending', requestDigest: 'd'.repeat(64) }, { ...reference, outcome: 'conflict' }, receipt]) {
    const f = client(async () => Response.json(output(result))); assert.equal(f.calls.length, 0);
    await f.owner.check(operation); assert.deepEqual(f.states.at(-1), { kind: 'observed', value: output(result) });
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].url, 'https://steer.example/v1/tools/intent.brief.save.status');
    assert.deepEqual(JSON.parse(f.calls[0].init.body), { ...scope, idempotencyKey: operation });
    assert.equal(f.calls[0].init.credentials, 'same-origin'); assert.equal(f.calls[0].init.redirect, 'error'); assert.equal(f.calls[0].init.cache, 'no-store');
    assert.ok(saveStatusMessages[result.outcome]); f.owner.close();
  }
  const reader = createReadTransport('https://steer.example', async () => { throw new Error('Must not run'); });
  await assert.rejects(reader.request('intent.brief.save', {})); reader.close();
});
test('foreign receipts, gate claims, malformed results and private errors clear prior output without retries', async () => {
  for (const result of [output({ ...receipt, subject: 'other' }), output({ ...receipt, repository: 'github:53' }),
    output({ ...receipt, branch: 'codex/other' }), output({ ...receipt, path: destination.paths[1] }),
    output({ ...receipt, organizationId: 'other' }), output({ ...receipt, idempotencyKey: '22345678-1234-4123-8123-123456789012' }),
    { ...output(receipt), gateSigned: true }, output({ ...receipt, revision: 'invalid' }), output({ ...receipt, privateKey: 'secret' }), null]) {
    let valid = true; const f = client(async () => Response.json(valid ? output(receipt) : result));
    await f.owner.check(operation); valid = false; await f.owner.check(operation);
    assert.deepEqual(f.states.slice(-2), [{ kind: 'loading' }, { kind: 'unavailable' }]); assert.equal(f.calls.length, 2); f.owner.close();
  }
  for (const status of [401, 403, 422, 429, 500, 503]) {
    const f = client(async () => new Response('private response', { status })); await f.owner.check(operation);
    assert.deepEqual(f.states.at(-1), { kind: 'unavailable' }); assert.equal(f.calls.length, 1); f.owner.close();
  }
});
test('invalid operation IDs and expired displays cannot read; completion with invalid time suppresses receipts', async () => {
  const f = client(); await f.owner.check('invalid'); assert.equal(f.calls.length, 0); assert.deepEqual(f.states.at(-1), { kind: 'unavailable' });
  f.clock(base + 60000); await f.owner.check(operation); assert.equal(f.calls.length, 0); assert.deepEqual(f.states.at(-1), { kind: 'expired' }); f.owner.close();
  for (const time of [base - 1, base + 60000, Number.NaN]) {
    let late; late = client(async () => { late.clock(time); return Response.json(output(receipt)); });
    await late.owner.check(operation); assert.deepEqual(late.states.at(-1), { kind: 'expired' }); late.owner.close();
  }
});
test('editing, unmount and overlapping checks suppress stale replies even when transport ignores abort', async () => {
  for (const action of ['clear', 'close']) {
    let release; const pending = new Promise(resolve => { release = resolve; });
    const f = client(async () => { await pending; return Response.json(output(receipt)); });
    const work = f.owner.check(operation); f.owner[action](); await work;
    const before = structuredClone(f.states); release(); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(f.states, before); assert.ok(f.calls[0].init.signal.aborted); f.owner.close();
  }
  let release, reads = 0; const pending = new Promise(resolve => { release = resolve; });
  const f = client(async () => { if (++reads === 1) { await pending; return Response.json(output(receipt)); } return Response.json(output({ ...reference, outcome: 'unknown' })); });
  const old = f.owner.check(operation); await f.owner.check(operation); await old; release(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.states.at(-1).value.result.outcome, 'unknown'); f.owner.close(); await f.owner.check(operation); assert.equal(f.calls.length, 2);
});

async function component() {
  const require = createRequire(import.meta.url);
  const source = readFileSync(new URL('../app/brief-review.tsx', import.meta.url), 'utf8');
  let compiled = (await transformWithOxc(source, '/synthetic/brief-review.tsx', { jsx: { runtime: 'automatic' } })).code;
  for (const specifier of ['react', 'react/jsx-runtime', '@steer/tool-registry/brief-contracts']) {
    for (const quote of ['"', "'"]) compiled = compiled.replaceAll(`${quote}${specifier}${quote}`, JSON.stringify(pathToFileURL(require.resolve(specifier)).href));
  }
  for (const quote of ['"', "'"]) compiled = compiled.replaceAll(`${quote}./brief-review-client${quote}`, JSON.stringify(new URL('../app/brief-review-client.ts', import.meta.url).href));
  return (await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)).default;
}
test('actual review component initially renders no selected path, confirmation or enabled write control', async () => {
  const Component = await component();
  const html = renderToStaticMarkup(createElement(Component, { preview, destination, expiresAt: expiry }));
  assert.match(html, /aria-labelledby="brief-review-title"/); assert.match(html, /<fieldset disabled=""/);
  assert.match(html, /Not reviewed for this destination/); assert.match(html, /Live saving is disabled/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Save Brief/); assert.doesNotMatch(html, /type="checkbox"|save-operation-receipt/);
});
test('actual interactive review clears on path changes and hiding without any request', async () => {
  const Component = await component(), dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://steer.example', pretendToBeVisual: true });
  const saved = Object.fromEntries(['window', 'document', 'IS_REACT_ACT_ENVIRONMENT', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
  const calls = []; globalThis.fetch = async (url, init) => { calls.push({ url, init }); return Response.json(output(receipt)); };
  const root = createRoot(document.getElementById('root'));
  const current = { ...destination, observedAt: new Date().toISOString() }, end = new Date(Date.now() + 60000).toISOString();
  const event = name => new dom.window.Event(name, { bubbles: true });
  const choose = async path => { await act(async () => { const select = document.querySelector('select'); select.value = path; select.dispatchEvent(event('change')); }); };
  try {
    await act(async () => root.render(createElement(Component, { preview, destination: current, expiresAt: end })));
    await choose(scope.path); assert.equal(calls.length, 0);
    await act(async () => document.querySelector('input[type="checkbox"]').click());
    assert.match(document.querySelector('[data-testid="brief-review-status"]').textContent, /^Reviewed locally/);
    assert.equal([...document.querySelectorAll('button')].find(node => node.textContent.startsWith('Save Brief')).disabled, true);
    await choose(destination.paths[1]); assert.equal(document.querySelector('input[type="checkbox"]').checked, false);
    await choose(scope.path);
    assert.equal(document.querySelector('[data-testid="save-operation-receipt"]'), null);
    await act(async () => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(event('visibilitychange')); });
    assert.equal(document.querySelector('select').value, ''); assert.equal(document.querySelector('input[type="checkbox"]'), null);
    assert.equal(calls.length, 0);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of Object.entries(saved)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});
