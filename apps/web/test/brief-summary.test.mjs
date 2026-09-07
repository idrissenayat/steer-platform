import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';
import { readBriefDocument } from '@steer/domain/brief-document';
import { briefSummarySections } from '../app/brief-summary-sections.ts';
const source = content => ({ content, document: readBriefDocument(content) });

test('summary keeps exact source bodies, order and Unicode without inferring metadata or outcomes', () => {
  const brief = source('# Brief: 日本語\r\n## Proposed outcome\r\n**Unverified outcome**\r\n## Problem (context)\r\nProblem ☁️\r\n## Domain tags\r\nprivacy\r\n');
  const before = structuredClone(brief), result = briefSummarySections(brief);
  assert.deepEqual(result.map(x => x.name), ['Problem', 'Proposed outcome']);
  assert.equal(result[0].text, 'Problem ☁️\r\n'); assert.equal(result[1].text, '**Unverified outcome**\r\n');
  assert.ok(result.every(x => x.state === 'present' && !x.truncated)); assert.deepEqual(brief, before);
  assert.equal(JSON.stringify(result).includes('privacy'), false);
});

test('missing, empty, duplicate and structurally unsafe sections are explicit rather than substituted', () => {
  assert.deepEqual(briefSummarySections(source('# Brief: Missing\n')).map(x => x.state), ['missing', 'missing']);
  assert.equal(briefSummarySections(source('# Brief: Empty\n## Problem\n\n## Proposed outcome\nOutcome'))[0].state, 'empty');
  assert.equal(briefSummarySections(source('# Brief: Duplicate\n## Problem\nOne\n## Problem\nTwo'))[0].state, 'ambiguous');
  for (const content of ['# Brief: One\n# Brief: Two\n## Problem\nBody', '# Brief: Fence\n## Problem\n```\nBody']) {
    assert.ok(briefSummarySections(source(content)).every(x => x.state === 'ambiguous' && x.text === ''));
  }
  const changed = source('# Brief: Bound\n## Problem\nActual body'); changed.document.sections[0].markdown = 'Invented body';
  assert.equal(briefSummarySections(changed)[0].state, 'ambiguous');
  for (const update of [{ bodyStart: -1 }, { end: 9999 }, { end: 0 }]) {
    const brief = source('# Brief: Bound\n## Problem\nActual body'); Object.assign(brief.document.sections[0], update);
    assert.equal(briefSummarySections(brief)[0].state, 'ambiguous');
  }
});

test('long excerpts are visibly bounded without splitting a surrogate pair or altering source bytes', () => {
  const brief = source('# Brief: Long\n## Problem\n' + 'x'.repeat(1599) + '😀 more\n## Proposed outcome\nOutcome');
  const result = briefSummarySections(brief); assert.equal(result[0].text, 'x'.repeat(1599));
  assert.equal(result[0].truncated, true); assert.equal(result[1].truncated, false);
  assert.ok(brief.document.sections[0].markdown.startsWith(result[0].text));
});

test('actual summary component renders inert exact text and distinguishes source claims from verified facts', async () => {
  const require = createRequire(import.meta.url);
  let compiled = (await transformWithOxc(readFileSync(new URL('../app/brief-summary.tsx', import.meta.url), 'utf8'),
    '/synthetic/brief-summary.tsx', { jsx: { runtime: 'automatic' } })).code;
  for (const specifier of ['react', 'react/jsx-runtime']) for (const quote of ['"', "'"]) compiled = compiled.replaceAll(`${quote}${specifier}${quote}`, JSON.stringify(pathToFileURL(require.resolve(specifier)).href));
  for (const quote of ['"', "'"]) compiled = compiled.replaceAll(`${quote}./brief-summary-sections${quote}`, JSON.stringify(new URL('../app/brief-summary-sections.ts', import.meta.url).href));
  const Component = (await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)).default;
  const brief = { ...source('# Brief: Source <script>\n## Problem\n<script>unsafe()</script> ![external](https://outside.invalid/x)\n## Proposed outcome\nI claim approval.'), revision: 'a'.repeat(40) };
  const html = renderToStaticMarkup(createElement(Component, { brief, clear: () => {} }));
  assert.doesNotMatch(html, /<script>|<img|href=/); assert.match(html, /&lt;script&gt;/);
  assert.match(html, /I claim approval\./); assert.match(html, /Not a status, measurement verification or approval/);
  assert.match(html, /Clear summary/); assert.match(html, /aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/);
});
