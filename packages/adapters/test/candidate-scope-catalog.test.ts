import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { planCandidateBundle } from '@steer/tool-registry/candidate-bundle-contracts';
import { createCandidateScopeCatalog } from '../src/code-host/candidate-scope-catalog.ts';
import { createGitHubReader, type DirectoryRepositoryReader } from '../src/code-host/github.ts';
import { fixture, binding, now } from './github-brief-fixture.ts';
import { bracketRepositoryRead } from '../src/code-host/repository-read-authority.ts';

const input = {
  organizationId: 'org', productId: 'product', repository: 'github:52', branch: binding.branch, itemId: '0007-booking',
  bundleId: '57762718-d38a-4926-b96d-7a1c40fdd6f7', operationId: '51f1f1c9-a4d6-435e-9d6e-9b773b8260bb',
  purpose: 'new-candidate', previousBundleDigest: null, amendment: null, relationship: null,
  originatorSubject: 'human', serviceCommitter: 'app:123', architectConfigurationRevision: 'a1', examConfigurationRevision: 't1',
  editedDocuments: [], scopeInputDigest: 'a'.repeat(64), sourceSnapshotDigest: 'b'.repeat(64), assessmentDigest: 'c'.repeat(64),
  dispositionDigest: 'd'.repeat(64), specConformance: 'unreviewed', examReview: 'unreviewed', expectedHead: 'e'.repeat(40),
  documents: { brief: '# Brief\nفارسی\n', spec: '# Spec\nCandidate scope\n', exam: '# Exam\nNOT RUN\n' },
};
const configuration = { organizationId: 'org', productId: 'product', repository: 'github:52', branch: binding.branch, itemIds: [input.itemId] };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const blob = (value: string) => createHash('sha1').update(`blob ${Buffer.byteLength(value)}\0`).update(value).digest('hex');
async function setup(t: { after(run: () => void): void }) {
  const git = fixture(t), plan = await planCandidateBundle({ ...input, expectedHead: git.head() });
  const revision = git.add(plan.files.map(file => ({ path: file.path, content: file.content })));
  const reader = createGitHubReader(binding, { appJwt: async () => 'synthetic-app-jwt', fetch: git.transport, now: () => now });
  const reference = { organizationId: 'org', productId: 'product', repository: 'github:52', branch: binding.branch, revision };
  return { git, plan, reader, reference,
    make: (authorize: () => Promise<void> = async () => {}, port: DirectoryRepositoryReader = reader) => createCandidateScopeCatalog(port, configuration, authorize) };
}

test('directory inventory stays inside the exact root and reports nonregular modes without reading bodies', async t => {
  const f = await setup(t);
  const revision = f.git.add([{ path: 'items/0007-booking-other/BRIEF.md', content: 'FOREIGN' },
    { path: 'items/0007-booking/link', content: 'target', mode: '120000' }, { path: 'items/0007-booking/run.sh', content: 'exit 0', mode: '100755' }]);
  const result = await f.reader.readDirectoryInventory('items/0007-booking', revision);
  assert.equal(result.revision, revision); assert.equal(result.root, 'items/0007-booking');
  assert.ok(result.entries.every(entry => entry.path === result.root || entry.path.startsWith(result.root + '/')));
  assert.equal(result.entries.find(entry => entry.path.endsWith('/link'))?.mode, '120000');
  assert.equal(result.entries.find(entry => entry.path.endsWith('/run.sh'))?.mode, '100755');
  assert.ok(f.git.calls.every(call => !call.path.includes('/git/blobs/')));
});

