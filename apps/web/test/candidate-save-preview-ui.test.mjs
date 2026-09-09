import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { transformWithOxc } from 'vite';
import { createElement, act } from 'react';
import { JSDOM } from 'jsdom';
import { candidateSavePreviewFixture } from '../../../packages/tool-registry/test/candidate-save-preview.fixture.ts';
import { randomUUID } from 'node:crypto';

async function fixture() {
  const f = await candidateSavePreviewFixture(), require = createRequire(import.meta.url);
  let code = (await transformWithOxc(readFileSync(new URL('../app/candidate-save-preview.tsx', import.meta.url), 'utf8'), '/synthetic/candidate-save-preview.tsx', { jsx: { runtime: 'automatic' } })).code;
  for (const specifier of [...code.matchAll(/from\s+(["'])([^"']+)\1/g)].map(m => m[2])) {
    const target = specifier.startsWith('./') ? new URL(`../app/${specifier.slice(2)}.ts`, import.meta.url).href : pathToFileURL(require.resolve(specifier)).href;
    for (const quote of ['"', "'"]) code = code.replaceAll(`${quote}${specifier}${quote}`, JSON.stringify(target));
  }
  const Component = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default;
  const dom = new JSDOM('<!doctype html><html lang="en"><title>STEER package test</title><main id="root"></main></html>', { url: 'https://steer.test', pretendToBeVisual: true });
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT', 'fetch'], saved = Object.fromEntries(keys.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) Object.defineProperty(globalThis, key, { configurable: true, value });
  const latest = { revision: 1, revisionDigest: f.input.revisionDigest, scopeInputDigest: f.input.scopeInputDigest };
  const page = { organizationId: f.scope.organizationId, productId: f.scope.productId, repository: f.scope.repository, draftId: f.input.draftId,
    cursor: null, kind: 'steer-run-discovery/v1', observedAt: new Date().toISOString(), useUntil: new Date(Date.now() + 300000).toISOString(), latest,
    entries: [{ kind: 'development', source: latest, ...f.previewInput.generation }], nextCursor: null,
    scope: 'current-owner-records-configuration-all-preserved-revisions', order: 'revision-type-id-descending-not-chronological',
    contentLoaded: false, executionAuthorized: false, savedToGit: false, gateSigned: false };
  const state = { calls: [], commands: [], output: f.prepared.output, page, denied: false, wait: null, confirmation: 'prepared' };
  const saveReference = { organizationId: f.scope.organizationId, productId: f.scope.productId, repository: f.scope.repository, branch: f.scope.branch,
    draftId: f.input.draftId, draftRevision: 1, operationId: randomUUID(), inputDigest: 'a'.repeat(64) };
  globalThis.fetch = async (url, init) => {
    state.calls.push(String(url)); assert.equal(init.credentials, 'same-origin'); assert.equal(init.cache, 'no-store');
    assert.doesNotMatch(init.body, /Human-edited Exam|Current corrected Brief|serviceCommitter|savedToGit|saveConfirmed/);
    if (String(url).endsWith('/intent.runs.discover')) return Response.json(state.page);
    if (String(url).endsWith('/intent.candidate.save.prepare')) {
      const input = JSON.parse(init.body); state.commands.push(input);
      assert.deepEqual(input, { organizationId: f.scope.organizationId, preview: f.previewInput,
        previewDigest: f.prepared.output.previewDigest, confirmation: f.prepared.output.proposedConfirmation, confirm: true });
      if (state.wait) await state.wait;
      if (state.confirmation === 'lost') throw new Error('Lost acknowledgement');
      return Response.json({ kind: 'steer-candidate-save-prepare/v1', input, outcome: state.confirmation,
        reference: ['prepared', 'unknown'].includes(state.confirmation) ? saveReference : null,
        originalPreserved: state.confirmation === 'prepared', readyToRequestStart: state.confirmation === 'prepared', savedToGit: false, executionAuthorized: false, gateSigned: false });
    }
    assert.ok(String(url).endsWith('/intent.candidate.save.preview')); assert.deepEqual(JSON.parse(init.body), f.previewInput);
    if (state.wait) await state.wait;
    return state.denied ? Response.json({ PRIVATE: 'denied' }, { status: 403 }) : Response.json(state.output);
  };
  const props = { review: f.output, source: { input: f.sourceInput, content: f.content }, identity: 'human', expiresAt: new Date(Date.now() + 600000).toISOString() };
  const { createRoot } = await import('react-dom/client'), root = createRoot(document.getElementById('root'));
  const tick = () => new Promise(r => setTimeout(r, 20));
  const render = async (patch = {}) => act(async () => { root.render(createElement(Component, { ...props, ...patch })); await tick(); });
  const button = text => [...document.querySelectorAll('button')].find(b => b.textContent === text);
  const click = async text => act(async () => { assert.equal(button(text).disabled, false); button(text).click(); await tick(); });
  const until = async predicate => { for (let i = 0; i < 60 && !predicate(); i++) await act(async () => { await tick(); }); assert.ok(predicate()); };
  const choose = async () => {
    await click('Find drafting runs for this package'); await until(() => document.querySelector('select'));
    await act(async () => { const select = document.querySelector('select'); select.value = f.previewInput.generation.operationId; select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      const input = document.querySelector('input'); Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, f.previewInput.itemId);
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); await tick(); });
  };
  await render();
  return { f, state, props, render, choose, click, until, button, dom,
    cleanup: async () => { await act(async () => root.unmount()); dom.window.close(); for (const k of keys) { if (saved[k]) Object.defineProperty(globalThis, k, saved[k]); else delete globalThis[k]; } } };
}
test('actual package component selects a retained run and previews exact documents without confirmation, regeneration or save', async () => {
  const t = await fixture();
  try {
    assert.equal(t.state.calls.length, 0); assert.equal(t.button('Preview exact package').disabled, true);
    await t.choose(); await t.click('Preview exact package'); await t.until(() => document.body.textContent.includes('Exact package preview — not saved'));
    assert.match(document.body.textContent, /All document bytes match/); assert.match(document.body.textContent, /Confirming preserves this exact package/);
    assert.equal(t.state.calls.length, 2); assert.equal(document.activeElement.textContent, 'Exact package preview — not saved');
    assert.equal(t.button('Confirm this exact package').disabled, false); assert.equal(t.state.commands.length, 0);
    const require = createRequire(import.meta.url), path = require.resolve('axe-core'); delete require.cache[path];
    const audit = await require('axe-core').run(document.getElementById('root'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, rules: { 'color-contrast': { enabled: false } } });
    assert.deepEqual(audit.violations.map(v => v.id), []);
  } finally { await t.cleanup(); }
});
test('actual package UI confirms explicitly, recovers an identical lost command, retains its original status link, and never starts a save', async () => {
  const t = await fixture();
  try {
    await t.choose(); await t.click('Preview exact package'); await t.until(() => t.button('Confirm this exact package'));
    t.state.confirmation = 'unknown'; await t.click('Confirm this exact package'); await t.until(() => t.button('Recover this exact confirmation'));
    assert.equal(t.button('Preview exact package').disabled, true);
    const href = document.querySelector('a').href; assert.match(href, /#candidate-save=/);
    t.state.confirmation = 'lost'; await t.click('Recover this exact confirmation'); await t.until(() => t.button('Recover this exact confirmation'));
    assert.equal(document.querySelector('a').href, href);
    t.state.confirmation = 'prepared'; await t.click('Recover this exact confirmation'); await t.until(() => document.body.textContent.includes('Exact original preserved and read back'));
    assert.match(document.body.textContent, /Not saved to GitHub/); assert.equal(t.button('Confirm this exact package'), undefined);
    assert.equal(t.state.commands.length, 3); assert.deepEqual(t.state.commands[0], t.state.commands[1]); assert.deepEqual(t.state.commands[0], t.state.commands[2]);
    assert.ok(t.state.calls.every(url => /intent\.(runs\.discover|candidate\.save\.(preview|prepare))$/.test(url)));
    await t.render({ identity: 'other-human' }); assert.equal(document.querySelector('a'), null);
    assert.doesNotMatch(document.body.textContent, /Exact original preserved/);
  } finally { await t.cleanup(); }
});
test('a late confirmation acknowledgement cannot survive identity change or become a current success', async () => {
  const t = await fixture(); let release;
  try {
    await t.choose(); await t.click('Preview exact package'); await t.until(() => t.button('Confirm this exact package'));
    t.state.wait = new Promise(r => { release = r; }); await t.click('Confirm this exact package');
    await t.render({ identity: 'other-human' }); await act(async () => { release(); await new Promise(r => setTimeout(r, 30)); });
    assert.equal(document.querySelector('a'), null); assert.doesNotMatch(document.body.textContent, /Exact original preserved/);
  } finally { release?.(); await t.cleanup(); }
});
test('package UI conceals stale/denied proposals and drops late results after identity or visibility changes', async () => {
  const t = await fixture(); let release;
  try {
    await t.choose(); t.state.wait = new Promise(r => { release = r; }); await t.click('Preview exact package');
    await t.render({ identity: 'different-human' }); await act(async () => { release(); await new Promise(r => setTimeout(r, 30)); });
    assert.doesNotMatch(document.body.textContent, /Exact package preview — not saved/);
    t.state.wait = null; await t.render(); await t.choose(); t.state.output = { ...t.f.prepared.output, manifestDigest: 'f'.repeat(64) };
    await t.click('Preview exact package'); await t.until(() => document.body.textContent.includes('Package preview is unavailable'));
    assert.equal(document.querySelector('select'), null);
    t.state.output = t.f.prepared.output; await t.choose(); await t.click('Preview exact package'); await t.until(() => document.body.textContent.includes('Exact package preview — not saved'));
    await act(async () => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new t.dom.window.Event('visibilitychange')); });
    assert.doesNotMatch(document.body.textContent, /Exact package preview — not saved/); assert.equal(t.button('Preview exact package').disabled, true);
  } finally { release?.(); await t.cleanup(); }
});
