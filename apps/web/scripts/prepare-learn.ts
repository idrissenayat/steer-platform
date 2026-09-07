import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildLearnCorpus, validateLearnVersion, type LearnManifest } from '../../../packages/domain/src/learn.ts';

const root = new URL('../../../', import.meta.url);
const paths = ['kit/canon/methodology.md', 'kit/canon/framework.md', 'kit/canon/operating-model.md',
  'kit/practices/sizing-and-scoping.md', 'kit/practices/providing-intent.md', 'kit/practices/three-surfaces.md',
  'kit/canon/glossary.md', 'kit/canon/guidebook.md'];

export function decodeLearnSource(bytes: Uint8Array) {
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
}

/** Build-time only. No editable copy, runtime filesystem reader or user-selected path. */
export function compileLearn(manifest: LearnManifest, version: { frameworkVersion: string; tag: string }, read: (path: string) => string) {
  if (!validateLearnVersion(manifest, version).ok) throw new Error('Learn and kit versions differ.');
  if (manifest.documents.length !== paths.length || new Set(manifest.documents.map(doc => doc.id)).size !== paths.length ||
      manifest.documents.some((doc, index) => doc.path !== paths[index] || !/^[a-z][a-z-]+$/.test(doc.id))) {
    throw new Error('Learn requires the fixed operational canon.');
  }
  const sources = Object.fromEntries(manifest.documents.map(doc => {
    const raw = read(doc.path);
    if (!raw.trim() || Buffer.byteLength(raw, 'utf8') > 512 * 1024) throw new Error('Learn source missing or too large.');
    if (Buffer.from(raw, 'utf8').toString('utf8') !== raw) throw new Error('Learn source is not exact UTF-8.');
    return [doc.id, raw];
  }));
  const pages = buildLearnCorpus(manifest, sources).map(page => {
    if (!page.sections.length || new Set(page.sections.map(section => section.id)).size !== page.sections.length) {
      throw new Error('Learn sections must have distinct anchors.');
    }
    return { ...page, contentDigest: createHash('sha256').update(page.raw, 'utf8').digest('hex') };
  });
  return { frameworkVersion: version.frameworkVersion, tag: version.tag, pages };
}

export function prepareLearn() {
  const read = (path: string) => decodeLearnSource(readFileSync(new URL(path, root)));
  const corpus = compileLearn(JSON.parse(read('kit/learn-manifest.json')), JSON.parse(read('kit/version.json')), read);
  const directory = new URL('../app/generated/', import.meta.url);
  mkdirSync(directory, { recursive: true });
  const destination = new URL('learn.json', directory);
  const content = `${JSON.stringify(corpus)}\n`;
  let previous: string | undefined;
  try { previous = readFileSync(destination, 'utf8'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  if (previous !== content) writeFileSync(destination, content);
  return fileURLToPath(destination);
}
