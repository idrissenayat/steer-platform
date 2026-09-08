import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { transformWithOxc } from 'vite';
import { createElement, act } from 'react';
import { JSDOM } from 'jsdom';
import { fingerprintIntentScope } from '@steer/tool-registry/intent-revision-contracts';

// Compile the actual production component graph, substituting only HTTP responses.
async function component() {
  const require = createRequire(import.meta.url);
  const compile = async (name, replacements = {}) => {
    let code = (await transformWithOxc(readFileSync(new URL(`../app/${name}.tsx`, import.meta.url), 'utf8'), `/synthetic/${name}.tsx`, { jsx: { runtime: 'automatic' } })).code;
    for (const specifier of ['react', 'react/jsx-runtime', 'react-markdown', '@steer/tool-registry/agent-contracts', '@steer/tool-registry/intent-draft-content', '@steer/tool-registry/intent-revision-contracts'])
      for (const quote of ['"', "'"]) code = code.replaceAll(`${quote}${specifier}${quote}`, JSON.stringify(pathToFileURL(require.resolve(specifier)).href));
    for (const [specifier, target] of Object.entries(replacements)) for (const quote of ['"', "'"]) code = code.replaceAll(`${quote}${specifier}${quote}`, JSON.stringify(target));
    return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  };
  const local = name => new URL(`../app/${name}.ts`, import.meta.url).href;
  const markdown = await compile('brief-markdown', { './brief-reading-order': local('brief-reading-order') });
  const scope = await compile('intent-scope-review', { './intent-scope-reader': local('intent-scope-reader'), './brief-location': local('brief-location') });
  const scopePanel = await compile('intent-scope-panel', { './intent-scope-editor': local('intent-scope-editor'), './intent-scope-transport': local('intent-scope-transport'), './brief-location': local('brief-location') });
  const development = await compile('intent-development-panel', { './intent-scope-panel': scopePanel, './intent-development-editor': local('intent-development-editor'), './intent-development-transport': local('intent-development-transport'), './brief-markdown': markdown });
  const panel = await compile('intent-draft-panel', { './intent-development-panel': development, './intent-draft-editor': local('intent-draft-editor'), './intent-draft-transport': local('intent-draft-transport'), './brief-markdown': markdown });
  return (await import(await compile('intent-conversation', { './agent-transport': local('agent-transport'), './intent-scope-review': scope, './intent-draft-panel': panel, './brief-markdown': markdown }))).default;
}

