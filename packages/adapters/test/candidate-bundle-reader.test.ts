import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { planCandidateBundle } from '@steer/tool-registry/candidate-bundle-contracts';
import { createCandidateBundleReader } from '../src/code-host/candidate-bundle-reader.ts';
import { createGitHubReader, type ArtifactReader } from '../src/code-host/github.ts';
import { fixture, binding, now } from './github-brief-fixture.ts';

const input = {
  organizationId: 'org', productId: 'product', repository: 'github:52', branch: binding.branch, itemId: '0007-booking',
  bundleId: '57762718-d38a-4926-b96d-7a1c40fdd6f7', operationId: '51f1f1c9-a4d6-435e-9d6e-9b773b8260bb',
  purpose: 'new-candidate', previousBundleDigest: null, amendment: null, relationship: null,
  originatorSubject: 'human', serviceCommitter: 'app:123', architectConfigurationRevision: 'architect-r1', examConfigurationRevision: 'exam-r1',
  editedDocuments: [], scopeInputDigest: 'a'.repeat(64), sourceSnapshotDigest: 'b'.repeat(64),
  assessmentDigest: 'c'.repeat(64), dispositionDigest: 'd'.repeat(64), specConformance: 'unreviewed', examReview: 'unreviewed',
  expectedHead: 'e'.repeat(40), documents: { brief: '\ufeff# Brief\r\nفارسی\n', spec: '# Spec\nAC-01\n', exam: '# Exam\nNOT RUN\n' },
};
const config = { organizationId: 'org', productId: 'product', repository: 'github:52', branch: binding.branch, itemIds: [input.itemId] };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
async function setup(t: { after(run: () => void): void }) {
  const git = fixture(t), plan = await planCandidateBundle({ ...input, expectedHead: git.head() });
  const revision = git.add(plan.files.map(file => ({ path: file.path, content: file.content })));
  const reader = createGitHubReader(binding, { appJwt: async () => 'synthetic-app-jwt', fetch: git.transport, now: () => now });
  const reference = { organizationId: 'org', productId: 'product', repository: 'github:52', branch: binding.branch,
    itemId: input.itemId, bundleId: input.bundleId, revision, manifestDigest: plan.manifestDigest };
  const pointer = { organizationId: 'org', productId: 'product', repository: 'github:52', branch: binding.branch,
    itemId: input.itemId, revision, proposalId: null };
  return { git, plan, reader, reference, pointer, make: (authorize: () => Promise<void> = async () => {}, port: ArtifactReader = reader) =>
    createCandidateBundleReader(port, config, authorize) };
}

test('native Git-backed adapter reads exact three-document bytes including BOM, CRLF and Unicode', async t => {
  const f = await setup(t); let checks = 0;
  const result = await f.make(async () => { checks++; }).reopen(f.reference);
  assert.deepEqual(result.documents, input.documents); assert.deepEqual(result.reference, f.reference);
  assert.equal(result.verification, 'exact-commit-bytes'); assert.equal(result.executionAuthorized, false);
  assert.ok(Object.isFrozen(result.documents)); assert.ok(checks >= 9);
  assert.equal(f.git.mutations(), 0); assert.equal(f.git.approvals(), 0);
  assert.ok(f.git.calls.every(call => call.method === 'GET' || call.path.endsWith('/access_tokens')));
});

test('historical reopen never follows the latest pointer or substitutes newer content', async t => {
  const f = await setup(t);
  const next = await planCandidateBundle({ ...input, purpose: 'candidate-revision', previousBundleDigest: f.plan.manifestDigest,
    expectedHead: f.git.head(), bundleId: 'e2fe0069-6d88-427b-81e3-ff13dba59d45', operationId: '5b4a7a73-cade-4167-bb8f-5d3a6ccac0bc',
    documents: { ...input.documents, brief: '# Changed newer Brief\n' } });
  const revision = f.git.add(next.files.map(file => ({ path: file.path, content: file.content })));
  assert.deepEqual((await f.make().reopen(f.reference)).documents, input.documents);
  const current = await f.make().readPointer({ ...f.pointer, revision });
  assert.equal(current.documents.brief, '# Changed newer Brief\n');
  assert.equal(current.reference.manifestDigest, next.manifestDigest);
  assert.equal(current.reference.revision, revision);
  assert.ok(f.git.calls.every(call => !call.path.includes('/git/ref/heads/')));
});

