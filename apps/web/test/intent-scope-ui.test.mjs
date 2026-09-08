import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { transformWithOxc } from 'vite';
import { createElement, act } from 'react';
import { JSDOM } from 'jsdom';
import { scopeEditorFixture } from './intent-scope.fixture.ts';

async function component() {
  const require = createRequire(import.meta.url), cache = new Map();
  async function compile(name) {
    if (cache.has(name)) return cache.get(name);
    let code = (await transformWithOxc(readFileSync(new URL(`../app/${name}.tsx`, import.meta.url), 'utf8'), `/synthetic/${name}.tsx`, { jsx: { runtime: 'automatic' } })).code;
    for (const specifier of [...code.matchAll(/from\s+(["'])([^"']+)\1/g)].map(m => m[2])) {
      let target;
      if (specifier.startsWith('./')) {
        try { target = await compile(specifier.slice(2)); }
        catch (error) { if (error.code !== 'ENOENT') throw error; target = new URL(`../app/${specifier.slice(2)}.ts`, import.meta.url).href; }
      } else target = pathToFileURL(require.resolve(specifier)).href;
      for (const quote of ['"', "'"]) code = code.replaceAll(`${quote}${specifier}${quote}`, JSON.stringify(target));
    }
    const result = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`; cache.set(name, result); return result;
  }
  return (await import(await compile('intent-development-panel'))).default;
}
async function renderFixture(candidate = false) {
  const f = await scopeEditorFixture(candidate ? 4 : 34, candidate), Component = await component();
  const dom = new JSDOM('<!doctype html><html lang="en"><title>STEER scope test</title><main id="root"></main></html>', { url: 'https://steer.example', pretendToBeVisual: true });
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT', 'fetch'];
  const saved = Object.fromEntries(keys.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) Object.defineProperty(globalThis, key, { configurable: true, value });
  const { configurationRevision, sourceSnapshotDigest, ...input } = f.input;
  const state = { lost: true, denied: false, output: f.pending, scopeCalls: [], allCalls: [] };
  const review = { ...input, kind: 'steer-development-review/v1', configurationRevision, sourceSnapshotDigest,
    evidence: f.evidence, scopeBatchPlan: f.source.plan, semanticReviewComplete: false, authoritativeClearance: false, executionAuthorized: false, savedToGit: false, gateSigned: false };
  globalThis.fetch = async (url, init) => {
    const input = JSON.parse(init.body); state.allCalls.push({ url, input });
    assert.equal(init.credentials, 'same-origin'); assert.doesNotMatch(init.body, /EXAM-PRIVATE|originalText|api.key|budget|modelRoute/);
    if (url.endsWith('intent.development.review')) return Response.json(review);
    assert.ok(url.includes('/intent.scope.'), 'Scope interactions must not trigger document generation or saving');
    state.scopeCalls.push({ url, input });
    if (url.endsWith('.prepare')) return Response.json(f.prepared);
    if (url.endsWith('.start')) { if (state.lost) { state.lost = false; throw new Error('PRIVATE lost ACK'); } return Response.json(f.started); }
    return state.denied ? Response.json({ PRIVATE: true }, { status: 403 }) : Response.json(state.output);
  };
  const source = { input, content: { originalText: f.scope.originalText, clarificationTurns: f.scope.clarificationTurns,
    documents: { ...f.scope.documents, exam: 'EXAM-PRIVATE never included' } } };
  const props = { source, subject: 'human', identity: 'org-product-human', expiresAt: new Date(Date.now() + 600000).toISOString(), enabled: true,
    onResult: () => { throw new Error('Scope cannot replace documents'); } };
  const { createRoot } = await import('react-dom/client'), root = createRoot(document.getElementById('root'));
  const tick = () => new Promise(resolve => setTimeout(resolve, 25));
  const button = text => [...document.querySelectorAll('button')].find(b => b.textContent === text);
  const until = async predicate => { for (let i = 0; i < 80 && !predicate(); i++) await act(async () => { await tick(); }); assert.ok(predicate()); };
  const click = async text => act(async () => { const b = button(text); assert.ok(b, text); assert.equal(b.disabled, false, text); b.click(); await tick(); });
  const render = async patch => act(async () => { root.render(createElement(Component, { ...props, ...patch })); await tick(); });
  await render({});
  return { f, props, state, root, dom, button, until, click, render,
    cleanup: async () => { await act(async () => root.unmount()); dom.window.close(); for (const k of keys) { if (saved[k]) Object.defineProperty(globalThis, k, saved[k]); else delete globalThis[k]; } } };
}

test('actual editor scope controls recover a lost start, show exact partial/full findings, preserve edits and never generate or save', async () => {
  const t = await renderFixture();
  try {
    assert.equal(t.state.allCalls.length, 0); await t.click('Review existing work for this draft');
    await t.click('Assess existing scope'); await t.until(() => Boolean(t.button('Recover the same scope request')));
    assert.match(document.body.textContent, /response was lost or access changed/); assert.equal(t.button('Review existing work for this draft').disabled, true);
    assert.equal(t.button('Confirm direction and develop this draft').disabled, true);
    await t.click('Recover the same scope request'); await t.until(() => document.body.textContent.includes('Assessment is in progress'));
    assert.deepEqual(t.state.scopeCalls.filter(c => c.url.endsWith('.start')).map(c => c.input), [t.f.startInput, t.f.startInput]);
    t.state.output = await t.f.observation(1);
    // The production timer performs a read, not another start or preparation.
    const readsBefore = t.state.scopeCalls.filter(c => c.url.endsWith('.read')).length;
    await act(async () => { await new Promise(r => setTimeout(r, 2100)); });
    assert.ok(t.state.scopeCalls.filter(c => c.url.endsWith('.read')).length > readsBefore);
    await t.until(() => document.querySelector('.intent-scope-findings')?.textContent.includes('Captured 1 of 2'));
    assert.match(document.querySelector('.intent-scope-findings').textContent, /partial findings, not a complete duplicate review/);
    t.state.output = await t.f.observation(2, '<img src=x onerror=alert(1)> Synthetic finding only');
    await t.click('Check scope review progress'); await t.until(() => document.body.textContent.includes('Findings are ready'));
    assert.equal(document.activeElement.id, 'scope-workflow-title'); assert.equal(t.button('Review existing work for this draft').disabled, false);
    assert.match(document.querySelector('.intent-scope-findings').textContent, /Related but distinct|Do not book patient appointments. فارسی ☕/);
    const link = document.querySelector('.intent-scope-findings a'); assert.ok(link.href.includes('revision=' + t.f.evidence.head));
    assert.equal(document.querySelector('.intent-scope-findings script, .intent-scope-findings img'), null);
    assert.match(document.querySelector('.intent-scope-findings').textContent, /<img src=x onerror=alert\(1\)>/);
    assert.equal(t.state.scopeCalls.filter(c => c.url.endsWith('.prepare')).length, 1);
    // Revoked model-use capability does not prohibit read-only recovery; a denied
    // read clears findings rather than treating the response as no matches.
    await t.render({ enabled: false }); assert.equal(t.button('Assess existing scope').disabled, true);
    t.state.denied = true; await t.click('Check scope review progress'); await t.until(() => document.body.textContent.includes('not a no-match result'));
    assert.equal(document.querySelector('.intent-scope-findings'), null); assert.doesNotMatch(document.body.textContent, /PRIVATE lost ACK/);
    t.state.denied = false; await t.click('Check scope review progress'); await t.until(() => Boolean(document.querySelector('.intent-scope-findings')));
    const axe = (await import('axe-core')).default;
    const report = await axe.run(document.getElementById('root'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, rules: { 'color-contrast': { enabled: false } } });
    assert.deepEqual(report.violations.map(v => ({ id: v.id, description: v.description })), []);
    const count = t.state.allCalls.length;
    const changed = { ...t.props.source, content: { ...t.props.source.content, originalText: 'New unsaved human scope' } };
    await t.render({ source: changed }); assert.match(document.body.textContent, /Your scope changed/); assert.equal(document.querySelector('.intent-scope-findings'), null);
    await t.render({}); assert.equal(document.querySelector('.intent-scope-findings'), null); assert.equal(t.state.allCalls.length, count);
    assert.equal(window.localStorage.length, 0); assert.equal(window.sessionStorage.length, 0);
    await t.render({ subject: 'other', identity: 'org-product-other' }); assert.equal(document.querySelector('.intent-scope-findings'), null);
    assert.equal(document.querySelector('.intent-scope-workflow'), null);
  } finally { await t.cleanup(); }
});

test('proposed Brief citations remain readable without unsupported deep links; expired or hidden review releases no content', async () => {
  const t = await renderFixture(true);
  try {
    t.state.lost = false; t.state.output = t.f.ready; await t.click('Review existing work for this draft'); await t.click('Assess existing scope');
    await t.until(() => Boolean(document.querySelector('.intent-scope-findings')));
    assert.match(document.querySelector('.intent-scope-findings').textContent, /direct opening is not yet supported/);
    assert.equal(document.querySelector('.intent-scope-findings a'), null);
    t.state.output = { ...t.f.ready, status: 'expired', batches: null, review: null }; await t.click('Check scope review progress');
    await t.until(() => document.body.textContent.includes('This review expired'));
    assert.equal(document.querySelector('.intent-scope-findings'), null);
    await act(async () => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new window.Event('visibilitychange')); });
    assert.equal(document.querySelector('.intent-scope-workflow'), null);
  } finally { await t.cleanup(); }
});
