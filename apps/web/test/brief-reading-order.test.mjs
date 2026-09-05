import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import { arrangeBriefTree, briefReadingOrder } from '../app/brief-reading-order.ts';

const heading = (name, depth = 2) => ({ type: 'heading', depth, children: [{ type: 'text', value: name }] });
const body = (name) => ({ type: 'paragraph', children: [{ type: 'text', value: name }] });
const render = (source, plugin = true) => renderToStaticMarkup(createElement(Markdown, { remarkPlugins: plugin ? [briefReadingOrder] : [] }, source));
const stripNote = (html) => html.replace(/^<p class="brief-reading-note">[^<]*<\/p>\n/, '');

test('reading plan moves whole sections in judgment order, retaining node identity, preamble and unknown/duplicate-unknown content', () => {
  const names = ['Notes', 'Open questions', 'Affected users and systems', 'Domain tags', 'Sizing and scoping', 'Constraints', 'Outcome contract', 'Proposed outcome', 'Problem', 'Notes'];
  const original = [heading('Brief: Source', 1), body('Preamble'), ...names.flatMap((name, index) => [heading(name), body(`body-${index}`)])];
  const before = structuredClone(original); const result = arrangeBriefTree({ type: 'root', children: original });
  assert.equal(result.mode, 'review'); assert.deepEqual(original, before);
  assert.deepEqual(result.children.filter((node) => node.depth === 2).map((node) => node.children[0].value),
    ['Problem', 'Proposed outcome', 'Outcome contract', 'Constraints', 'Sizing and scoping', 'Domain tags', 'Affected users and systems', 'Open questions', 'Notes', 'Notes']);
  assert.equal(result.children.length, original.length); assert.equal(new Set(result.children).size, original.length);
  assert.ok(original.every((node) => result.children.includes(node)));
  for (let index = 2; index < result.children.length; index += 2) assert.equal(original.indexOf(result.children[index + 1]), original.indexOf(result.children[index]) + 1);
});

test('actual CommonMark rendering preserves Unicode, code fences, nested headings and missing sections without invented bodies', () => {
  const source = '# Brief: 日本語\r\n\r\n## Open questions\r\n\r\nQuestion?\r\n\r\n## Problem (context)\r\n\r\n```md\r\n## Constraints\r\n```\r\n\r\n> ## Quoted heading\r\n\r\n## Proposed outcome\r\n\r\n**Outcome**\r\n';
  const html = render(source);
  assert.ok(html.indexOf('<h2>Problem (context)') < html.indexOf('<h2>Proposed outcome'));
  assert.ok(html.indexOf('<h2>Proposed outcome') < html.indexOf('<h2>Open questions'));
  assert.match(html, /<code class="language-md">## Constraints/); assert.match(html, /<blockquote>/); assert.match(html, /<strong>Outcome<\/strong>/);
  assert.doesNotMatch(html, /<h2>Outcome contract/); assert.match(html, /日本語/);
});

test('ambiguous headings and reference definitions retain exactly the original rendered document after its UI note', () => {
  for (const source of ['# Brief: Source\n## Open questions\nQ\n## Problem\nOne\n## Problem\nTwo',
    '# Brief: Source\n## Open questions\nQ\n## **Problem**\nBody',
    '# Brief: First\n## Open questions\nQ\n# Brief: Second\n## Problem\nBody',
    '# Brief: Source\n## Open questions\n[x][ref]\n## Problem\n[ref]: https://first.example\n\n[ref]: https://second.example',
    '# Brief: Source\n## Open questions\nQ\n## Problem\n> [ref]: https://nested.example',
    'No title\n## Open questions\nQ\n## Problem\nBody']) {
    const rendered = render(source); assert.match(rendered, /original section order retained/);
    assert.equal(stripNote(rendered), render(source, false));
  }
});

test('presentation does not execute HTML, infer approval or omit unknown source sections', () => {
  const source = '# Brief: Source\n## Extra\n<script>alert(1)</script>\n\n## Open questions\nQuestion\n## Problem\nI claim approval.\n## Extra\nUnknown second body';
  const html = render(source); assert.doesNotMatch(html, /<script>/); assert.match(html, /&lt;script&gt;/);
  assert.match(html, /I claim approval\./); assert.match(html, /Unknown second body/);
  assert.equal((html.match(/<h2>Extra<\/h2>/g) ?? []).length, 2);
});

test('bounded tree inspection and section counts fall back without losing source nodes', () => {
  const cycle = body('cycle'); cycle.children.push(cycle);
  for (const children of [[heading('Brief', 1), cycle],
    [heading('Brief', 1), heading('Problem'), ...Array.from({ length: 128 }, (_, index) => heading(`Extra ${index}`))],
    [heading('Brief', 1), { type: 'paragraph', children: Array.from({ length: 100001 }, () => body('x')) }]]) {
    const result = arrangeBriefTree({ type: 'root', children });
    assert.equal(result.mode, 'source'); assert.deepEqual(result.children, children);
    assert.notEqual(result.children, children);
  }
  assert.throws(() => arrangeBriefTree(null), /Invalid Brief reading tree/);
});
