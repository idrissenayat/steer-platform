import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { transformWithOxc } from 'vite';
import { createElement, act } from 'react';
import { JSDOM } from 'jsdom';
import { fingerprintIntentScope } from '@steer/tool-registry/intent-revision-contracts';
import { buildIntentEvidenceEnvelope } from '@steer/tool-registry/intent-evidence-contracts';
import { planIntentScopeBatches, validateIntentScopeBatchResults } from '@steer/tool-registry/intent-scope-batches';
import { prepareIntentScopeReview } from '@steer/tool-registry/intent-scope-review';
import { scopeReviewFixture } from '../../../packages/tool-registry/test/intent-scope-review.fixture.ts';
import { scopeEditorFixture } from './intent-scope.fixture.ts';
import { developmentFixture } from '../../../packages/tool-registry/test/intent-development.fixture.ts';

// Entire production React graph and transports, only HTTP/provider inputs synthetic.
async function conversation() {
  const require = createRequire(import.meta.url), cache = new Map();
  async function compile(name) {
    if (cache.has(name)) return cache.get(name);
    const source = readFileSync(new URL(`../app/${name}.tsx`, import.meta.url), 'utf8');
    let code = (await transformWithOxc(source, `/synthetic/${name}.tsx`, { jsx: { runtime: 'automatic' } })).code;
    const imports = [...code.matchAll(/from\s+(["'])([^"']+)\1/g)].map(m => m[2]);
    for (const specifier of imports) {
      let target;
      if (specifier.startsWith('./')) {
        try { target = await compile(specifier.slice(2)); }
        catch (error) { if (error.code !== 'ENOENT') throw error; target = new URL(`../app/${specifier.slice(2)}.ts`, import.meta.url).href; }
      } else target = pathToFileURL(require.resolve(specifier)).href;
      for (const quote of ['"', "'"]) code = code.replaceAll(`${quote}${specifier}${quote}`, JSON.stringify(target));
    }
    const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`; cache.set(name, url); return url;
  }
  return (await import(await compile('intent-conversation'))).default;
}

test('actual editor preserves, reviews, clarifies, recovers a lost start and explicitly adopts editable Brief/Spec/Test Agent Exam candidates', async () => {
  const Component = await conversation(), f = await developmentFixture(), sf = await scopeReviewFixture(), sfUI = await scopeEditorFixture();
  const dom = new JSDOM('<!doctype html><html lang="en"><title>STEER test</title><main id="root"></main></html>', { url: 'https://steer.example', pretendToBeVisual: true });
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT', 'fetch'];
  const saved = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) Object.defineProperty(globalThis, key, { configurable: true, value });
  const calls = [], operations = new Map(); let reference = null, content = null, lost = false, incomplete = true, discoveryDenied = false, scopePrepared = null, scopeReady = null;
  globalThis.fetch = async (url, init) => {
    const input = JSON.parse(init.body); calls.push({ url, input });
    if (url.endsWith('intent.draft.discover')) {
      if (discoveryDenied) return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
      const operation = operations.get(reference.revision), { revision, sourceRevision, revisionDigest, scopeInputDigest } = reference;
      return Response.json({ ...input, kind: 'steer-draft-discovery/v1', observedAt: new Date().toISOString(), nextCursor: null,
        scope: 'current-owner-records-configuration', contentLoaded: false, executionAuthorized: false, savedToGit: false, gateSigned: false,
        entries: [{ draftId: reference.draftId, createdAt: new Date(Date.now() - 1000).toISOString(), useUntil: new Date(Date.now() + 600000).toISOString(),
          latest: { revision, sourceRevision, revisionDigest, scopeInputDigest }, run: operation ? { operationId: operation.operationId, inputDigest: operation.inputDigest } : null }] });
    }
    if (url.endsWith('intent.draft.read')) return Response.json({ ...reference, content });
    if (url.endsWith('intent.draft.create')) return Response.json({ outcome: 'created', requestId: input.requestId, draftId: f.input.draftId,
      createdAt: '2026-09-08T00:00:00.000Z', useUntil: '2026-09-09T00:00:00.000Z', retentionDeadline: '2026-09-10T00:00:00.000Z', contentPreserved: false, savedToGit: false });
    if (url.endsWith('intent.draft.append')) {
      content = input.content; const revision = input.expectedRevision + 1;
      const scope = await fingerprintIntentScope({ ...f.scope, draftId: f.input.draftId, sourceRevision: revision, ...content });
      reference = { draftId: f.input.draftId, revision, latestRevision: revision, sourceRevision: revision,
        revisionDigest: String(revision).repeat(64), scopeInputDigest: scope.scopeInputDigest, savedToGit: false };
      return Response.json({ ...reference, outcome: 'acknowledged', mutationId: input.mutationId });
    }
    if (url.endsWith('intent.development.review')) {
      assert.equal(input.revisionDigest, reference.revisionDigest);
      const evidence = { ...f.evidence, scopeInputDigest: reference.scopeInputDigest, inventoryComplete: !incomplete };
      return Response.json({ ...f.review, ...input, evidence, scopeBatchPlan: (await planIntentScopeBatches(evidence)).summary,
        sourceSnapshotDigest: (await buildIntentEvidenceEnvelope(evidence)).sourceSnapshotDigest });
    }
    if (url.endsWith('intent.scope.prepare')) {
      const evidence = { ...f.evidence, scopeInputDigest: reference.scopeInputDigest, inventoryComplete: !incomplete };
      const prepared = await prepareIntentScopeReview({ ...f.scope, draftId: input.draftId, sourceRevision: input.revision, ...content }, evidence, sf.profile);
      const review = await validateIntentScopeBatchResults(evidence, prepared.batches.map(b => ({ planDigest: prepared.plan.planDigest,
        batchId: b.metadata.batchId, assessment: sf.result(b) })), sf.profile.profileRevision);
      scopePrepared = { ...sfUI.prepared, ...input, reference: { reviewId: randomUUID(), preparationDigest: prepared.preparationDigest },
        coverage: { ...sfUI.prepared.coverage, inventoryCount: 1, plannedCount: 1, batchCount: 1 } };
      scopeReady = { ...sfUI.ready, ...f.scope, ...scopePrepared.reference, review,
        source: { draftId: input.draftId, revision: input.revision, latestRevision: input.revision, revisionDigest: input.revisionDigest, scopeInputDigest: input.scopeInputDigest },
        batches: prepared.batches.map(b => ({ batchId: b.metadata.batchId, state: 'succeeded', resultDigest: 'c'.repeat(64) })) };
      return Response.json(scopePrepared);
    }
    if (url.endsWith('intent.scope.start')) return Response.json({ ...sfUI.started, ...input,
      receipt: { ...sfUI.started.receipt, workflowId: `steer-scope/v1/${encodeURIComponent(input.organizationId)}/${input.reviewId}` } });
    if (url.endsWith('intent.scope.read')) return Response.json({ ...scopeReady, ...input });
    if (url.endsWith('intent.development.prepare')) {
      assert.equal(incomplete, false); assert.equal(input.revisionDigest, reference.revisionDigest);
      assert.deepEqual(input.scopeReview, { kind: 'recorded', ...scopePrepared.reference, resultsDigest: scopeReady.review.resultsDigest });
      let operation = operations.get(input.revision);
      if (!operation) { operation = { operationId: randomUUID(), inputDigest: String(input.revision + 3).repeat(64), reference: { ...reference }, content: structuredClone(content) }; operations.set(input.revision, operation); }
      return Response.json({ ...f.prepared, ...input, reference: { operationId: operation.operationId, inputDigest: operation.inputDigest } });
    }
    if (url.endsWith('intent.development.start')) {
      const operation = [...operations.values()].find(o => o.operationId === input.operationId); assert.ok(operation);
      if (input.revision === 2 && !lost) { lost = true; throw new Error('Lost after scheduling'); }
      return Response.json({ ...f.started, ...input, receipt: { ...f.started.receipt, workflowId: `steer-development/v1/org/${input.operationId}` } });
    }
    assert.ok(url.endsWith('intent.development.read'), 'No legacy agent, direct provider or Git command may be sent');
    const operation = [...operations.values()].find(o => o.operationId === input.operationId);
    const { draftId, revision, revisionDigest, scopeInputDigest } = operation.reference;
    return Response.json({ ...(revision === 1 ? f.questions : f.ready), ...input,
      source: { draftId, revision, revisionDigest, scopeInputDigest, latestRevision: reference.revision } });
  };
  const { createRoot } = await import('react-dom/client'), root = createRoot(document.getElementById('root'));
  const props = { ...f.scope, draftProductId: f.scope.productId, subject: 'human', expiresAt: new Date(Date.now() + 600000).toISOString(), enabled: true };
  const tick = () => new Promise(resolve => setTimeout(resolve, 30));
  const button = text => [...document.querySelectorAll('button')].find(e => e.textContent === text);
  const click = async text => act(async () => { assert.ok(button(text), text); assert.equal(button(text).disabled, false, text); button(text).click(); await tick(); });
  const set = async (id, text) => act(async () => {
    const element = document.getElementById(id); assert.ok(element, id);
    const prototype = element.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLTextAreaElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, text);
    element.dispatchEvent(new window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); await tick();
  });
  const direction = async () => { await set('development-direction', 'new-distinct'); await set('development-reason', f.choice.reason); };
  try {
    await act(async () => root.render(createElement(Component, props)));
    assert.equal(calls.length, 0); assert.equal(document.querySelector('.intent-scope-review'), null);
    assert.equal(document.querySelectorAll('textarea').length, 1);
    await set('agent-intent', f.content.originalText); await click('Preserve and review my intent');
    for (let i = 0; i < 40 && !document.body.textContent.includes('Coverage is incomplete'); i++) await act(async () => { await tick(); });
    assert.match(document.body.textContent, /Coverage is incomplete/);
    assert.equal(button('Confirm direction and develop this draft').disabled, true); assert.equal(operations.size, 0);
    incomplete = false; await click('Review existing work for this draft');
    assert.match(document.body.textContent, /Out of scope: patient booking/); assert.equal(document.activeElement.id, 'development-title');
    assert.match(document.querySelector('[aria-label="Scope assessment plan"]').textContent, /1 batch covering 1 of 1/);
    assert.match(document.body.textContent, /has not assessed duplicates or started model calls/);
    assert.equal(button('Confirm direction and develop this draft').disabled, true);
    await click('Assess existing scope');
    assert.match(document.body.textContent, /Findings are ready to review/);
    await direction(); await click('Confirm direction and develop this draft'); assert.equal(operations.size, 1);
    assert.match(document.body.textContent, /Which booking rules apply/); await click('Answer these questions');
    assert.equal(document.activeElement.id, 'agent-clarification'); await set('agent-clarification', ' Patients can cancel up to 24 hours before.\n');
    await click('Preserve draft'); await click('Review existing work for this draft');
    assert.equal(button('Confirm direction and develop this draft').disabled, true);
    await click('Assess existing scope'); await direction();
    await click('Confirm direction and develop this draft'); assert.equal(operations.size, 2);
    assert.match(document.body.textContent, /response was lost or access changed/);
    const before = calls.length; await click('Recover the same request');
    assert.equal(calls.length, before + 2); // Same start, then a status query.
    const starts = calls.filter(c => c.url.endsWith('intent.development.start')); assert.deepEqual(starts[1], starts[2]);
    assert.match(document.body.textContent, /Three generated candidates are ready/); assert.equal(document.querySelector('.intent-documents'), null);
    await click('Use these generated documents'); assert.equal(document.activeElement.textContent, 'Your draft documents');
    for (const name of ['BRIEF.md', 'SPEC.md', 'EXAM.md']) { await click(name); assert.ok(button('Edit draft')); }
    assert.equal(document.querySelector('script, img'), null); assert.match(document.body.textContent, /NOT RUN/);
    await click('Edit draft'); await set('intent-document-editor', '# Human Exam correction فارسی');
    await click('Check this run’s progress'); assert.equal(button('Use these generated documents').disabled, true);
    assert.equal(document.getElementById('intent-document-editor').value, '# Human Exam correction فارسی');
    assert.deepEqual(operations.get(2).content.clarificationTurns, [' Patients can cancel up to 24 hours before.\n']);
    assert.equal(calls.filter(c => c.url.endsWith('intent.development.prepare')).length, 2);
    assert.ok(calls.every(c => !c.url.includes('intent.agent.develop'))); assert.equal(window.localStorage.length, 0); assert.equal(window.sessionStorage.length, 0);
    // A fresh page has no browser-persisted run pointer. Find metadata, preview
    // stored content without replacement, explicitly restore, then read the run.
    await act(async () => root.render(null)); const beforeRefresh = calls.length;
    await act(async () => root.render(createElement(Component, { ...props, enabled: false })));
    assert.equal(calls.length, beforeRefresh); await set('agent-intent', 'Unsaved after-refresh text');
    await click('Find my drafts'); assert.equal(calls.length, beforeRefresh + 1);
    assert.equal(document.getElementById('agent-intent').value, 'Unsaved after-refresh text'); assert.equal(button('Resume this recorded run'), undefined);
    await click('Review this draft'); assert.match(document.activeElement.textContent, /review before replacing/);
    assert.equal(document.getElementById('agent-intent').value, 'Unsaved after-refresh text');
    await click('Keep my current text'); assert.equal(document.getElementById('agent-intent').value, 'Unsaved after-refresh text');
    await click('Review this draft'); await click('Replace editor with this stored revision');
    assert.equal(document.getElementById('agent-intent').value, operations.get(2).content.originalText);
    const beforeResume = calls.length; await click('Resume this recorded run');
    assert.deepEqual(calls.slice(beforeResume).map(c => c.url.split('/').at(-1)), ['intent.development.read']);
    assert.match(document.body.textContent, /Three generated candidates are ready/); await click('Use these generated documents');
    assert.equal(calls.filter(c => c.url.endsWith('intent.development.prepare')).length, 2); assert.equal(calls.filter(c => c.url.endsWith('intent.development.start')).length, 3);
    discoveryDenied = true; await click('Find my drafts');
    assert.match(document.body.textContent, /This is not an empty result/); assert.equal(document.querySelector('[data-draft-reference]'), null);
    assert.ok(document.querySelector('.intent-documents')); // Search failure does not erase the editor.
    const axe = (await import('axe-core')).default;
    const accessibility = await axe.run(document.getElementById('root'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, rules: { 'color-contrast': { enabled: false } } });
    assert.deepEqual(accessibility.violations.map(v => ({ id: v.id, description: v.description })), []);
    await act(async () => root.render(createElement(Component, { ...props, subject: 'other-human' })));
    assert.equal(document.querySelector('.intent-documents'), null); assert.doesNotMatch(document.body.textContent, /Human Exam correction|Existing billing/);
    assert.equal(document.querySelector('[data-draft-reference]'), null);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const key of keys) { if (saved[key]) Object.defineProperty(globalThis, key, saved[key]); else delete globalThis[key]; }
  }
});
