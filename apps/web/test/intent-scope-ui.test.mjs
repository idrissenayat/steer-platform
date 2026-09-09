import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { transformWithOxc } from 'vite';
import { createElement, act } from 'react';
import { JSDOM } from 'jsdom';
import { scopeEditorFixture } from './intent-scope.fixture.ts';
import { buildIntentDevelopmentContext } from '@steer/tool-registry/intent-development-context';
import { buildIntentEvidenceEnvelope } from '@steer/tool-registry/intent-evidence-contracts';

function accessibilityAudit() {
  // axe captures the current DOM at load time. Each fixture owns a fresh JSDOM;
  // do not reuse an auditor bound to a previously closed document.
  const require=createRequire(import.meta.url),path=require.resolve('axe-core');delete require.cache[path];
  return require('axe-core').run(document.getElementById('root'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa']},rules:{'color-contrast':{enabled:false}}});
}

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
  const state = { lost: true, denied: false, allowDevelopment: false, output: f.pending, history: f.history, historyWait: null, discovery: f.discovery, scopeCalls: [], allCalls: [] };
  const review = { ...input, kind: 'steer-development-review/v1', configurationRevision, sourceSnapshotDigest,
    evidence: f.evidence, scopeBatchPlan: f.source.plan, semanticReviewComplete: false, authoritativeClearance: false, executionAuthorized: false, savedToGit: false, gateSigned: false };
  globalThis.fetch = async (url, init) => {
    const input = JSON.parse(init.body); state.allCalls.push({ url, input });
    assert.equal(init.credentials, 'same-origin'); assert.doesNotMatch(init.body, /EXAM-PRIVATE|originalText|api.key|budget|modelRoute/);
    if (url.endsWith('intent.development.review')) return Response.json(review);
    if (state.allowDevelopment && url.endsWith('intent.development.prepare')) throw new Error('Synthetic lost preparation response');
    assert.ok(url.includes('/intent.scope.'), 'Scope interactions must not trigger document generation or saving');
    state.scopeCalls.push({ url, input });
    if (url.endsWith('.history')) { if (state.historyWait) await state.historyWait;
      return state.denied ? Response.json({}, { status: 403 }) : Response.json(state.history); }
    if (url.endsWith('.discover')) return state.denied ? Response.json({}, { status: 403 }) : Response.json({ ...state.discovery, cursor: input.cursor });
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

test('fresh actual editor discovers and reads a retained completed scope review without preparing or starting a model run', async () => {
  const t = await renderFixture();
  try {
    t.state.output = t.f.ready; await t.click('Review existing work for this draft');
    await t.render({ enabled: false }); // Metadata and result reads remain possible without model-use permission.
    await t.click('Find retained scope reviews'); await t.until(() => Boolean(t.button('Read retained review ' + t.f.prepared.reference.reviewId)));
    assert.match(document.body.textContent, /not newest first|not newest|not.*newest first/);
    await t.click('Read retained review ' + t.f.prepared.reference.reviewId); await t.until(() => document.body.textContent.includes('Findings are ready'));
    assert.ok(document.querySelector('.intent-scope-findings')); assert.equal(t.button('Recover the same scope request'), undefined);
    assert.deepEqual(t.state.scopeCalls.map(c => c.url.split('.').at(-1)), ['discover', 'read']);
    assert.equal(window.localStorage.length, 0); assert.equal(window.sessionStorage.length, 0);
    t.state.denied = true; await t.click('Find retained scope reviews'); await t.until(() => document.body.textContent.includes('discovery could not be verified'));
    assert.equal(document.querySelector('.intent-scope-discovery'), null); assert.equal(document.querySelector('.intent-scope-findings'), null);
  } finally { await t.cleanup(); }
});

test('actual editor explicitly inspects expired historical citations without granting current direction, generation or saving',async()=>{
  const t=await renderFixture(true);
  try {
    t.state.output={...t.f.ready,status:'expired',batches:null,review:null};
    await t.click('Review existing work for this draft');await t.render({enabled:false});await t.click('Find retained scope reviews');
    await t.click('Read retained review '+t.f.prepared.reference.reviewId);
    assert.equal(document.querySelector('.intent-scope-findings'),null);
    assert.equal(t.state.scopeCalls.some(c=>c.url.endsWith('.history')),false);
    await t.click('Read historical findings');await t.until(()=>document.body.textContent.includes('Historical findings — not current clearance'));
    const panel=document.querySelector('.intent-scope-history');assert.match(panel.textContent,/execution window has expired/);
    assert.match(panel.textContent,new RegExp(t.f.evidence.head));assert.ok(panel.querySelector('blockquote'));
    assert.equal(document.activeElement.textContent,'Historical findings — not current clearance');
    assert.equal(document.querySelector('.intent-scope-choice').disabled,true);
    assert.equal(t.button('Confirm direction and develop this draft').disabled,true);
    assert.deepEqual(t.state.scopeCalls.map(c=>c.url.split('.').at(-1)),['discover','read','history']);
    assert.equal(window.localStorage.length,0);assert.equal(window.sessionStorage.length,0);
    const audit=await accessibilityAudit();
    assert.deepEqual(audit.violations,[]);
    t.state.denied=true;await t.click('Read historical findings');await t.until(()=>panel.textContent.includes('unavailable under current permissions'));
    assert.equal(panel.querySelector('blockquote'),null);
  } finally {await t.cleanup();}
});

test('actual history clears on input changes and page exit and cannot repopulate from an ignored-abort response',async()=>{
  const t=await renderFixture(true);
  try {
    t.state.output=t.f.ready;await t.click('Review existing work for this draft');await t.click('Find retained scope reviews');
    await t.click('Read retained review '+t.f.prepared.reference.reviewId);await t.click('Read historical findings');
    assert.ok(document.querySelector('.intent-scope-history blockquote'));
    await t.render({source:{...t.props.source,content:{...t.props.source.content,originalText:'Human correction remains untouched'}}});
    assert.equal(document.querySelector('.intent-scope-history blockquote'),null);
    let release;t.state.historyWait=new Promise(r=>{release=r;});
    await t.click('Read historical findings');
    await act(async()=>{window.dispatchEvent(new window.Event('pagehide'));release();await new Promise(r=>setTimeout(r,30));});
    assert.equal(document.querySelector('.intent-scope-history blockquote'),null);
    assert.equal(t.state.allCalls.some(c=>/intent\.development\.(prepare|start)|intent\.candidate\.save/.test(c.url)),false);
  } finally {await t.cleanup();}
});

test('actual editor carries all 34 assessed sources and permits an explicit linked direction to a Brief beyond the legacy context', async () => {
  const t = await renderFixture();
  const set = async (id, value) => act(async () => {
    const e = document.getElementById(id), p = e.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLTextAreaElement.prototype;
    Object.getOwnPropertyDescriptor(p, 'value').set.call(e, value); e.dispatchEvent(new window.Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 25));
  });
  try {
    t.state.lost = false; t.state.output = t.f.ready; t.state.allowDevelopment = true;
    await t.click('Review existing work for this draft');
    assert.match(document.body.textContent, /Checked 34 of 34/); assert.match(document.body.textContent, /128,000 permitted source bytes/);
    assert.equal(document.querySelector('.intent-scope-choice').disabled, true);
    await t.click('Assess existing scope'); await t.until(() => document.body.textContent.includes('Findings are ready'));
    assert.equal(document.querySelector('.intent-scope-choice').disabled, false);
    assert.equal(t.state.allCalls.filter(c => c.url.endsWith('intent.development.prepare')).length, 0);
    const legacy = await buildIntentEvidenceEnvelope(t.f.evidence), full = await buildIntentDevelopmentContext(t.f.evidence);
    const target = full.evidence.find(s => s.path.endsWith('/BRIEF.md') && !legacy.evidence.some(old => old.sourceId === s.sourceId)); assert.ok(target);
    await set('development-direction', 'extend-existing'); await set('development-target', target.path);
    await set('development-reason', 'Add the missing scope to this existing intent; do not create a duplicate.');
    await t.click('Confirm direction and develop this draft');
    const calls = t.state.allCalls.filter(c => c.url.endsWith('intent.development.prepare')); assert.equal(calls.length, 1);
    assert.equal(calls[0].input.draftingContextDigest, full.contextDigest); assert.equal(calls[0].input.scopeReview.resultsDigest, t.f.ready.review.resultsDigest);
    assert.deepEqual(calls[0].input.choice.target, { path: target.path, revision: t.f.evidence.head, contentDigest: target.contentDigest });
    assert.equal(t.state.allCalls.some(c => c.url.endsWith('intent.development.start')), false);
  } finally { await t.cleanup(); }
});

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
    const report = await accessibilityAudit();
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