test('root, candidate and amendment sources stay distinct and do not imply lifecycle or duplicate authority', async t => {
  const f = await setup(t);
  const plan = await planCandidateBundle({ ...input, purpose: 'amendment', expectedHead: f.git.head(),
    bundleId: 'e2fe0069-6d88-427b-81e3-ff13dba59d45', operationId: '5b4a7a73-cade-4167-bb8f-5d3a6ccac0bc',
    amendment: { proposalId: '3b3f0b5d-1697-4622-9f62-40a2aa31d7d9', target: { itemId: input.itemId, revision: f.reference.revision }, parentProposalDigest: null },
    documents: { ...input.documents, spec: '# Spec\nProposed extra scope\n' } });
  const revision = f.git.add([...plan.files.map(file => ({ path: file.path, content: file.content })),
    { path: 'items/0007-booking/SPEC.md', content: '# Spec\nRoot framing scope\n' },
    { path: 'items/0007-booking/EXAM.md', content: 'CANONICAL_EXAM_MUST_NOT_BE_EXPOSED' }]);
  const result = await f.make().collect({ ...f.reference, revision });
  assert.deepEqual(result.groups.map(group => group.kind), ['root-scope', 'candidate', 'amendment']);
  assert.equal(result.documents.length, 6); assert.equal(result.coverage.sourceCoverageComplete, true);
  assert.equal(result.coverage.lifecycleSelectionComplete, false); assert.equal(result.authoritativeClearance, false);
  assert.equal(result.coverage.scope, 'configured-items-only'); assert.doesNotMatch(JSON.stringify(result), /CANONICAL_EXAM_MUST_NOT_BE_EXPOSED/);
  assert.ok(Object.isFrozen(result.documents[0])); assert.equal(f.git.mutations(), 0);
});

test('only current pointers materialize candidate documents; old bundle directories are not selected', async t => {
  const f = await setup(t);
  const next = await planCandidateBundle({ ...input, purpose: 'candidate-revision', previousBundleDigest: f.plan.manifestDigest,
    expectedHead: f.git.head(), bundleId: 'e2fe0069-6d88-427b-81e3-ff13dba59d45', operationId: '5b4a7a73-cade-4167-bb8f-5d3a6ccac0bc',
    documents: { ...input.documents, spec: '# Spec\nLatest candidate scope\n' } });
  const revision = f.git.add(next.files.map(file => ({ path: file.path, content: file.content })));
  const result = await f.make().collect({ ...f.reference, revision });
  assert.equal(result.groups.find(group => group.kind === 'candidate')?.manifestDigest, next.manifestDigest);
  assert.ok(result.documents.every(document => !document.path.includes(`/candidates/${input.bundleId}/`)));
  assert.ok(result.documents.some(document => document.content.includes('Latest candidate scope')));
  assert.ok(f.git.calls.every(call => !call.path.includes('/git/ref/heads/')));
});

test('malformed/missing proposal evidence and bad candidate pointers stay incomplete without fallback clearance', async t => {
  const f = await setup(t);
  const revision = f.git.add([{ path: 'items/0007-booking/CANDIDATE.json', content: '{invalid' },
    { path: 'items/0007-booking/proposals/not-a-uuid.json', content: '{}' },
    { path: 'items/0007-booking/proposals/3b3f0b5d-1697-4622-9f62-40a2aa31d7d9.json', content: '{}' }]);
  const result = await f.make().collect({ ...f.reference, revision });
  assert.equal(result.coverage.sourceCoverageComplete, false); assert.equal(result.authoritativeClearance, false);
  assert.ok(result.coverage.gaps.some(gap => gap.reason === 'malformed-proposal-path'));
  assert.equal(result.coverage.gaps.filter(gap => gap.reason === 'pointer-unverified').length, 2);
  assert.deepEqual(result.groups.map(group => group.kind), ['root-scope']);
});

test('missing root documents are explicit coverage gaps, not an empty new-intent result', async t => {
  const f = await setup(t);
  const revision = f.git.add([{ path: 'items/0007-booking/CANDIDATE.json', content: null }, { path: 'items/0007-booking/BRIEF.md', content: null }]);
  const result = await f.make().collect({ ...f.reference, revision });
  assert.deepEqual(result.groups, []); assert.equal(result.coverage.sourceCoverageComplete, false);
  assert.deepEqual(result.coverage.gaps.map(gap => gap.reason), ['missing-root-brief', 'missing-root-spec']);
});

test('truncated, duplicate, foreign or changed-tree inventory cannot be treated as verified sources', async t => {
  for (const patch of [{ truncated: true }, { sha: '0'.repeat(40) }]) {
    const f = await setup(t); f.git.override((url, _init, value) => url.pathname.includes('/git/trees/') ? { ...(value as object), ...patch } : value);
    const result = await f.make().collect(f.reference);
    assert.equal(result.coverage.inventoryComplete, false); assert.equal(result.documents.length, 0);
  }
  const f = await setup(t), original = await f.reader.readDirectoryInventory('items/0007-booking', f.reference.revision);
  for (const patch of [{ organizationId: 'other' }, { revision: '0'.repeat(40) }, { root: 'items/elsewhere' },
    { entries: [original.entries[0], original.entries[0]] },
    { entries: original.entries.filter(entry => entry.path !== original.root) },
    { entries: [{ ...original.entries[0], path: 'items/PRIVATE_FOREIGN_ITEM/BRIEF.md' }] }]) {
    const port = { ...f.reader, readDirectoryInventory: async () => ({ ...original, ...patch }) } as DirectoryRepositoryReader;
    const result = await f.make(async () => {}, port).collect(f.reference);
    assert.equal(result.coverage.inventoryComplete, false); assert.doesNotMatch(JSON.stringify(result), /PRIVATE_FOREIGN_ITEM/);
  }
});

