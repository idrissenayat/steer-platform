import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { transformWithOxc } from 'vite';
import { createElement, act } from 'react';
import { JSDOM } from 'jsdom';
import { candidateReadFixture } from '../../../packages/tool-registry/test/candidate-read-fixture.ts';
import { candidateSaveStatusFragment } from '../app/candidate-save-status-client.ts';
import { candidateFragment } from '../app/candidate-location.ts';

async function components() {
  const require = createRequire(import.meta.url), local = name => new URL(`../app/${name}.ts`, import.meta.url).href;
  const compile = async (name, replacements = {}) => {
    let code = (await transformWithOxc(readFileSync(new URL(`../app/${name}.tsx`, import.meta.url), 'utf8'), `/synthetic/${name}.tsx`, { jsx: { runtime: 'automatic' } })).code;
    for (const name of ['react', 'react/jsx-runtime', 'react-markdown']) replacements[name] = pathToFileURL(require.resolve(name)).href;
    for (const [specifier, value] of Object.entries(replacements)) for (const quote of ['"', "'"]) code = code.replaceAll(`${quote}${specifier}${quote}`, JSON.stringify(value));
    return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  };
  const markdown = await compile('brief-markdown', { './brief-reading-order': local('brief-reading-order') });
  const Bundle = (await import(await compile('candidate-bundle', { './candidate-reader': local('candidate-reader'), './candidate-location': local('candidate-location'), './brief-markdown': markdown }))).default;
  const Status = (await import(await compile('candidate-save-status', { './candidate-save-status-client': local('candidate-save-status-client'), './candidate-location': local('candidate-location') }))).default;
  return { Bundle, Status };
}
test('actual status-to-bundle UI keeps uncertain outcomes inert and opens only the verified original saved commit', async () => {
  const { Bundle, Status } = await components(), f = await candidateReadFixture();
  const input = { organizationId: 'org', productId: 'product', repository: 'github:52', branch: 'codex/fixture', draftId: '00000000-0000-4000-8000-000000000001',
    draftRevision: 1, operationId: '00000000-0000-4000-8000-000000000002', inputDigest: 'a'.repeat(64) };
  const base = { ...input, kind: 'steer-candidate-save-status/v1', retryAuthorized: false, gateSigned: false, executionAuthorized: false };
  const dom = new JSDOM('<!doctype html><html lang="en"><title>STEER synthetic test</title><main><label for="draft">Current draft</label><textarea id="draft">Unsent intent</textarea><div id="root"></div></main></html>', { url: 'https://steer.test', pretendToBeVisual: true });
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT', 'fetch'];
  const saved = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true }))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  let mode = 'unknown', release; const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, input: JSON.parse(init.body) });
    if (url.endsWith('/intent.candidate.read')) { assert.deepEqual(JSON.parse(init.body), f.reference); return Response.json(f.output); }
    assert.ok(url.endsWith('/intent.candidate.save.status')); assert.deepEqual(JSON.parse(init.body), input);
    if (mode === 'denied') return Response.json({ error: 'PRIVATE permission detail' }, { status: 403 });
    const output = { ...base, outcome: mode, saveVerified: false, ...(mode === 'not-found' ? { observedHead: 'e'.repeat(40) } : {}) };
    if (mode === 'committed' || mode === 'deferred') {
      const receipt = { ...base, outcome: 'committed', saveVerified: true, reference: f.reference, expectedHead: 'e'.repeat(40), pointerDigest: 'b'.repeat(64), confirmationDigest: 'c'.repeat(64) };
      return mode === 'deferred' ? new Promise(resolve => { release = () => resolve(Response.json(receipt)); }) : Response.json(receipt);
    }
    return Response.json(output);
  };
  const { createRoot } = await import('react-dom/client'), root = createRoot(document.getElementById('root'));
  const props = { organizationId: 'org', repository: 'github:52', expiresAt: new Date(Date.now() + 600000).toISOString() };
  const tick = () => new Promise(resolve => setTimeout(resolve, 20));
  const click = async label => act(async () => { const button = [...document.querySelectorAll('button')].find(button => button.textContent === label); assert.ok(button, label); button.click(); await tick(); });
  const navigate = async fragment => act(async () => { window.history.replaceState(null, '', `/${fragment}`); window.dispatchEvent(new window.HashChangeEvent('hashchange')); await tick(); });
  try {
    await act(async () => { root.render(createElement('div', {}, createElement(Status, props), createElement(Bundle, props))); await tick(); }); assert.equal(calls.length, 0);
    await navigate(candidateSaveStatusFragment(input)); assert.match(document.body.textContent, /outcome is still unknown/);
    assert.equal(document.activeElement.id, 'candidate-save-status-title'); assert.equal(document.querySelector('a'), null);
    for (const next of ['not-found', 'conflict']) {
      mode = next; await click('Recheck original save'); assert.equal(document.querySelector('a'), null); assert.equal(document.querySelector('article'), null);
    }
    assert.ok([...document.querySelectorAll('button')].every(button => !/submit|retry|save now/i.test(button.textContent)));
    mode = 'committed'; await click('Recheck original save'); const link = document.querySelector('a');
    assert.equal(link.getAttribute('href'), candidateFragment(f.reference));
    const accessibility = await (await import('axe-core')).default.run(document.getElementById('root'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, rules: { 'color-contrast': { enabled: false } } });
    assert.deepEqual(accessibility.violations.map(v => v.id), []);
    await act(async () => { link.click(); await tick(); });
    for (let n = 0; n < 50 && !document.querySelector('article'); n++) await act(tick);
    assert.match(document.querySelector('article').textContent, /Saved Brief/); assert.equal(document.querySelector('.candidate-save-status'), null);
    assert.equal(document.getElementById('draft').value, 'Unsent intent'); assert.equal(calls.filter(call => call.url.endsWith('/intent.candidate.read')).length, 1);
    await navigate(candidateSaveStatusFragment(input)); mode = 'denied'; await click('Recheck original save');
    assert.equal(document.querySelector('a'), null); assert.doesNotMatch(document.body.textContent, /PRIVATE|Git confirmed/);
    mode = 'committed'; await click('Recheck original save');
    await act(async () => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new window.Event('visibilitychange')); await tick(); });
    assert.equal(document.querySelector('a'), null); const count = calls.length; await click('Recheck original save'); assert.equal(calls.length, count);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false }); mode = 'deferred'; await click('Recheck original save');
    assert.ok(release); await click('Close save status'); await act(async () => { release(); await tick(); });
    assert.equal(document.querySelector('.candidate-save-status, a'), null); assert.equal(document.getElementById('draft').value, 'Unsent intent');
    assert.equal(window.localStorage.length, 0); assert.equal(window.sessionStorage.length, 0);
  } finally { await act(async () => root.unmount()); dom.window.close(); for (const key of keys) { if (saved[key]) Object.defineProperty(globalThis, key, saved[key]); else delete globalThis[key]; } }
});
