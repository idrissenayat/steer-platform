import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { transformWithOxc } from 'vite';
import { createElement, act } from 'react';
import { JSDOM } from 'jsdom';
import { readBriefLocation } from '../app/brief-location.ts';

test('actual scope component shows evidence, exact Brief links, gaps and errors without writing or losing source', async () => {
  const require = createRequire(import.meta.url);
  let code = (await transformWithOxc(readFileSync(new URL('../app/intent-scope-review.tsx', import.meta.url), 'utf8'), '/synthetic/intent-scope-review.tsx', { jsx: { runtime: 'automatic' } })).code;
  for (const name of ['react', 'react/jsx-runtime']) for (const quote of ['"', "'"]) code = code.replaceAll(`${quote}${name}${quote}`, JSON.stringify(pathToFileURL(require.resolve(name)).href));
  for (const name of ['intent-scope-reader', 'brief-location']) for (const quote of ['"', "'"]) code = code.replaceAll(`${quote}./${name}${quote}`, JSON.stringify(new URL(`../app/${name}.ts`, import.meta.url).href));
  const Component = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default;
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://steer.example', pretendToBeVisual: true });
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT', 'fetch'];
  const saved = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) Object.defineProperty(globalThis, key, { configurable: true, value });
  let mode = 'matches', fingerprint = 'b'.repeat(64); const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push(url); const input = JSON.parse(init.body);
    if (mode === 'failure') return Response.json({ private: 'never display this' }, { status: 503 });
    return Response.json({ organizationId: 'org', repository: 'github:1', kind: 'intent-overlap-candidates', method: 'lexical-candidates/v1',
      sourceDigest: createHash('sha256').update(JSON.stringify(input.intent)).digest('hex'), catalogFingerprint: 'a'.repeat(64), reviewFingerprint: fingerprint,
      semanticReviewComplete: false, authoritativeClearance: false,
      coverage: { scope: 'configured-projections-only', catalogCount: 3, inspectedIntents: 2, inspectedDocuments: 1, candidateCount: mode === 'empty' ? 0 : 1,
        resultsTruncated: false, scanLimited: true, gaps: [{ path: 'items/0201-other/SPEC.md', reason: 'not-projected' }] },
      candidates: mode === 'empty' ? [] : [{ briefPath: 'items/0200-booking/BRIEF.md', briefContentDigest: 'c'.repeat(64), path: 'items/0200-booking/SPEC.md',
        document: 'SPEC', revision: 'd'.repeat(40), contentDigest: 'e'.repeat(64), signal: 'shared-terms', queryTermCoverage: .6, matchedTerms: ['patients', 'book', 'appointments'],
        excerpt: '<script>unsafe()</script> Patients book appointments online.' }],
    });
  };
  const { createRoot } = await import('react-dom/client'); const root = createRoot(document.getElementById('root'));
  const props = { organizationId: 'org', repository: 'github:1', intent: 'Patients book appointments online', expiresAt: new Date(Date.now() + 60000).toISOString() };
  const render = async (change = {}) => act(async () => root.render(createElement(Component, { ...props, ...change })));
  const click = async () => act(async () => { document.querySelector('button').click(); await new Promise(resolve => setTimeout(resolve, 20)); });
  const change = async (selector, value) => act(async () => {
    const element = document.querySelector(selector);
    const prototype = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLSelectElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
    element.dispatchEvent(new window.Event(element.tagName === 'TEXTAREA' ? 'input' : 'change', { bubbles: true }));
  });
  const confirm = async () => act(async () => { document.querySelector('.intent-scope-choice button').click(); await new Promise(resolve => setTimeout(resolve, 20)); });
  try {
    await render(); assert.equal(requests.length, 0); await click();
    assert.match(document.body.textContent, /Possible matches/); assert.match(document.body.textContent, /coverage is incomplete/);
    assert.equal(document.activeElement.tagName, 'H4'); assert.equal(document.querySelector('script'), null);
    const link = readBriefLocation(document.querySelector('a').getAttribute('href'));
    assert.equal(link.kind, 'brief'); assert.equal(link.selection.contentDigest, 'c'.repeat(64)); assert.equal(link.selection.path, 'items/0200-booking/BRIEF.md');
    assert.equal(document.querySelector('#scope-direction').value, '');
    await change('#scope-direction', 'new-linked'); await change('#scope-target', 'items/0200-booking/BRIEF.md');
    assert.equal(document.querySelector('.intent-scope-choice button').disabled, true);
    await change('#scope-reason', 'Reminder work is separate from booking.'); await confirm();
    assert.match(document.body.textContent, /Direction checked against/); assert.equal(requests.length, 2);
    assert.match(document.body.textContent, /drafting and saving do not yet use it/);
    await change('#scope-reason', 'Changed explanation'); assert.doesNotMatch(document.body.textContent, /Direction checked against/);
    fingerprint = 'f'.repeat(64); await confirm();
    assert.match(document.querySelector('[role="alert"]').textContent, /Scope changed/);
    assert.equal(document.querySelector('#scope-reason').value, 'Changed explanation');
    assert.doesNotMatch(document.body.textContent, /Direction checked against/);
    await confirm(); assert.match(document.body.textContent, /Direction checked against/);
    await render({ intent: 'Changed intent' }); assert.equal(document.querySelector('blockquote'), null);
    assert.doesNotMatch(document.body.textContent, /Direction checked against/);
    mode = 'empty'; await click(); assert.match(document.body.textContent, /No word matches found/); assert.match(document.body.textContent, /not a decision/);
    mode = 'failure'; await click(); assert.equal(document.querySelector('blockquote'), null); assert.match(document.querySelector('[role="alert"]').textContent, /could not be checked/);
    assert.doesNotMatch(document.body.textContent, /never display/); assert.equal(window.localStorage.length, 0);
    assert.ok(requests.every(url => url.endsWith('/v1/tools/intent.overlap.check')));
    await render({ repository: null }); assert.equal(document.querySelector('button').disabled, true); assert.match(document.body.textContent, /not configured/);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const key of keys) { if (saved[key]) Object.defineProperty(globalThis, key, saved[key]); else delete globalThis[key]; }
  }
});