test('nonregular pointers and body-to-inventory hash mismatches invalidate the candidate group', async t => {
  const f = await setup(t), original = await f.reader.readDirectoryInventory('items/0007-booking', f.reference.revision);
  for (const suffix of ['/CANDIDATE.json', '/MANIFEST.json', '/SPEC.md']) {
    const port = { ...f.reader, readDirectoryInventory: async () => ({ ...original,
      entries: original.entries.map(entry => entry.path.endsWith(suffix) ? { ...entry, objectSha: '0'.repeat(40) } : entry) }) };
    const result = await f.make(async () => {}, port).collect(f.reference);
    assert.equal(result.groups.some(group => group.kind === 'candidate'), false); assert.equal(result.coverage.sourceCoverageComplete, false);
  }
  const revision = f.git.add([{ path: 'items/0007-booking/CANDIDATE.json', content: 'target', mode: '120000' }]);
  const result = await f.make().collect({ ...f.reference, revision });
  assert.equal(result.coverage.sourceCoverageComplete, false);
});

test('foreign requests reject before I/O and revocation after reads withholds the entire collection', async t => {
  const f = await setup(t);
  for (const change of [{ organizationId: 'other' }, { productId: 'other' }, { repository: 'github:99' }, { branch: 'other' },
    { revision: 'main' }, { revision: f.reference.revision + '\n' }, { itemIds: ['unconfigured'] }, { authorized: true }]) {
    await assert.rejects(f.make().collect({ ...f.reference, ...change }), /could not be verified/);
  }
  assert.equal(f.git.calls.length, 0);
  let checks = 0;
  await assert.rejects(f.make(async () => { if (++checks > 3) throw new Error('PRIVATE_ERROR'); }).collect(f.reference),
    error => error instanceof Error && !error.message.includes('PRIVATE_ERROR'));
});

test('close suppresses hung inventory and overlapping collections do not enqueue work', async t => {
  const f = await setup(t); let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; }); let calls = 0;
  const port = { ...f.reader, readDirectoryInventory: async (): ReturnType<DirectoryRepositoryReader['readDirectoryInventory']> => {
    calls++; entered(); return new Promise(() => {});
  } };
  const catalog = f.make(async () => {}, port), result = assert.rejects(catalog.collect(f.reference));
  await started; await assert.rejects(catalog.collect(f.reference)); assert.equal(calls, 1);
  catalog.close(); await result; await assert.rejects(catalog.collect(f.reference)); assert.equal(calls, 1);
});

test('read cap leaves explicit unprocessed-item gaps and never issues more than 100 underlying reads', async t => {
  const f = await setup(t); let calls = 0;
  const content = '# Synthetic canonical scope\n', objectSha = blob(content);
  const port: DirectoryRepositoryReader = { ...f.reader,
    readDirectoryInventory: async (root, revision) => { calls++; return { organizationId: 'org', repositoryId: 52,
      revision, root, treeSha: 'a'.repeat(40), entries: [{ path: root, objectSha: 'a'.repeat(40), mode: '040000', type: 'tree' },
        ...['BRIEF', 'SPEC'].map(name => ({ path: `${root}/${name}.md`, objectSha, mode: '100644', type: 'blob' }))] }; },
    readArtifact: async (path, revision) => { calls++; return { organizationId: 'org', repositoryId: 52, revision,
      path, content, contentDigest: hash(content), blobSha: objectSha }; },
  };
  const itemIds = Array.from({ length: 100 }, (_, i) => `${String(i + 1).padStart(4, '0')}-example`);
  const catalog = createCandidateScopeCatalog(port, { ...configuration, itemIds }, async () => {});
  const result = await catalog.collect(f.reference);
  assert.equal(calls, 100); assert.equal(result.coverage.readLimitReached, true);
  assert.equal(result.coverage.sourceCoverageComplete, false); assert.equal(result.coverage.inventoryComplete, false);
  assert.ok(result.coverage.gaps.some(gap => gap.reason === 'read-limit'));
  calls = 0;
  const authorize = async () => {};
  const proven = { ...port,
    readArtifact: bracketRepositoryRead(authorize, port.readArtifact, () => {}),
    readDirectoryInventory: bracketRepositoryRead(authorize, port.readDirectoryInventory, () => {}),
  };
  const covered = await createCandidateScopeCatalog(proven, { ...configuration, itemIds }, authorize).collect(f.reference);
  assert.deepEqual(covered, result); assert.equal(calls, 100);
});

