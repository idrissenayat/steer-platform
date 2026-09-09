import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { transformWithOxc } from 'vite';
import { createElement, act } from 'react';
import { JSDOM } from 'jsdom';
import { createHash } from 'node:crypto';

test('real conversation component sends free text, follows up and displays three inert candidates without saving', async () => {
  const require = createRequire(import.meta.url);
  const compile = async (name, replacements) => {
    let code = (await transformWithOxc(readFileSync(new URL(`../app/${name}.tsx`, import.meta.url), 'utf8'), `/synthetic/${name}.tsx`, { jsx: { runtime: 'automatic' } })).code;
    for (const specifier of ['react', 'react/jsx-runtime', 'react-markdown', '@steer/tool-registry/candidate-save-prepare-contracts', '@steer/tool-registry/candidate-save-preview-contracts', '@steer/tool-registry/candidate-save-review-contracts', '@steer/tool-registry/intent-scope-selection', '@steer/tool-registry/agent-contracts', '@steer/tool-registry/intent-revision-contracts']) for (const quote of ['"', "'"]) code = code.replaceAll(`${quote}${specifier}${quote}`, JSON.stringify(pathToFileURL(require.resolve(specifier)).href));
    for (const [specifier, target] of Object.entries(replacements)) for (const quote of ['"', "'"]) code = code.replaceAll(`${quote}${specifier}${quote}`, JSON.stringify(target));
    return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  };
  const markdown = await compile('brief-markdown', { './brief-reading-order': new URL('../app/brief-reading-order.ts', import.meta.url).href });
  const scopeReview = await compile('intent-scope-review', { './intent-scope-reader': new URL('../app/intent-scope-reader.ts', import.meta.url).href, './brief-location': new URL('../app/brief-location.ts', import.meta.url).href });
  const scopePanel = await compile('intent-scope-panel', { './intent-scope-editor': new URL('../app/intent-scope-editor.ts', import.meta.url).href,
    './intent-scope-transport': new URL('../app/intent-scope-transport.ts', import.meta.url).href, './brief-location': new URL('../app/brief-location.ts', import.meta.url).href });
  const packagePreview = await compile('candidate-save-preview', { './candidate-save-start-client': new URL('../app/candidate-save-start-client.ts', import.meta.url).href, './candidate-save-prepare-client': new URL('../app/candidate-save-prepare-client.ts', import.meta.url).href, './candidate-save-status-client': new URL('../app/candidate-save-status-client.ts', import.meta.url).href, './candidate-save-preview-client': new URL('../app/candidate-save-preview-client.ts', import.meta.url).href, './intent-run-discovery-transport': new URL('../app/intent-run-discovery-transport.ts', import.meta.url).href });
  const finalReview = await compile('candidate-save-review', { './candidate-save-preview': packagePreview, './candidate-save-review-client': new URL('../app/candidate-save-review-client.ts', import.meta.url).href });
  const history = await compile('intent-development-history', { './intent-development-history-transport': new URL('../app/intent-development-history-transport.ts', import.meta.url).href, './brief-markdown': markdown });
  const development = await compile('intent-development-panel', { './intent-development-history': history, './candidate-save-review': finalReview, './intent-scope-panel': scopePanel, './intent-development-editor': new URL('../app/intent-development-editor.ts', import.meta.url).href,
    './intent-development-transport': new URL('../app/intent-development-transport.ts', import.meta.url).href, './brief-markdown': markdown });
  const runHistory = await compile('intent-run-history', { './intent-development-history': history, './intent-scope-panel': scopePanel, './intent-run-discovery-transport': new URL('../app/intent-run-discovery-transport.ts', import.meta.url).href });
  const panel = await compile('intent-draft-panel', { './intent-run-history': runHistory, './intent-development-panel': development, '@steer/tool-registry/intent-draft-content': pathToFileURL(require.resolve('@steer/tool-registry/intent-draft-content')).href,
    './intent-draft-editor': new URL('../app/intent-draft-editor.ts', import.meta.url).href, './intent-draft-transport': new URL('../app/intent-draft-transport.ts', import.meta.url).href, './brief-markdown': markdown });
  const Component = (await import(await compile('intent-conversation', { './agent-transport': new URL('../app/agent-transport.ts', import.meta.url).href, './brief-markdown': markdown, './intent-scope-review': scopeReview, './intent-draft-panel': panel }))).default;
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://steer.example', pretendToBeVisual: true });
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT', 'fetch'];
  const saved = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) Object.defineProperty(globalThis, key, { configurable: true, value });
  const requests = [], scopeRequests = [];
  let conflict = false;
  globalThis.fetch = async (url, init) => {
    if (url.endsWith('/intent.overlap.check')) {
      const input = JSON.parse(init.body); scopeRequests.push(input);
      return Response.json({ kind: 'intent-overlap-candidates', organizationId: 'org', repository: 'github:1',
        sourceDigest: createHash('sha256').update(JSON.stringify(input.intent)).digest('hex'), catalogFingerprint: 'c'.repeat(64), reviewFingerprint: 'd'.repeat(64),
        method: 'lexical-candidates/v1', semanticReviewComplete: false, authoritativeClearance: false,
        coverage: { scope: 'configured-projections-only', catalogCount: 0, inspectedIntents: 0, inspectedDocuments: 0, candidateCount: 0,
          scanLimited: false, resultsTruncated: false, gaps: [] }, candidates: [] });
    }
    requests.push({ url, input: JSON.parse(init.body) });
    if (conflict) { conflict = false; return Response.json({ error: { code: 'SCOPE_REVIEW_CHANGED' } }, { status: 409 }); }
    return Response.json({ kind: 'intent-agent-candidate', organizationId: 'org', subject: 'human', sourceDigest: 'a'.repeat(64), configurationRevision: 'test', saved: false, gateSigned: false, executionAuthorized: false,
      ...(requests.length === 1 ? { message: 'One question.', questions: ['Who books appointments?'], documents: null }
        : { message: 'Your drafts are ready to review.', questions: [], documents: { brief: '# Brief\nBooking for patients', spec: '# Spec\nAC-01 book a slot', exam: '# Exam\nNOT RUN\n<script>unsafe()</script>\n![image](https://outside.invalid/image)' } }) });
  };
  const { createRoot } = await import('react-dom/client'); const root = createRoot(document.getElementById('root'));
  const props = { organizationId: 'org', subject: 'human', repository: 'github:1', expiresAt: new Date(Date.now() + 60000).toISOString(), enabled: true };
  const set = async (id, text) => act(async () => {
    const element = document.getElementById(id);
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(element, text);
    element.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  const submit = async () => act(async () => document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
  const direction = async () => {
    await act(async () => { document.querySelector('.intent-scope-review > button').click(); await new Promise(resolve => setTimeout(resolve, 20)); });
    await act(async () => {
      const select = document.getElementById('scope-direction'); select.value = 'new-distinct';
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
    await set('scope-reason', 'This booking service is for a distinct audience.');
    await act(async () => { document.querySelector('.intent-scope-choice button').click(); await new Promise(resolve => setTimeout(resolve, 20)); });
  };
  try {
    await act(async () => root.render(createElement(Component, props)));
    assert.equal(document.querySelectorAll('textarea').length, 1);
    assert.doesNotMatch(document.body.textContent, /8 questions|Open UX preview/);
    await set('agent-intent', 'I want a patient booking service.'); await submit(); assert.equal(requests.length, 0);
    await direction(); await submit();
    assert.match(document.body.textContent, /Who books appointments/);
    await set('agent-clarification', 'Patients book for themselves.'); await submit(); assert.equal(requests.length, 1);
    await direction(); conflict = true; await submit();
    assert.match(document.body.textContent, /Existing scope changed/); assert.doesNotMatch(document.body.textContent, /Direction checked against/);
    assert.equal(document.getElementById('agent-intent').value, 'I want a patient booking service.');
    assert.equal(document.getElementById('agent-clarification').value, 'Patients book for themselves.');
    await submit(); assert.equal(requests.length, 2);
    await direction(); await submit();
    assert.equal(requests.length, 3); assert.equal(requests[1].input.clarification, 'Patients book for themselves.');
    assert.ok(requests.every(item => item.url.endsWith('/v1/tools/intent.agent.develop')));
    assert.equal(scopeRequests.length, 6); assert.match(scopeRequests[2].intent, /Clarification:\nPatients book for themselves/);
    assert.equal(requests[1].input.disposition.choice.reason, 'This booking service is for a distinct audience.');
    assert.notEqual(requests[0].input.disposition.sourceDigest, requests[1].input.disposition.sourceDigest);
    for (const name of ['BRIEF.md', 'SPEC.md', 'EXAM.md']) {
      const button = [...document.querySelectorAll('button')].find(button => button.textContent === name); assert.ok(button);
      await act(async () => button.click()); assert.equal(button.getAttribute('aria-pressed'), 'true');
    }
    assert.match(document.body.textContent, /NOT RUN/); assert.match(document.body.textContent, /not saved to GitHub/);
    assert.match(document.body.textContent, /The earlier check covered your message, not these documents/);
    assert.equal(document.querySelector('[data-intent-review-state]').getAttribute('data-intent-review-state'), 'needs-scope-review');
    assert.match(document.body.textContent, /Document edit version 1/);
    assert.equal(document.querySelector('script, img'), null); assert.equal(window.localStorage.length, 0);
    const button = async label => act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === label).click());
    assert.equal(document.getElementById('agent-intent').disabled, true);
    await button('Edit draft');
    await set('intent-document-editor', '# Exam\nNOT RUN\nHuman correction — فارسی <script>unsafe()</script>');
    assert.match(document.body.textContent, /Document edit version 2/);
    assert.match(document.body.textContent, /Independent Exam review required/);
    assert.match(document.body.textContent, /Earlier direction retained for reference only/);
    await button('BRIEF.md'); await set('intent-document-editor', '# Brief\nEdited patient booking outcome');
    assert.doesNotMatch(document.body.textContent, /Direction checked against/);
    await set('intent-document-editor', '# Brief\nBooking for patients'); // Undo cannot resurrect the old confirmation.
    assert.doesNotMatch(document.body.textContent, /Direction checked against/);
    assert.match(document.body.textContent, /Scope review needed/);
    await set('intent-document-editor', '# Brief\nEdited patient booking outcome');
    await button('SPEC.md'); await set('intent-document-editor', '');
    assert.match(document.body.textContent, /This draft is empty/);
    await set('intent-document-editor', '# Spec\nAC-01: A patient can book an accessible slot.');
    await button('EXAM.md'); assert.match(document.getElementById('intent-document-editor').value, /Human correction — فارسی/);
    await button('View generated original'); assert.doesNotMatch(document.body.textContent, /Human correction — فارسی/);
    await button('Read your draft'); assert.match(document.body.textContent, /Human correction — فارسی/);
    assert.equal(document.querySelector('script, img'), null);
    await button('BRIEF.md'); assert.match(document.body.textContent, /Edited patient booking outcome/);
    await button('View generated original'); assert.match(document.body.textContent, /Booking for patients/);
    assert.doesNotMatch(document.body.textContent, /Edited patient booking outcome/);
    assert.equal(requests.length, 3); assert.equal(scopeRequests.length, 6); assert.equal(window.localStorage.length, 0);
    await act(async () => root.render(createElement(Component, { ...props, subject: 'another-human' })));
    assert.equal(document.querySelector('.intent-documents'), null); assert.equal(document.getElementById('agent-intent').value, '');
    assert.doesNotMatch(document.body.textContent, /Human correction|Booking for patients/);
    await act(async () => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new dom.window.Event('visibilitychange')); });
    assert.equal(document.querySelector('textarea'), null); assert.doesNotMatch(document.body.textContent, /Booking for patients/);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const key of keys) { if (saved[key]) Object.defineProperty(globalThis, key, saved[key]); else delete globalThis[key]; }
  }
});
