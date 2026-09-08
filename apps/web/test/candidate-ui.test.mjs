import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { transformWithOxc } from 'vite';
import { createElement, act } from 'react';
import { JSDOM } from 'jsdom';
import { candidateReadFixture } from '../../../packages/tool-registry/test/candidate-read-fixture.ts';
import { candidateFragment } from '../app/candidate-location.ts';

async function component() {
  const require = createRequire(import.meta.url), local = name => new URL(`../app/${name}.ts`, import.meta.url).href;
  const compile = async (name, replacements = {}) => {
    let code = (await transformWithOxc(readFileSync(new URL(`../app/${name}.tsx`, import.meta.url), 'utf8'), `/synthetic/${name}.tsx`, { jsx: { runtime: 'automatic' } })).code;
    for (const name of ['react', 'react/jsx-runtime', 'react-markdown']) replacements[name] = pathToFileURL(require.resolve(name)).href;
    for (const [specifier, value] of Object.entries(replacements)) for (const quote of ['"', "'"]) code = code.replaceAll(`${quote}${specifier}${quote}`, JSON.stringify(value));
    return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  };
  const markdown = await compile('brief-markdown', { './brief-reading-order': local('brief-reading-order') });
  return (await import(await compile('candidate-bundle', { './candidate-reader': local('candidate-reader'), './candidate-location': local('candidate-location'), './brief-markdown': markdown }))).default;
}

test('actual saved-bundle UI reads all documents safely and clears on denial, hide, navigation and expiry without changing a draft', async () => {
  const Component = await component(), f = await candidateReadFixture();
  const dom = new JSDOM('<!doctype html><html lang="en"><title>STEER synthetic test</title><main><label for="current-draft">Current draft</label><textarea id="current-draft">Unsent human text</textarea><div id="root"></div></main></html>',
    { url: 'https://steer.test', pretendToBeVisual: true });
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT', 'fetch'];
  const saved = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true }))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  const calls = []; let deny = false, deferred = false, release;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, input: JSON.parse(init.body) });
    assert.equal(url, 'https://steer.test/v1/tools/intent.candidate.read');
    if (deferred) return new Promise(resolve => { release = resolve; });
    return deny ? Response.json({ detail: 'PRIVATE permission error' }, { status: 403 }) : Response.json(f.output);
  };
  const { createRoot } = await import('react-dom/client'), root = createRoot(document.getElementById('root'));
  const props = { organizationId: 'org', repository: 'github:52', expiresAt: new Date(Date.now() + 600000).toISOString() };
  const tick = () => new Promise(resolve => setTimeout(resolve, 20));
  const click = async label => act(async () => {
    const button = [...document.querySelectorAll('button')].find(button => button.textContent === label); assert.ok(button, label); button.click(); await tick();
  });
  const navigate = async fragment => act(async () => {
    window.history.replaceState(null, '', `/${fragment}`); window.dispatchEvent(new window.HashChangeEvent('hashchange')); await tick();
  });
  try {
    await act(async () => { root.render(createElement(Component, props)); await tick(); }); assert.equal(calls.length, 0);
    await navigate(candidateFragment(f.reference));
    for (let n = 0; n < 50 && !document.querySelector('article'); n++) await act(tick);
    assert.match(document.querySelector('article').textContent, /Saved Brief/); assert.equal(document.activeElement.id, 'candidate-title');
    await click('SPEC'); assert.match(document.querySelector('article').textContent, /Saved Spec/);
    await click('EXAM'); assert.match(document.querySelector('article').textContent, /NOT RUN/);
    assert.equal(document.querySelector('script, img, article a'), null);
    assert.equal(document.querySelector('pre').textContent, f.output.documents.exam);
    assert.equal(document.getElementById('current-draft').value, 'Unsent human text');
    assert.deepEqual(calls.map(call => call.input), [f.reference]);
    const axe = (await import('axe-core')).default;
    const accessibility = await axe.run(document.getElementById('root'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, rules: { 'color-contrast': { enabled: false } } });
    assert.deepEqual(accessibility.violations.map(v => v.id), []);
    deny = true; await click('Reopen exact saved revision'); assert.equal(document.querySelector('article'), null);
    assert.doesNotMatch(document.body.textContent, /PRIVATE|Saved Spec|NOT RUN/);
    deny = false; await click('Reopen exact saved revision');
    for (let n = 0; n < 50 && !document.querySelector('article'); n++) await act(tick);
    await act(async () => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new window.Event('visibilitychange')); await tick(); });
    assert.equal(document.querySelector('article'), null); const beforeHidden = calls.length;
    await click('Reopen exact saved revision'); assert.equal(calls.length, beforeHidden);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    deferred = true; await click('Reopen exact saved revision'); assert.ok(release);
    await click('Close saved bundle'); assert.equal(document.querySelector('.candidate-bundle'), null);
    await act(async () => { release(Response.json(f.output)); await tick(); }); assert.equal(document.querySelector('article'), null);
    deferred = false; await navigate(candidateFragment(f.reference));
    for (let n = 0; n < 50 && !document.querySelector('article'); n++) await act(tick);
    await act(async () => { root.render(createElement(Component, { ...props, expiresAt: new Date(Date.now() - 1000).toISOString() })); await tick(); });
    assert.equal(document.querySelector('article'), null); assert.match(document.body.textContent, /expired|Refresh access|refresh access/);
    assert.equal(document.getElementById('current-draft').value, 'Unsent human text');
    assert.equal(window.localStorage.length, 0); assert.equal(window.sessionStorage.length, 0);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const key of keys) { if (saved[key]) Object.defineProperty(globalThis, key, saved[key]); else delete globalThis[key]; }
  }
});
