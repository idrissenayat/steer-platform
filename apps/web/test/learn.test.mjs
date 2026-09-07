import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { compileLearn, decodeLearnSource } from '../scripts/prepare-learn.ts';
import { searchLearn } from '../app/learn-reader.ts';

const root = new URL('../../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const manifest = JSON.parse(read('kit/learn-manifest.json'));
const version = JSON.parse(read('kit/version.json'));

test('Learn uses all eight current canonical byte strings and their exact fingerprints', () => {
  const corpus = compileLearn(manifest, version, read);
  assert.equal(corpus.tag, version.tag); assert.equal(corpus.frameworkVersion, version.frameworkVersion);
  assert.equal(corpus.pages.length, 8);
  for (const page of corpus.pages) {
    assert.equal(page.raw, read(page.path));
    assert.deepEqual(Buffer.from(page.raw, 'utf8'), readFileSync(new URL(page.path, root)));
    assert.equal(page.contentDigest, createHash('sha256').update(read(page.path), 'utf8').digest('hex'));
    assert.ok(page.sections.length); assert.equal(new Set(page.sections.map(section => section.id)).size, page.sections.length);
  }
});

test('version drift fails before reading any source; no previous corpus fallback', () => {
  for (const changed of [{ ...version, tag: 'v0' }, { ...version, frameworkVersion: '0' }]) {
    assert.throws(() => compileLearn(manifest, changed, () => assert.fail('source read after invalid version')), /versions differ/);
  }
});

test('missing, duplicate, reordered and arbitrary source paths are rejected before I/O', () => {
  for (const documents of [manifest.documents.slice(1), [...manifest.documents].reverse(),
    manifest.documents.map((doc, index) => index === 1 ? { ...doc, id: manifest.documents[0].id } : doc),
    manifest.documents.map((doc, index) => index === 0 ? { ...doc, path: '../../secret' } : doc)]) {
    assert.throws(() => compileLearn({ ...manifest, documents }, version, () => assert.fail('unexpected source read')), /fixed operational canon/);
  }
});

test('missing, empty, oversized and ambiguous-anchor canon stops generation', () => {
  assert.throws(() => compileLearn(manifest, version, () => { throw new Error('missing source'); }), /missing source/);
  for (const raw of ['', ' ', 'é'.repeat(262145)]) assert.throws(() => compileLearn(manifest, version, () => raw), /missing or too large/);
  assert.throws(() => compileLearn(manifest, version, () => '# Title\n\n## Repeated\nOne\n\n## Repeated\nTwo'), /distinct anchors/);
  assert.throws(() => compileLearn(manifest, version, () => '# Title\n\n\ud800'), /exact UTF-8/);
  assert.throws(() => decodeLearnSource(new Uint8Array([0xff])));
  const bytes = Buffer.from('\ufeff# Unicode 日本語\r\n', 'utf8');
  assert.deepEqual(Buffer.from(decodeLearnSource(bytes), 'utf8'), bytes);
});

test('search covers canonical sections including list and table text, is bounded and returns valid targets', () => {
  const corpus = compileLearn(manifest, version, read);
  assert.deepEqual(searchLearn(corpus.pages, '   '), []);
  assert.deepEqual(searchLearn(corpus.pages, 'no-such-term-0192'), []);
  const hits = searchLearn(corpus.pages, ' AGENT '); assert.ok(hits.length > 0 && hits.length <= 12);
  for (const hit of hits) assert.ok(corpus.pages.find(page => page.id === hit.pageId)?.sections.some(section => section.id === hit.sectionId));
  assert.deepEqual(searchLearn(corpus.pages, 'a'.repeat(201)), searchLearn(corpus.pages, 'a'.repeat(200)));
  const pages = [{ id: 'example', title: 'Example', sections: [{ id: 'table', title: 'Reference', blocks: [
    { kind: 'table', headers: ['Hat'], rows: [['Builder']] }, { kind: 'list', items: ['Never signs'], ordered: false } ] }] }];
  assert.equal(searchLearn(pages, 'builder never').length, 1);
});

test('generated Learn bytes are deterministic and source changes change the fingerprint', () => {
  assert.deepEqual(compileLearn(manifest, version, read), compileLearn(manifest, version, read));
  const initial = compileLearn(manifest, version, read);
  const changed = compileLearn(manifest, version, path => read(path) + '\nSource change.\n');
  assert.notEqual(initial.pages[0].contentDigest, changed.pages[0].contentDigest);
  const config = read('turbo.json');
  for (const path of ['kit/learn-manifest.json', 'kit/version.json', 'kit/canon/**', 'kit/practices/**']) assert.ok(JSON.parse(config).globalDependencies.includes(path));
  const scripts = JSON.parse(read('apps/web/package.json')).scripts;
  for (const task of ['build', 'dev']) assert.ok(scripts[task].startsWith('node scripts/generate-learn.ts && '));
  assert.equal(scripts.typecheck, 'next typegen && node scripts/generate-learn.ts && tsc --noEmit');
  assert.equal(scripts.start, 'next start');
  assert.doesNotMatch(read('apps/web/next.config.ts'), /prepareLearn|generate-learn/);
});