test('current candidate pointer verifies its manifest, all artifacts and matching root Brief', async t => {
  const f = await setup(t), result = await f.make().readPointer(f.pointer);
  assert.equal(result.manifest.purpose, 'new-candidate'); assert.deepEqual(result.documents, input.documents);
  const revision = f.git.add([{ path: 'items/0007-booking/BRIEF.md', content: '# Changed out of band\n' }]);
  await assert.rejects(f.make().readPointer({ ...f.pointer, revision }), /could not be verified/);
  assert.deepEqual((await f.make().reopen(f.reference)).documents, input.documents);
});

test('proposal reads expose amendments without reading or changing canonical Exam or Spec', async t => {
  const f = await setup(t), proposalId = '3b3f0b5d-1697-4622-9f62-40a2aa31d7d9';
  const plan = await planCandidateBundle({ ...input, purpose: 'amendment', expectedHead: f.git.head(),
    bundleId: 'e2fe0069-6d88-427b-81e3-ff13dba59d45', operationId: '5b4a7a73-cade-4167-bb8f-5d3a6ccac0bc',
    amendment: { proposalId, target: { itemId: input.itemId, revision: f.reference.revision }, parentProposalDigest: null } });
  const revision = f.git.add(plan.files.map(file => ({ path: file.path, content: file.content })));
  const paths: string[] = [];
  const port = { ...f.reader, readArtifact: async (path: string, commit: string) => { paths.push(path); return f.reader.readArtifact(path, commit); } };
  const result = await f.make(async () => {}, port).readPointer({ ...f.pointer, revision, proposalId });
  assert.equal(result.manifest.purpose, 'amendment'); assert.equal(result.manifest.target?.revision, f.reference.revision);
  assert.equal(f.git.mutations(), 0);
  assert.equal(paths.length, 5);
  for (const name of ['BRIEF.md', 'SPEC.md', 'EXAM.md', 'CANDIDATE.json']) assert.equal(paths.includes(`items/0007-booking/${name}`), false);
});

test('foreign scope, newline/traversal paths, moving revisions and extra authority reject before provider I/O', async t => {
  const f = await setup(t);
  for (const change of [{ organizationId: 'other' }, { productId: 'other' }, { repository: 'github:99' }, { branch: 'other' },
    { itemId: '0008-unconfigured' }, { itemId: '0007-booking\n' }, { itemId: '../0001' }, { bundleId: '../../EXAM.md' },
    { revision: 'main' }, { revision: f.reference.revision + '\n' }, { manifestDigest: f.reference.manifestDigest + '\n' }, { authorized: true }]) {
    await assert.rejects(f.make().reopen({ ...f.reference, ...change }), /could not be verified/);
  }
  assert.equal(f.git.calls.length, 0);
});

test('missing, malformed or wrong-digest pointer never falls back to canonical files', async t => {
  for (const content of [null, '{invalid JSON', '{"kind":"wrong-version"}']) {
    const f = await setup(t), revision = f.git.add([{ path: 'items/0007-booking/CANDIDATE.json', content }]);
    await assert.rejects(f.make().readPointer({ ...f.pointer, revision }), /could not be verified/);
  }
  const f = await setup(t);
  const pointer = JSON.parse(f.plan.files.find(file => file.path.endsWith('/CANDIDATE.json'))!.content);
  pointer.manifestDigest = '0'.repeat(64);
  const revision = f.git.add([{ path: 'items/0007-booking/CANDIDATE.json', content: JSON.stringify(pointer) }]);
  await assert.rejects(f.make().readPointer({ ...f.pointer, revision }), /could not be verified/);
});

test('malicious manifests, wrong home and canonical paths reject even when their hash is supplied', async t => {
  for (const change of [{ documents: { brief: { path: '../../intent/0001/EXAM.md', contentDigest: 'a'.repeat(64) } } },
    { organizationId: 'other' }, { productId: 'other' }, { bundleId: 'e2fe0069-6d88-427b-81e3-ff13dba59d45' },
    { gateSigned: true }, { sourceText: 'private data must not enter manifests' }, { examReview: { state: 'approved' } }]) {
    const f = await setup(t), path = `items/0007-booking/candidates/${input.bundleId}/MANIFEST.json`;
    const manifest = JSON.parse(f.plan.files.find(file => file.path === path)!.content);
    const content = JSON.stringify({ ...manifest, ...change }), revision = f.git.add([{ path, content }]);
    await assert.rejects(f.make().reopen({ ...f.reference, revision, manifestDigest: hash(content) }), /could not be verified/);
  }
});

