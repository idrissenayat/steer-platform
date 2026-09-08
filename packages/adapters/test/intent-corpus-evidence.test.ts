import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createIntentCorpusEvidence, type CorpusSelectionContext } from '../src/code-host/intent-corpus-evidence.ts';
import { createGitHubReader } from '../src/code-host/github.ts';
import { verifyScopeInventory } from '../src/code-host/scope-inventory.ts';
import { planCandidateBundle } from '@steer/tool-registry/candidate-bundle-contracts';
import { fixture, binding, now } from './github-brief-fixture.ts';

const scope = { organizationId: 'org', productId: 'product', repository: 'github:52', branch: binding.branch };
const input = { ...scope, scopeInputDigest: 'a'.repeat(64) };
const config = { ...scope, retrievalConfigurationRevision: 'corpus-r1' };
const authorityDigest = 'd'.repeat(64);
async function setup(t: { after(run: () => void): void }) {
  const git = fixture(t), selections = new Map<string, string>(), denied = new Set<string>(); let permissionsRevision = 'p1';
  git.add([{ path: 'intent/0001/BRIEF.md', content: '# Legacy booking\nPatients book appointments.\n' },
    { path: 'intent/0001/SPEC.md', content: '# Scope\nOut of scope: billing.\n' },
    { path: 'intent/0001/EXAM.md', content: 'DO_NOT_READ_LEGACY_EXAM' },
    { path: 'items/0002-canonical/BRIEF.md', content: '# Billing\nHuman billing operations.\n' },
    { path: 'items/0002-canonical/SPEC.md', content: '# Scope\nOut of scope: booking.\n' }]);
  const reader = createGitHubReader(binding, { appJwt: async () => 'synthetic-app-jwt', fetch: git.transport, now: () => now });
  const authority = { authorize: async () => ({ permissionsRevision }),
    select: async (c: CorpusSelectionContext) => ({ ...c, selection: selections.get(c.root) ?? 'canonical', authorityDigest }),
    authorizeSource: async ({ path }: { path: string }) => { if (denied.has(path)) throw new Error('PRIVATE'); } };
  const service = createIntentCorpusEvidence(reader, config, authority); t.after(() => service.close());
  return { git, reader, authority, selections, denied, service, permissions: (v: string) => { permissionsRevision = v; } };
}
async function candidate(f: Awaited<ReturnType<typeof setup>>, purpose: 'new-candidate' | 'amendment', itemId = '0003-candidate') {
  const plan = await planCandidateBundle({ ...scope, itemId, bundleId: '57762718-d38a-4926-b96d-7a1c40fdd6f7', operationId: '51f1f1c9-a4d6-435e-9d6e-9b773b8260bb',
    purpose, previousBundleDigest: null, amendment: purpose === 'amendment' ? { proposalId: '3b3f0b5d-1697-4622-9f62-40a2aa31d7d9', target: { itemId, revision: f.git.head() }, parentProposalDigest: null } : null,
    relationship: null, originatorSubject: 'human', serviceCommitter: 'app:123', architectConfigurationRevision: 'a1', examConfigurationRevision: 't1', editedDocuments: [],
    scopeInputDigest: input.scopeInputDigest, sourceSnapshotDigest: 'b'.repeat(64), assessmentDigest: 'c'.repeat(64), dispositionDigest: 'd'.repeat(64),
    specConformance: 'unreviewed', examReview: 'unreviewed', expectedHead: f.git.head(),
    documents: { brief: '# Candidate\nNotification scope\n', spec: '# Scope\nEmail only. No SMS.\n', exam: '# Candidate Exam\nNOT RUN\n' } });
  f.git.add(plan.files.map(x => ({ path: x.path, content: x.content }))); return plan;
}
test('repository-wide inventory discovers both namespaces at one commit, not just configured items, without reading bodies', async t => {
  const f = await setup(t), inventory = verifyScopeInventory(await f.reader.readScopeInventory(f.git.head()));
  assert.deepEqual(inventory.roots.map(r => r.path), ['intent/0001', 'items/0002-canonical']);
  assert.equal(inventory.unsupportedRootCount, 0); assert.ok(f.git.calls.every(c => !c.path.includes('/git/blobs/')));
  assert.equal(f.git.mutations(), 0);
});
test('native Git corpus produces exact full-context legacy/canonical evidence and newly added candidate/amendment sources', async t => {
  const f = await setup(t); await candidate(f, 'new-candidate'); f.selections.set('items/0003-candidate', 'pre-pull-candidate');
  await candidate(f, 'amendment', '0002-canonical');
  const result = await f.service.collect(input, async () => {});
  assert.equal(result.evidence.head, f.git.head()); assert.equal(result.envelope.coverage.complete, true);
  assert.equal(result.coverage.enumeratedRootCount, 3); assert.equal(result.evidence.inventory.length, 8);
  assert.deepEqual(result.evidence.inventory.map(s => s.status).sort(), ['amendment', 'amendment', 'candidate', 'candidate', 'canonical', 'canonical', 'canonical', 'canonical']);
  assert.match(JSON.stringify(result), /Out of scope: billing|No SMS/); assert.doesNotMatch(JSON.stringify(result), /DO_NOT_READ_LEGACY_EXAM|Candidate Exam/);
  assert.equal(result.authoritativeClearance, false); assert.equal(result.semanticReviewComplete, false); assert.equal(f.git.mutations(), 0);
  assert.ok(Object.isFrozen(result.evidence.inventory[0]));
});
test('restricted and out-of-product roots are classified before source access; only aggregate gaps escape', async t => {
  const f = await setup(t);
  f.git.add([{ path: 'items/0008-private/BRIEF.md', content: 'PRIVATE-CONTENT' }, { path: 'items/0009-other/BRIEF.md', content: 'OTHER-PRODUCT' }]);
  f.selections.set('items/0008-private', 'inaccessible'); f.selections.set('items/0009-other', 'out-of-product');
  const source = f.reader.readArtifact, paths: string[] = [];
  f.reader.readArtifact = async (path, revision) => { paths.push(path); return source(path, revision); };
  const result = await f.service.collect(input, async () => {});
  assert.equal(result.evidence.accessGapCount, 1); assert.equal(result.coverage.excludedCount, 1); assert.equal(result.envelope.coverage.complete, false);
  assert.ok(paths.every(p => !p.includes('0008-private') && !p.includes('0009-other')));
  assert.doesNotMatch(JSON.stringify(result), /0008-private|0009-other|PRIVATE-CONTENT|OTHER-PRODUCT/);
});
test('missing Specs, unsupported roots, unverified lifecycle and source denial remain incomplete, never fallback newness', async t => {
  for (const mode of ['missing', 'unsupported', 'unresolved', 'denied', 'wrong-selection', 'pointer-conflict'] as const) {
    const f = await setup(t);
    if (mode === 'missing') f.git.add([{ path: 'intent/0001/SPEC.md', content: null }]);
    if (mode === 'unsupported') f.git.add([{ path: 'intent/unrecognized/BRIEF.md', content: '# Unknown' }]);
    if (mode === 'unresolved') f.selections.set('intent/0001', 'unresolved');
    if (mode === 'denied') f.denied.add('intent/0001/SPEC.md');
    if (mode === 'wrong-selection') f.authority.select = async c => ({ ...c, root: 'intent/9999', selection: 'canonical', authorityDigest });
    if (mode === 'pointer-conflict') await candidate(f, 'new-candidate'); // Claimed canonical while pre-pull pointer remains.
    const result = await f.service.collect(input, async () => {}); assert.equal(result.envelope.coverage.complete, false, mode);
    assert.equal(result.authoritativeClearance, false); assert.doesNotMatch(JSON.stringify(result), /PRIVATE|unrecognized/);
  }
});
test('changed head, selection, permission revision or late source access suppress the whole result', async t => {
  for (const mode of ['head', 'selection', 'permission', 'source'] as const) {
    const f = await setup(t), select = f.authority.select; let count = 0;
    f.authority.select = async c => {
      const selected = await select(c); count++;
      if (count === 3) {
        if (mode === 'head') f.git.add([{ path: 'unrelated.md', content: 'Head advanced' }]);
        if (mode === 'selection') return { ...selected, authorityDigest: 'e'.repeat(64) };
        if (mode === 'permission') f.permissions('p2');
        if (mode === 'source') f.denied.add('intent/0001/BRIEF.md');
      }
      return selected;
    };
    await assert.rejects(f.service.collect(input, async () => {}), /could not be verified/);
  }
});
test('corrupt/truncated trees and mismatched blobs cannot become complete corpus evidence', async t => {
  for (const mode of ['truncated', 'duplicate', 'ancestor', 'body'] as const) {
    const f = await setup(t);
    if (mode === 'body') {
      const read = f.reader.readArtifact; f.reader.readArtifact = async (p, r) => ({ ...await read(p, r), content: 'Substituted source' });
      assert.equal((await f.service.collect(input, async () => {})).envelope.coverage.complete, false); continue;
    }
    f.git.override((url, _init, value) => {
      if (!url.pathname.includes('/git/trees/')) return value;
      const tree = value as { tree: Array<{ path: string }> };
      return { ...tree, ...(mode === 'truncated' ? { truncated: true } : { tree: mode === 'duplicate' ? [...tree.tree, tree.tree[0]] : tree.tree.filter(e => e.path !== 'intent') }) };
    });
    await assert.rejects(f.service.collect(input, async () => {}));
  }
});
test('empty authorized namespaces remain a bounded declared corpus, not semantic uniqueness', async t => {
  const git = fixture(t), reader = createGitHubReader(binding, { appJwt: async () => 'synthetic-app-jwt', fetch: git.transport, now: () => now });
  const service = createIntentCorpusEvidence(reader, config, { authorize: async () => ({ permissionsRevision: 'p1' }), select: async () => assert.fail('No roots'), authorizeSource: async () => assert.fail('No files') });
  const result = await service.collect(input, async () => {}); assert.equal(result.envelope.coverage.complete, true); assert.equal(result.evidence.inventory.length, 0); assert.equal(result.semanticReviewComplete, false); service.close();
});
test('scope substitution and missing authority reject before I/O; close keeps a hung dependency from releasing or admitting another collection', async t => {
  const f = await setup(t); await assert.rejects(f.service.collect({ ...input, productId: 'other' }, async () => {})); assert.equal(f.git.calls.length, 0);
  let release!: () => void, entered!: () => void; const begun = new Promise<void>(r => { entered = r; });
  f.authority.authorize = async () => { entered(); await new Promise<void>(r => { release = r; }); return { permissionsRevision: 'p1' }; };
  const pending = assert.rejects(f.service.collect(input, async () => {})); await begun;
  await assert.rejects(f.service.collect(input, async () => {})); f.service.close(); await pending;
  release(); await Promise.resolve(); assert.equal(f.git.calls.length, 0);
});
test('bounded corpus exhaustion reports unresolved and unassessed coverage while preserving room for final head validation', async t => {
  const f = await setup(t), content = '# Existing scope\nOut of scope: billing\n';
  const contentDigest = createHash('sha256').update(content).digest('hex'), objectSha = createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex');
  const roots = Array.from({ length: 60 }, (_, i) => `intent/${String(i + 1).padStart(4, '0')}`);
  let bodyReads = 0, headReads = 0;
  const reader = { ...f.reader, readHead: async () => { headReads++; return f.git.head(); },
    readScopeInventory: async (revision: string) => ({ organizationId: 'org', repositoryId: 52, revision, treeSha: 'b'.repeat(40),
      entries: [{ path: 'intent', objectSha: 'c'.repeat(40), mode: '040000', type: 'tree' }, ...roots.flatMap(root => [
        { path: root, objectSha: 'd'.repeat(40), mode: '040000', type: 'tree' },
        ...['BRIEF', 'SPEC'].map(name => ({ path: `${root}/${name}.md`, objectSha, mode: '100644', type: 'blob' }))])] }),
    readArtifact: async (path: string, revision: string) => { bodyReads++; return { organizationId: 'org', repositoryId: 52, revision, path, content, contentDigest, blobSha: objectSha }; } };
  const service = createIntentCorpusEvidence(reader, config, f.authority);
  try {
    const result = await service.collect(input, async () => {});
    assert.equal(headReads, 2); assert.equal(bodyReads, 96); assert.equal(result.coverage.readLimitReached, true);
    assert.equal(result.coverage.enumeratedRootCount, 60); assert.equal(result.coverage.unresolvedCount, 12);
    assert.equal(result.envelope.coverage.complete, false); assert.equal(result.evidence.inventory.length, 96);
    assert.equal(result.envelope.coverage.includedCount, 32); assert.equal(result.envelope.coverage.gaps.length, 64);
  } finally { service.close(); }
});
test('a changed reader binding or foreign tree cannot relabel another repository as the authorized corpus', async t => {
  const f = await setup(t), reader = { ...f.reader, binding: { ...f.reader.binding } };
  const service = createIntentCorpusEvidence(reader, config, f.authority);
  reader.binding.repositoryId = 99;
  await assert.rejects(service.collect(input, async () => {})); assert.equal(f.git.calls.length, 0); service.close();
  const original = f.reader.readScopeInventory;
  f.reader.readScopeInventory = async revision => ({ ...await original(revision), repositoryId: 99 });
  await assert.rejects(f.service.collect(input, async () => {}));
});
test('elapsed monotonic deadline blocks I/O even before a delayed timer callback can run', async t => {
  const f = await setup(t); let clock = 0; t.mock.method(performance, 'now', () => clock);
  f.authority.authorize = async () => { clock = 30001; return { permissionsRevision: 'p1' }; };
  await assert.rejects(f.service.collect(input, async () => {})); assert.equal(f.git.calls.length, 0);
});
