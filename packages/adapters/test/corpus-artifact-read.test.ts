import assert from 'node:assert/strict';
import test from 'node:test';
import { createGitHubReader } from '../src/code-host/github.ts';
import { readCorpusArtifact } from '../src/code-host/corpus-artifact-read.ts';
import { fixture, binding, now } from './github-brief-fixture.ts';

function setup(t: { after(run: () => void): void }) {
  const git = fixture(t);
  git.add([{ path: 'intent/0001/BRIEF.md', content: '# Exact original\nفارسی 🌸\n' },
    { path: 'intent/0001/SPEC.md', content: '# Scope\nNo billing.\n' }, { path: 'private.txt', content: 'NOT IN CORPUS' }]);
  const reader = createGitHubReader(binding, { appJwt: async () => 'synthetic-app-jwt', fetch: git.transport, now: () => now });
  return { git, reader, revision: git.head() };
}

test('exact native inventory proves immutable membership once while each permitted artifact body is fetched and verified anew', async t => {
  const f = setup(t), inventory = await f.reader.readScopeInventory(f.revision), path = 'intent/0001/BRIEF.md';
  assert.ok(Object.isFrozen(inventory)); assert.ok(Object.isFrozen(inventory.entries));
  assert.ok(inventory.entries.every(Object.isFrozen));
  const ordinaryBefore = f.git.calls.length, ordinary = await f.reader.readArtifact(path, f.revision);
  assert.equal(f.git.calls.length - ordinaryBefore, 3);
  for (let i = 0; i < 2; i++) {
    const before = f.git.calls.length;
    assert.deepEqual(await readCorpusArtifact(f.reader, inventory, path, f.revision), ordinary);
    assert.equal(f.git.calls.length - before, 1);
    assert.match(f.git.calls.at(-1)!.path, /\/git\/blobs\//);
  }
  assert.equal(f.git.mutations(), 0);
});

test('copied, forged, foreign or mismatched inventories cannot bypass the native membership proof', async t => {
  const f = setup(t), inventory = await f.reader.readScopeInventory(f.revision), other = setup(t),
    foreign = await other.reader.readScopeInventory(other.revision), before = f.git.calls.length;
  for (const value of [null, {}, { ...inventory }, structuredClone(inventory), foreign])
    await assert.rejects(readCorpusArtifact(f.reader, value, 'intent/0001/BRIEF.md', f.revision));
  for (const path of ['private.txt', 'intent/0001', 'intent/0001/MISSING.md', '../private.txt'])
    await assert.rejects(readCorpusArtifact(f.reader, inventory, path, f.revision));
  await assert.rejects(readCorpusArtifact(f.reader, inventory, 'intent/0001/BRIEF.md', 'a'.repeat(40)));
  assert.equal(f.git.calls.length, before);
});

test('wrapped or replaced reader ports keep the full path and its receiver; property copies do not transfer private proof', async t => {
  const f = setup(t), inventory = await f.reader.readScopeInventory(f.revision);
  let calls = 0;
  const wrapped = { ...f.reader, readArtifact: Object.assign(async function (this: unknown, path: string, revision: string) {
    assert.strictEqual(this, wrapped); calls++; return f.reader.readArtifact(path, revision);
  }, { apply: async () => { throw new Error('forged invocation'); } }) };
  const before = f.git.calls.length;
  const result = await readCorpusArtifact(wrapped, inventory, 'intent/0001/BRIEF.md', f.revision);
  assert.equal(calls, 1); assert.equal(f.git.calls.length - before, 3); assert.match(result.content, /Exact original/);
  const replacedInventory = { ...f.reader, readScopeInventory: (revision: string) => f.reader.readScopeInventory(revision) };
  const next = f.git.calls.length;
  await readCorpusArtifact(replacedInventory, inventory, 'intent/0001/BRIEF.md', f.revision);
  assert.equal(f.git.calls.length - next, 3);
});

test('optimized blob reads retain byte integrity and deny corruption even after an earlier successful read', async t => {
  for (const mode of ['body', 'sha', 'size', 'encoding'] as const) {
    const f = setup(t), inventory = await f.reader.readScopeInventory(f.revision);
    await readCorpusArtifact(f.reader, inventory, 'intent/0001/BRIEF.md', f.revision);
    f.git.override((url, _init, value) => {
      if (!url.pathname.includes('/git/blobs/')) return value;
      return { ...value as object, ...(mode === 'body' ? { content: Buffer.from('SUBSTITUTED').toString('base64') }
        : mode === 'sha' ? { sha: 'a'.repeat(40) } : mode === 'size' ? { size: 0 } : { encoding: 'utf8' }) };
    });
    await assert.rejects(readCorpusArtifact(f.reader, inventory, 'intent/0001/BRIEF.md', f.revision));
    assert.equal(f.git.mutations(), 0);
  }
});
