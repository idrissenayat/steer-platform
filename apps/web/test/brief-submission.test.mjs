import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { transformWithOxc } from 'vite';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';

async function component() {
  const require = createRequire(import.meta.url);
  let compiled = (await transformWithOxc(readFileSync(new URL('../app/brief-submission.tsx', import.meta.url), 'utf8'),
    '/synthetic/brief-submission.tsx', { jsx: { runtime: 'automatic' } })).code;
  for (const specifier of ['react', 'react/jsx-runtime']) for (const quote of ['"', "'"]) compiled = compiled.replaceAll(`${quote}${specifier}${quote}`, JSON.stringify(pathToFileURL(require.resolve(specifier)).href));
  for (const name of ['brief-submit-client', 'brief-location', 'brief-review-client']) for (const quote of ['"', "'"]) compiled = compiled.replaceAll(`${quote}./${name}${quote}`, JSON.stringify(new URL(`../app/${name}.ts`, import.meta.url).href));
  return (await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)).default;
}
test('actual submission owner retains one operation across draft changes, clears on hiding and cannot resubmit afterward', async () => {
  const Component = await component(), dom = new JSDOM('<div id="root"></div>', { url: 'https://steer.example', pretendToBeVisual: true });
  const previous = Object.fromEntries(['window', 'document', 'IS_REACT_ACT_ENVIRONMENT', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window }); Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
  const calls = []; globalThis.fetch = async (url, options) => {
    const input = JSON.parse(options.body); calls.push({ url, input });
    return Response.json({ gateSigned: false, result: { organizationId: 'org', repository: input.repository, branch: input.branch, path: input.path,
      idempotencyKey: input.idempotencyKey, subject: 'human', outcome: 'unknown' } });
  };
  const root = createRoot(document.getElementById('root')), now = Date.now(), expiresAt = new Date(now + 60000).toISOString(), markdown = '# Synthetic\n';
  const input = { path: 'items/0167-test/BRIEF.md', draft: { title: 'Synthetic', problem: 'A', outcome: 'B', users: ['C'], systems: [], constraints: [], openQuestions: [], successMeasure: 'D' },
    preview: { kind: 'brief-preview', organizationId: 'org', subject: 'human', templateVersion: 'steer-brief/v1', markdown,
      contentDigest: createHash('sha256').update(markdown).digest('hex'), missing: [], saved: false, confirmed: false, executionAuthorized: false },
    destination: { kind: 'brief-destination-observation', organizationId: 'org', repository: 'github:1', branch: 'main', paths: ['items/0167-test/BRIEF.md'],
      observedHead: 'a'.repeat(40), observedAt: new Date(now).toISOString(), writeAuthorized: false, gateVerified: false } };
  const render = value => createElement(Component, { organizationId: 'org', subject: 'human', expiresAt,
    render: (submit, attempted) => createElement('button', { 'data-test-submit': true, disabled: attempted, onClick: () => submit(value) }, 'Submit fixture') });
  const hide = async hidden => act(async () => { Object.defineProperty(document, 'hidden', { configurable: true, value: hidden }); document.dispatchEvent(new dom.window.Event('visibilitychange')); });
  try {
    await act(async () => root.render(render(input)));
    await hide(true); assert.equal(document.querySelector('.brief-submission'), null); await hide(false); // No phantom operation.
    await act(async () => { document.querySelector('[data-test-submit]').click(); document.querySelector('[data-test-submit]').click(); await new Promise(resolve => setTimeout(resolve, 30)); });
    assert.equal(calls.length, 1); const key = document.querySelector('[data-testid="submission-operation"]').textContent;
    assert.equal(document.querySelector('[data-test-submit]').disabled, true);
    await act(async () => root.render(render({ ...input, draft: { ...input.draft, title: 'Later edit' } })));
    assert.equal(document.querySelector('[data-testid="submission-operation"]').textContent, key); assert.equal(calls.length, 1);
    await hide(true); assert.equal(document.querySelector('[data-testid="submission-operation"]'), null);
    await hide(false); assert.equal(document.querySelector('[data-test-submit]').disabled, true); assert.equal(calls.length, 1);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});
