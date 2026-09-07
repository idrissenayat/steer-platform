import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { transformWithOxc } from 'vite';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';

async function component(entry = 'default') {
  const require = createRequire(import.meta.url);
  let compiled = (await transformWithOxc(readFileSync(new URL('../app/learn-hub.tsx', import.meta.url), 'utf8'),
    '/synthetic/learn-hub.tsx', { jsx: { runtime: 'automatic' } })).code;
  for (const specifier of ['react', 'react/jsx-runtime']) for (const quote of ['"', "'"]) compiled = compiled.replaceAll(`${quote}${specifier}${quote}`, JSON.stringify(pathToFileURL(require.resolve(specifier)).href));
  for (const quote of ['"', "'"]) compiled = compiled.replaceAll(`${quote}./learn-reader${quote}`, JSON.stringify(new URL('../app/learn-reader.ts', import.meta.url).href));
  return (await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`))[entry];
}

test('actual Learn component renders inert canon, makes no requests and permanently clears on invalid time or expiry', async () => {
  const Component = await component();
  const corpus = { tag: 'test', frameworkVersion: 'test', pages: [{ id: 'source', title: 'Source', summary: 'Synthetic canon', path: 'kit/canon/example.md', sourcePath: 'example.md',
    contentDigest: 'a'.repeat(64), raw: '<script>unsafe()</script>', sections: [{ id: 'section', title: 'Section', blocks: [{ kind: 'paragraph', text: '<script>unsafe()</script><img src="https://outside.invalid/x">' }] }] }] };
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://steer.example' });
  const keys = ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT', 'fetch'];
  const saved = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const originalNow = Date.now; let now = 1000, tick;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
  globalThis.fetch = () => assert.fail('Learn must never request data');
  dom.window.setInterval = callback => { tick = callback; return 1; };
  dom.window.clearInterval = () => {};
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  Date.now = () => now;
  const root = createRoot(document.getElementById('root'));
  try {
    for (const invalid of [10000, 999, Number.NaN, Number.POSITIVE_INFINITY]) {
      now = 1000;
      await act(async () => root.render(createElement(Component, { key: String(invalid), corpus, expiresAt: new Date(10000).toISOString() })));
      assert.equal(document.querySelector('article'), null);
      await act(async () => document.querySelector('button').click());
      assert.ok(document.querySelector('article')); assert.equal(document.querySelector('script, img'), null);
      assert.ok(document.querySelector('article').textContent.includes('<script>unsafe()</script>'));
      await act(async () => document.querySelector('.learn-navigation a').click());
      assert.equal(document.activeElement?.tagName, 'H4');
      await act(async () => document.querySelector('article button').click());
      assert.equal(document.activeElement?.textContent, 'Open guide');
      await act(async () => document.querySelector('button').click());
      await act(async () => window.dispatchEvent(new dom.window.Event('pagehide')));
      assert.equal(document.querySelector('article'), null);
      await act(async () => document.querySelector('button').click());
      now = invalid; await act(async () => tick());
      assert.equal(document.querySelector('article'), null); assert.equal(document.querySelector('button').disabled, true);
      now = 1000; await act(async () => tick());
      assert.equal(document.querySelector('button').disabled, true, 'clock repair does not reopen expired state');
    }
  } finally {
    await act(async () => root.unmount()); Date.now = originalNow; dom.window.close();
    for (const key of keys) { if (saved[key]) Object.defineProperty(globalThis, key, saved[key]); else delete globalThis[key]; }
  }
});

test('local kit reader needs no invented session deadline, makes no requests and clears reading state on hiding', async () => {
  const Component = await component('LocalLearnHub');
  const corpus = { tag: 'test', frameworkVersion: 'test', pages: [{ id: 'source', title: 'Public kit', summary: 'Synthetic public canon', path: 'kit/canon/example.md', sourcePath: 'example.md', contentDigest: 'a'.repeat(64), raw: 'Exact source', sections: [{ id: 'section', title: 'Direction', blocks: [{ kind: 'paragraph', text: '<img src="https://outside.invalid/x">' }] }] }] };
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://steer.example' });
  const keys = ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT', 'fetch'];
  const saved = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const originalNow = Date.now;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
  globalThis.fetch = () => assert.fail('Local guide must not request data');
  dom.window.setInterval = () => assert.fail('Public kit must not manufacture a session clock');
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  Date.now = () => Number.NaN;
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(createElement(Component, { corpus })));
    await act(async () => document.querySelector('button').click());
    assert.ok(document.querySelector('article')); assert.equal(document.querySelector('img'), null);
    assert.match(document.body.textContent, /Local reference only/);
    await act(async () => document.querySelector('.learn-navigation a').click());
    assert.equal(document.activeElement.tagName, 'H4');
    await act(async () => window.dispatchEvent(new dom.window.Event('pagehide')));
    assert.equal(document.querySelector('article'), null); assert.equal(document.querySelector('button').disabled, false);
    await act(async () => document.querySelector('button').click());
    assert.ok(document.querySelector('article'));
    await act(async () => document.querySelector('article button').click());
    assert.equal(document.activeElement.textContent, 'Open guide');
  } finally {
    await act(async () => root.unmount()); Date.now = originalNow; dom.window.close();
    for (const key of keys) { if (saved[key]) Object.defineProperty(globalThis, key, saved[key]); else delete globalThis[key]; }
  }
});