test('actual editor graph preserves older ACKs, recovers exact lost writes and explicitly restores inert drafts without inventing provenance', async () => {
  const Component = await component();
  const dom = new JSDOM('<!doctype html><html lang="en"><title>STEER test</title><main id="root"></main></html>', { url: 'https://steer.example', pretendToBeVisual: true });
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT', 'fetch'];
  const saved = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) Object.defineProperty(globalThis, key, { configurable: true, value });
  const scope = { organizationId: 'org', productId: 'product', repository: 'github:52' }, draftId = '00000000-0000-4000-8000-000000000001';
  const calls = [], stored = new Map(); let mode = 'defer', current = null, release;
  const ref = async (content, revision) => ({ draftId, revision, latestRevision: revision, revisionDigest: String(revision).repeat(64), sourceRevision: revision, savedToGit: false,
    ...(await fingerprintIntentScope({ ...scope, draftId, sourceRevision: revision, originalText: content.originalText,
      clarificationTurns: content.clarificationTurns, documents: content.documents ? { brief: content.documents.brief, spec: content.documents.spec } : null })) });
  // fingerprintIntentScope includes two internal values not part of the wire result.
  const wire = output => { const { briefDigest, specDigest, ...rest } = output; return rest; };
  globalThis.fetch = async (url, init) => {
    const input = JSON.parse(init.body); calls.push({ url, input });
    if (url.endsWith('intent.draft.create')) return Response.json({ outcome: 'created', requestId: input.requestId, draftId,
      createdAt: '2026-09-08T00:00:00.000Z', useUntil: '2026-09-09T00:00:00.000Z', retentionDeadline: '2026-09-10T00:00:00.000Z', contentPreserved: false, savedToGit: false });
    if (url.endsWith('intent.draft.read')) return Response.json(current);
    assert.ok(url.endsWith('intent.draft.append'), 'No agent, scope, Git write or other network command is allowed in this test');
    if (mode === 'conflict') return Response.json({ outcome: 'conflict', savedToGit: false });
    const cached = stored.get(input.mutationId);
    if (cached) return Response.json(cached);
    const reference = wire(await ref(input.content, input.expectedRevision + 1));
    const ack = { ...reference, outcome: 'acknowledged', mutationId: input.mutationId };
    stored.set(input.mutationId, ack); current = { ...reference, content: input.content };
    if (mode === 'defer') return new Promise(resolve => { release = () => resolve(Response.json(ack)); });
    if (mode === 'lost') { mode = 'normal'; throw new Error('Lost acknowledgement'); }
    return Response.json(ack);
  };
  const { createRoot } = await import('react-dom/client'); const root = createRoot(document.getElementById('root'));
  const props = { organizationId: scope.organizationId, subject: 'synthetic-human', repository: scope.repository,
    draftProductId: scope.productId, expiresAt: new Date(Date.now() + 600000).toISOString(), enabled: false };
  const tick = () => new Promise(resolve => setTimeout(resolve, 20));
  const button = label => [...document.querySelectorAll('button')].find(button => button.textContent === label);
  const click = async label => act(async () => { assert.ok(button(label), label); button(label).click(); await tick(); });
  const set = async (id, text) => act(async () => {
    const element = document.getElementById(id);
    Object.getOwnPropertyDescriptor(element.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype, 'value').set.call(element, text);
    element.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
  try {
    await act(async () => root.render(createElement(Component, { ...props, draftProductId: null })));
    assert.equal(document.querySelector('.intent-draft-preservation'), null); assert.equal(calls.length, 0);
    await act(async () => root.render(createElement(Component, props)));
    assert.equal(calls.length, 0); await set('agent-intent', 'First exact intent فارسی'); await click('Preserve draft');
    assert.match(document.body.textContent, /No content preservation acknowledged/);
    await set('agent-intent', 'Newer edit during save');
    await act(async () => { release(); await tick(); }); mode = 'normal';
    assert.equal(document.getElementById('agent-intent').value, 'Newer edit during save');
    assert.match(document.body.textContent, /revision 1 preserved; your current edits are not preserved/);
    mode = 'lost'; await click('Preserve draft');
    assert.match(document.body.textContent, /Preservation is not confirmed/); assert.equal(button('Preserve draft').disabled, true);
    await set('agent-intent', 'Third unsent edit'); const count = calls.length;
    await click('Retry exact request'); assert.equal(calls.length, count + 1);
    assert.deepEqual(calls.at(-1), calls.at(-2)); assert.equal(stored.size, 2);
    assert.equal(document.getElementById('agent-intent').value, 'Third unsent edit');
    assert.match(document.body.textContent, /revision 2 preserved; your current edits are not preserved/);
    mode = 'conflict'; await click('Preserve draft'); assert.match(document.body.textContent, /Another revision is already present/);
    const remote = { originalText: 'Remote exact intent\n  spaces', clarificationTurns: ['First turn', '', 'Third turn فارسی'],
      documents: { brief: '# Remote brief', spec: '# Remote spec', exam: '# Remote exam\n<script>unsafe()</script>\n![image](https://outside.invalid/img)' } };
    current = { ...wire(await ref(remote, 3)), content: remote };
    await click('Review stored revision');
    assert.match(document.activeElement.textContent, /Stored revision 3/);
    assert.equal(document.getElementById('agent-intent').value, 'Third unsent edit');
    assert.equal(document.querySelector('script, img'), null);
    await click('Keep my current text'); assert.equal(document.querySelector('.intent-restored-preview'), null);
    assert.equal(document.activeElement.textContent, 'Review stored revision');
    assert.equal(document.getElementById('agent-intent').value, 'Third unsent edit');
    assert.equal(button('Preserve draft').disabled, true); // Dismissing cannot clear a conflict.
    await click('Review stored revision');
    await set('agent-intent', 'Still editing while comparing');
    await click('Replace editor with this stored revision');
    assert.equal(document.getElementById('agent-intent').value, remote.originalText);
    assert.equal(document.activeElement.textContent, 'Your draft documents');
    assert.match(document.body.textContent, /Restored editable drafts — authorship not verified/);
    assert.match(document.body.textContent, /Stored clarification/);
    assert.doesNotMatch(document.body.textContent, /Generation reference:|View generated original|Exam was drafted in a separate/);
    assert.match(document.body.textContent, /fresh scope, conformance and Exam review/);
    await click('EXAM.md'); await click('Edit draft'); await set('intent-document-editor', '# Human Exam correction فارسی');
    mode = 'normal'; await click('Preserve draft');
    assert.deepEqual(calls.at(-1).input.content.clarificationTurns, remote.clarificationTurns);
    assert.equal(calls.at(-1).input.content.documents.exam, '# Human Exam correction فارسی');
    assert.equal(calls.at(-1).input.expectedRevision, 3);
    assert.match(document.body.textContent, /Draft revision 4 preserved\. Not saved to GitHub/);
    assert.equal(window.localStorage.length, 0); assert.equal(window.sessionStorage.length, 0);
    const axe = (await import('axe-core')).default;
    const accessibility = await axe.run(document.getElementById('root'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, rules: { 'color-contrast': { enabled: false } } });
    assert.deepEqual(accessibility.violations.map(v => ({ id: v.id, description: v.description })), []);
    await act(async () => root.render(createElement(Component, { ...props, draftProductId: 'other-product' })));
    assert.equal(document.getElementById('agent-intent').value, ''); assert.equal(document.querySelector('.intent-documents'), null);
    assert.doesNotMatch(document.body.textContent, /Remote exact intent|Human Exam correction|revision 4/);
    await set('agent-intent', 'Private unsaved text');
    await act(async () => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new window.Event('visibilitychange')); });
    assert.equal(document.querySelector('textarea, input'), null); assert.doesNotMatch(document.body.textContent, /Private unsaved text/);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const key of keys) { if (saved[key]) Object.defineProperty(globalThis, key, saved[key]); else delete globalThis[key]; }
  }
});