test('missing, changed and symlink document bytes never become a partial successful bundle', async t => {
  for (const entry of [{ content: null }, { content: 'changed content' }, { content: 'target', mode: '120000' }]) {
    const f = await setup(t), path = `items/0007-booking/candidates/${input.bundleId}/EXAM.md`;
    const revision = f.git.add([{ path, ...entry }]);
    await assert.rejects(f.make().reopen({ ...f.reference, revision }), /could not be verified/);
  }
});

test('substituted reader revision, path, hashes and tenant reject before publication', async t => {
  const f = await setup(t);
  for (const patch of [{ revision: '0'.repeat(40) }, { path: 'other' }, { contentDigest: '0'.repeat(64) },
    { blobSha: '0'.repeat(40) }, { organizationId: 'other' }, { repositoryId: 99 }, { content: 'changed' }]) {
    const port = { ...f.reader, readArtifact: async (path: string, revision: string) => ({ ...await f.reader.readArtifact(path, revision), ...patch }) };
    await assert.rejects(f.make(async () => {}, port).reopen(f.reference), /could not be verified/);
  }
});

test('authorization denial before and after reads and permanent close suppress all content', async t => {
  const f = await setup(t), denied = f.make(async () => { throw new Error('PRIVATE_DENIAL_DETAIL'); });
  await assert.rejects(denied.reopen(f.reference), error => error instanceof Error && !error.message.includes('PRIVATE_DENIAL_DETAIL'));
  assert.equal(f.git.calls.length, 0);
  let checks = 0;
  await assert.rejects(f.make(async () => { if (++checks === 2) throw new Error('revoked'); }).reopen(f.reference));
  const closed = f.make(); closed.close(); const count = f.git.calls.length;
  await assert.rejects(closed.reopen(f.reference)); assert.equal(f.git.calls.length, count);
});

test('per-request identity checks cannot replace source authority and non-void authority results fail closed', async t => {
  const f = await setup(t); let current = 0, authority = 0;
  const reader = f.make(async () => { authority++; });
  await assert.rejects(reader.reopen(f.reference, async () => { if (++current === 2) throw new Error('PRIVATE revoked'); }));
  assert.equal(authority, 1); assert.equal(f.git.calls.length, 0);
  const invalid = f.make((async () => true) as unknown as () => Promise<void>);
  await assert.rejects(invalid.reopen(f.reference, async () => {})); assert.equal(f.git.calls.length, 0);
  reader.close(); invalid.close();
});

test('close ends a stalled wait and suppresses its later response without a retry', async t => {
  const f = await setup(t); let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const snapshot = await f.reader.readArtifact(`items/0007-booking/candidates/${input.bundleId}/MANIFEST.json`, f.reference.revision);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  const port: ArtifactReader = { ...f.reader, readArtifact: async () => { calls++; entered(); await held; return snapshot; } };
  const reader = f.make(async () => {}, port), result = assert.rejects(reader.reopen(f.reference));
  await started; reader.close(); await result;
  release(); await Promise.resolve();
  assert.equal(calls, 1);
});

test('four in-flight operations bound admission without queueing extra authorization or read work', async t => {
  const f = await setup(t); let checks = 0, reached!: () => void;
  const started = new Promise<void>(resolve => { reached = resolve; });
  const reader = f.make(async () => { if (++checks === 4) reached(); await new Promise(() => {}); });
  const pending = Array.from({ length: 4 }, () => assert.rejects(reader.reopen(f.reference)));
  await started;
  await assert.rejects(reader.reopen(f.reference)); assert.equal(checks, 4); assert.equal(f.git.calls.length, 0);
  reader.close(); await Promise.all(pending);
});

test('settled operations release admission and the reader does not cache returned bundles', async t => {
  const f = await setup(t);
  const files = f.plan.files.filter(file => file.path.includes('/candidates/'));
  const snapshots = new Map(await Promise.all(files.map(async file => [file.path, await f.reader.readArtifact(file.path, f.reference.revision)] as const)));
  let calls = 0;
  const port = { ...f.reader, readArtifact: async (path: string) => { calls++; return snapshots.get(path)!; } };
  const reader = f.make(async () => {}, port);
  for (let i = 0; i < 6; i++) assert.deepEqual((await reader.reopen(f.reference)).documents, input.documents);
  assert.equal(calls, 24); reader.close();
});
