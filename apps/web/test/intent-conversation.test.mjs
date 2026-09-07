import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { transformWithOxc } from 'vite';
import { createElement, act } from 'react';
import { JSDOM } from 'jsdom';

test('real conversation component sends free text, follows up and displays three inert candidates without saving', async () => {
  const require = createRequire(import.meta.url);
  const compile = async (name, replacements) => {
    let code = (await transformWithOxc(readFileSync(new URL(`../app/${name}.tsx`, import.meta.url), 'utf8'), `/synthetic/${name}.tsx`, { jsx: { runtime: 'automatic' } })).code;
    for (const specifier of ['react', 'react/jsx-runtime', 'react-markdown']) for (const quote of ['"', "'"]) code = code.replaceAll(`${quote}${specifier}${quote}`, JSON.stringify(pathToFileURL(require.resolve(specifier)).href));
    for (const [specifier, target] of Object.entries(replacements)) for (const quote of ['"', "'"]) code = code.replaceAll(`${quote}${specifier}${quote}`, JSON.stringify(target));
    return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  };
  const markdown = await compile('brief-markdown', { './brief-reading-order': new URL('../app/brief-reading-order.ts', import.meta.url).href });
  const scopeReview = await compile('intent-scope-review', { './intent-scope-reader': new URL('../app/intent-scope-reader.ts', import.meta.url).href, './brief-location': new URL('../app/brief-location.ts', import.meta.url).href });
  const Component = (await import(await compile('intent-conversation', { './agent-transport': new URL('../app/agent-transport.ts', import.meta.url).href, './brief-markdown': markdown, './intent-scope-review': scopeReview }))).default;
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://steer.example', pretendToBeVisual: true });
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT', 'fetch'];
  const saved = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) Object.defineProperty(globalThis, key, { configurable: true, value });
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, input: JSON.parse(init.body) });
    return Response.json({ kind: 'intent-agent-candidate', organizationId: 'org', subject: 'human', sourceDigest: 'a'.repeat(64), configurationRevision: 'test', saved: false, gateSigned: false, executionAuthorized: false,
      ...(requests.length === 1 ? { message: 'One question.', questions: ['Who books appointments?'], documents: null }
        : { message: 'Your drafts are ready to review.', questions: [], documents: { brief: '# Brief\nBooking for patients', spec: '# Spec\nAC-01 book a slot', exam: '# Exam\nNOT RUN\n<script>unsafe()</script>\n![image](https://outside.invalid/image)' } }) });
  };
  const { createRoot } = await import('react-dom/client'); const root = createRoot(document.getElementById('root'));
  const props = { organizationId: 'org', subject: 'human', expiresAt: new Date(Date.now() + 60000).toISOString(), enabled: true };
  const set = async (id, text) => act(async () => {
    const element = document.getElementById(id);
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(element, text);
    element.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  const submit = async () => act(async () => document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
  try {
    await act(async () => root.render(createElement(Component, props)));
    assert.equal(document.querySelectorAll('textarea').length, 1);
    assert.doesNotMatch(document.body.textContent, /8 questions|Open UX preview/);
    await set('agent-intent', 'I want a patient booking service.'); await submit();
    assert.match(document.body.textContent, /Who books appointments/);
    await set('agent-clarification', 'Patients book for themselves.'); await submit();
    assert.equal(requests.length, 2); assert.equal(requests[1].input.clarification, 'Patients book for themselves.');
    assert.ok(requests.every(item => item.url.endsWith('/v1/tools/intent.agent.develop')));
    for (const name of ['BRIEF.md', 'SPEC.md', 'EXAM.md']) {
      const button = [...document.querySelectorAll('button')].find(button => button.textContent === name); assert.ok(button);
      await act(async () => button.click()); assert.equal(button.getAttribute('aria-pressed'), 'true');
    }
    assert.match(document.body.textContent, /NOT RUN/); assert.match(document.body.textContent, /not saved to GitHub/);
    assert.equal(document.querySelector('script, img'), null); assert.equal(window.localStorage.length, 0);
    await act(async () => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new dom.window.Event('visibilitychange')); });
    assert.equal(document.querySelector('textarea'), null); assert.doesNotMatch(document.body.textContent, /Booking for patients/);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const key of keys) { if (saved[key]) Object.defineProperty(globalThis, key, saved[key]); else delete globalThis[key]; }
  }
});