test('directory bounds, non-directory roots and malformed revisions fail without invented empty inventory', async t => {
  const f = await setup(t);
  await assert.rejects(f.reader.readDirectoryInventory('items/0007-booking', f.reference.revision + '\n'));
  assert.equal(f.git.calls.length, 0);
  const revision = f.git.add([{ path: 'items/0020-file', content: 'not a directory' }]);
  await assert.rejects(f.reader.readDirectoryInventory('items/0020-file', revision));
  f.git.override((url, _init, value) => {
    if (!url.pathname.includes('/git/trees/')) return value;
    const result = value as { tree: unknown[] };
    return { ...result, tree: [...result.tree, ...Array.from({ length: 1001 }, (_, index) => ({ path: `items/0007-booking/file-${index}`,
      mode: '100644', type: 'blob', sha: 'a'.repeat(40) }))] };
  });
  await assert.rejects(f.reader.readDirectoryInventory('items/0007-booking', revision));
});

test('catalog root reads omit only privately covered exact policy pairs and preserve identical catalog bytes', async t => {
  const f = await setup(t); let checks = 0, reads = 0;
  const authorize = async () => { checks++; };
  const port = { ...f.reader,
    readArtifact: bracketRepositoryRead(authorize, async (path: string, revision: string) => {
      reads++; return f.reader.readArtifact(path, revision);
    }, () => {}),
    readDirectoryInventory: bracketRepositoryRead(authorize, async (root: string, revision: string) => {
      reads++; return f.reader.readDirectoryInventory(root, revision);
    }, () => {}),
  };
  const result = await f.make(authorize, port).collect(f.reference), coveredChecks = checks, coveredReads = reads;
  checks = 0; reads = 0;
  const unknown = { ...port, readArtifact: (...args: [string, string]) => port.readArtifact(...args),
    readDirectoryInventory: (...args: [string, string]) => port.readDirectoryInventory(...args) };
  assert.deepEqual(await f.make(authorize, unknown).collect(f.reference), result);
  assert.equal(result.coverage.sourceCoverageComplete, true);
  assert.equal(reads, coveredReads); assert.equal(checks - coveredChecks, 2 * coveredReads);
});

test('catalog rejects nonvoid policy and unrelated policy denial even with privately bracketed read methods', async t => {
  const f = await setup(t); let reads = 0;
  const current = async () => {};
  const port = { ...f.reader, readDirectoryInventory: bracketRepositoryRead(current, async (root: string, revision: string) => {
    reads++; return f.reader.readDirectoryInventory(root, revision);
  }, () => {}) };
  await assert.rejects(f.make(async () => { throw new Error('PRIVATE'); }, port).collect(f.reference));
  await assert.rejects(f.make(async () => false as unknown as void, port).collect(f.reference));
  assert.equal(reads, 0); assert.equal(f.git.calls.length, 0);
});

test('catalog forwarding rejects replaced proven methods without using their former authority proof', async t => {
  const f = await setup(t); let replacementReads = 0;
  const authorize = async () => {};
  const replacement: DirectoryRepositoryReader['readArtifact'] = async (path, revision) => {
    replacementReads++; return f.reader.readArtifact(path, revision);
  };
  const port = { ...f.reader, readArtifact: bracketRepositoryRead(authorize, async (path: string, revision: string) => {
    const result = await f.reader.readArtifact(path, revision);
    if (path.endsWith('/CANDIDATE.json')) port.readArtifact = replacement;
    return result;
  }, () => {}) };
  const result = await f.make(authorize, port).collect(f.reference);
  assert.equal(result.coverage.sourceCoverageComplete, false); assert.equal(replacementReads, 0);
  assert.ok(result.coverage.gaps.some(gap => gap.reason === 'pointer-unverified'));
});
