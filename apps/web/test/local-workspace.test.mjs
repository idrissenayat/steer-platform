import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { transformWithOxc } from 'vite';
import { createElement, act } from 'react';
import { JSDOM } from 'jsdom';
import { emptyAuthorAnswers } from '../app/brief-author-client.ts';
import { saveLocalDraft } from '../app/local-drafts.ts';

test('actual local workspace opts in, reopens inert content, focuses corrections, validates saves and keeps sign-in separate without requests', async () => {
  const require = createRequire(import.meta.url);
  let compiled = (await transformWithOxc(readFileSync(new URL('../app/local-workspace.tsx', import.meta.url), 'utf8'), '/synthetic/local-workspace.tsx', { jsx: { runtime: 'automatic' } })).code;
  for (const specifier of ['react', 'react/jsx-runtime']) for (const quote of ['"', "'"]) compiled = compiled.replaceAll(`${quote}${specifier}${quote}`, JSON.stringify(pathToFileURL(require.resolve(specifier)).href));
  for (const name of ['brief-author-client', 'local-drafts']) for (const quote of ['"', "'"]) compiled = compiled.replaceAll(`${quote}./${name}${quote}`, JSON.stringify(new URL(`../app/${name}.ts`, import.meta.url).href));
  const Component = (await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)).default;
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://steer.example' });
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT', 'fetch'];
  const saved = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: dom.window.HTMLElement });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
  globalThis.fetch = () => assert.fail('Local UX must not request data or write to a provider');
  // JSDOM has no native top layer; real-browser QA covers inertness and Tab trapping.
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  const click = async name => {
    const button = [...document.querySelectorAll('button')].find(element => element.textContent === name);
    assert.ok(button, name); await act(async () => { button.focus(); button.click(); });
  };
  try {
    const draft = { version: 1, id: 'local-11111111-1111-4111-8111-111111111111', updatedAt: '2026-09-07T12:00:00.000Z', answers: { ...emptyAuthorAnswers(), title: 'Sample', problem: '<script>unsafe()</script><img src="https://outside.invalid/x">' } };
    saveLocalDraft(window.localStorage, draft, null);
    await act(async () => root.render(createElement(Component, { guide: createElement('div', {}, 'Canonical guide slot') }, createElement('div', {}, 'Separate live workspace'))));
    assert.match(document.body.textContent, /Separate live workspace/); assert.doesNotMatch(document.body.textContent, /Sample/);
    await click('Open UX preview'); assert.doesNotMatch(document.body.textContent, /Separate live workspace/);
    await click('Open Brief →'); assert.match(document.body.textContent, /<script>unsafe/);
    assert.equal(document.querySelector('script, img'), null);
    await click('Remove this local draft'); assert.ok(document.querySelector('dialog[open]'));
    assert.equal(document.activeElement.textContent, 'Keep draft');
    await click('Keep draft'); assert.equal(document.querySelector('dialog'), null);
    assert.equal(document.activeElement.textContent, 'Remove this local draft'); assert.equal(window.localStorage.length, 1);
    await click('Edit What is happening now?'); assert.equal(document.activeElement.id, 'local-problem');
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(document.getElementById('local-problem'), 'Unsaved correction');
      document.getElementById('local-problem').dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    assert.match(document.querySelector('[role="status"]').textContent, /Unsaved changes/);
    await click('Consult the operating guide'); assert.match(document.body.textContent, /Canonical guide slot/);
    assert.equal(document.querySelector('textarea'), null);
    await click('Return to Brief'); assert.equal(document.getElementById('local-problem').value, 'Unsaved correction');
    assert.equal(window.localStorage.length, 1);
    await click('Review Brief'); assert.equal(document.activeElement.tagName, 'H1');
    await click('+ New intent'); assert.ok(document.querySelector('dialog[open]'));
    assert.equal(document.activeElement.textContent, 'Keep editing');
    await act(async () => document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })));
    assert.equal(document.activeElement.textContent, 'Discard unsaved edits');
    await act(async () => document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
    assert.equal(document.activeElement.textContent, 'Keep editing');
    await act(async () => document.querySelector('dialog').dispatchEvent(new dom.window.Event('cancel', { cancelable: true })));
    assert.equal(document.querySelector('dialog'), null); assert.equal(document.activeElement.textContent, '+ New intent');
    assert.match(document.querySelector('article').textContent, /Unsaved correction/);
    await click('+ New intent'); await click('Discard unsaved edits'); await click('Save on this browser');
    assert.match(document.querySelector('[role="alert"]').textContent, /Write your intent/);
    assert.equal(document.activeElement.id, 'local-intent'); assert.equal(window.localStorage.length, 1);
    assert.equal(document.querySelectorAll('textarea').length, 1);
    assert.equal(document.querySelector('input'), null);
    assert.doesNotMatch(document.body.textContent, /of 8|fields to clarify/);
    const freeText = 'Storage failure test\n\nMy unstructured ideas. <script>literal</script>\n' + 'Keep every word. '.repeat(1000);
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(document.getElementById('local-intent'), freeText);
      document.getElementById('local-intent').dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    await click('Consult the operating guide'); await click('Return to Brief');
    assert.equal(document.getElementById('local-intent').value, freeText);
    assert.equal(document.querySelector('[role="alert"]'), null);
    const setItem = dom.window.Storage.prototype.setItem;
    try {
      dom.window.Storage.prototype.setItem = () => { throw new Error('Quota exceeded'); };
      await click('Save on this browser');
      assert.match(document.querySelector('[role="alert"]').textContent, /Could not save/);
      assert.equal(document.getElementById('local-intent').value, freeText);
      assert.equal(window.localStorage.length, 1);
    } finally { dom.window.Storage.prototype.setItem = setItem; }
    await click('Save on this browser'); assert.equal(window.localStorage.length, 2);
    assert.match(document.querySelector('[role="status"]').textContent, /Saved on this browser only/);
    const stored = Array.from({ length: window.localStorage.length }, (_, i) => JSON.parse(window.localStorage.getItem(window.localStorage.key(i)))).find(item => item.version === 2);
    assert.equal(stored.intent, freeText); assert.equal(stored.answers.title, 'Storage failure test');
    await click('Review Brief'); assert.match(document.querySelector('article').textContent, /My unstructured ideas/);
    assert.equal(document.querySelector('script'), null);
    await click('Return to sign-in workspace'); assert.match(document.body.textContent, /Separate live workspace/);
    await click('Open UX preview'); await click('Storage failure test');
    await click('Edit your intent'); assert.equal(document.getElementById('local-intent').value, freeText);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const key of keys) { if (saved[key]) Object.defineProperty(globalThis, key, saved[key]); else delete globalThis[key]; }
  }
});
