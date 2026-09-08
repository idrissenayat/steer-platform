import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { planCandidateBundle } from '../src/candidate-bundle-contracts.ts';

const bundleId = '57762718-d38a-4926-b96d-7a1c40fdd6f7', operationId = '51f1f1c9-a4d6-435e-9d6e-9b773b8260bb';
const input = {
  organizationId: 'org', productId: 'product', repository: 'github:1', branch: 'main', itemId: '0007-booking',
  bundleId, operationId, purpose: 'new-candidate', previousBundleDigest: null, amendment: null, relationship: null,
  originatorSubject: 'human', serviceCommitter: 'app:123', architectConfigurationRevision: 'architect-r1', examConfigurationRevision: 'exam-r1',
  editedDocuments: [], scopeInputDigest: 'a'.repeat(64), sourceSnapshotDigest: 'b'.repeat(64),
  assessmentDigest: 'c'.repeat(64), dispositionDigest: 'd'.repeat(64), specConformance: 'unreviewed', examReview: 'unreviewed',
  expectedHead: 'e'.repeat(40), documents: { brief: ' # Brief\r\nفارسی\n', spec: '# Spec\nAC-01\n', exam: '# Exam\nNOT RUN\n' },
};
const digest = (content: string) => createHash('sha256').update(content).digest('hex');

test('new candidate plans exactly seven files and no canonical Spec, Exam or gate writes', async () => {
  const plan = await planCandidateBundle(input);
  const paths = plan.files.map(file => file.path);
  assert.equal(paths.length, 7); assert.equal(new Set(paths).size, 7);
  assert.ok(paths.includes(`items/0007-booking/candidates/${bundleId}/EXAM.md`));
  assert.ok(paths.includes('items/0007-booking/BRIEF.md')); assert.ok(paths.includes('items/0007-booking/CANDIDATE.json'));
  assert.ok(paths.includes(`.steer/authoring/bundle-operations/${operationId}.json`));
  assert.equal(paths.includes('items/0007-booking/SPEC.md'), false); assert.equal(paths.includes('items/0007-booking/EXAM.md'), false);
  assert.ok(plan.files.every(file => file.mode === 'create')); assert.equal(plan.requiredLifecycle, 'absent-item');
  assert.equal(plan.saved, false); assert.equal(plan.gateSigned, false); assert.equal(plan.executionAuthorized, false);
});

test('exact document bytes and manifest/pointer/receipt digests form a non-self-referential bundle', async () => {
  const plan = await planCandidateBundle(input);
  for (const file of plan.files) assert.equal(file.contentDigest, digest(file.content));
  const read = (suffix: string) => plan.files.find(file => file.path.endsWith(suffix))!;
  const manifest = JSON.parse(read('/MANIFEST.json').content), pointer = JSON.parse(read('/CANDIDATE.json').content);
  const receipt = JSON.parse(read(`/${operationId}.json`).content);
  assert.equal(manifest.documents.brief.contentDigest, digest(input.documents.brief));
  assert.equal(read('/candidates/' + bundleId + '/BRIEF.md').content, input.documents.brief);
  assert.equal(plan.files.find(file => file.path === 'items/0007-booking/BRIEF.md')!.content, input.documents.brief);
  assert.equal(pointer.manifestDigest, read('/MANIFEST.json').contentDigest);
  assert.equal(receipt.pointerDigest, read('/CANDIDATE.json').contentDigest);
  assert.equal(receipt.manifestDigest, plan.manifestDigest); assert.equal(receipt.inputDigest, plan.inputDigest);
  assert.equal(manifest.lineage.originatorSubject, 'human'); assert.equal(manifest.lineage.serviceCommitter, 'app:123');
  assert.equal('commit' in manifest, false); assert.equal('commit' in receipt, false); assert.equal('sourceText' in manifest, false);
  assert.ok(Object.isFrozen(plan.files[0]));
});

test('pre-pull revision adds an immutable bundle and only CAS-updates the root Brief and pointer', async () => {
  const plan = await planCandidateBundle({ ...input, purpose: 'candidate-revision', previousBundleDigest: 'f'.repeat(64),
    editedDocuments: ['brief'], specConformance: 'stale', examReview: 'stale' });
  assert.equal(plan.files.length, 7); assert.equal(plan.requiredPreviousBundleDigest, 'f'.repeat(64));
  assert.equal(plan.requiredLifecycle, 'candidate-not-pulled');
  assert.deepEqual(plan.files.filter(file => file.mode === 'compare-and-swap').map(file => file.path).sort(),
    ['items/0007-booking/BRIEF.md', 'items/0007-booking/CANDIDATE.json']);
});

test('amendments and corrections never overwrite canonical documents or the candidate pointer', async () => {
  const amendment = { proposalId: '3b3f0b5d-1697-4622-9f62-40a2aa31d7d9', target: { itemId: input.itemId, revision: input.expectedHead }, parentProposalDigest: null };
  const plan = await planCandidateBundle({ ...input, purpose: 'amendment', amendment });
  assert.equal(plan.files.length, 6); assert.equal(plan.requiredLifecycle, 'existing-target-proposal-only');
  assert.ok(plan.files.every(file => file.mode === 'create'));
  for (const name of ['BRIEF.md', 'SPEC.md', 'EXAM.md', 'CANDIDATE.json']) assert.equal(plan.files.some(file => file.path === `items/0007-booking/${name}`), false);
  const correction = await planCandidateBundle({ ...input, purpose: 'amendment', previousBundleDigest: 'f'.repeat(64),
    amendment: { ...amendment, parentProposalDigest: '9'.repeat(64) } });
  assert.deepEqual(correction.files.filter(file => file.mode === 'compare-and-swap').map(file => file.path), [`items/0007-booking/proposals/${amendment.proposalId}.json`]);
});

test('linked new candidate records its relation without changing the related item', async () => {
  const relationship = { itemId: '0002-existing', revision: 'f'.repeat(40) };
  const plan = await planCandidateBundle({ ...input, relationship });
  assert.equal(plan.files.some(file => file.path.startsWith('items/0002-existing/')), false);
  assert.deepEqual(JSON.parse(plan.files.find(file => file.path.endsWith('MANIFEST.json'))!.content).relationship, relationship);
});

test('input, document, destination and head changes alter the plan binding; transport retry is stable', async () => {
  const plan = await planCandidateBundle(input);
  assert.deepEqual(await planCandidateBundle(structuredClone(input)), plan);
  for (const change of [{ expectedHead: 'f'.repeat(40) }, { branch: 'other' }, { repository: 'github:2' },
    { operationId: '35e8c5a4-eccf-47f1-8f59-544625a5f29f' }, { dispositionDigest: '9'.repeat(64) },
    { documents: { ...input.documents, brief: input.documents.brief + ' ' } }]) {
    assert.notEqual((await planCandidateBundle({ ...input, ...change })).inputDigest, plan.inputDigest);
  }
});

test('arbitrary paths, authority claims, raw sources, missing content and false review states reject', async () => {
  for (const change of [{ itemId: '../0001' }, { itemId: '0007-booking/../../intent/0001' }, { bundleId: '../../EXAM.md' }, { bundleId: bundleId.toUpperCase() },
    { itemId: input.itemId + '\n' }, { bundleId: bundleId + '\n' }, { operationId: operationId + '\n' }, { expectedHead: input.expectedHead + '\n' },
    { operationId: 'https://outside.invalid' }, { paths: ['intent/0001/EXAM.md'] }, { signed: true }, { sourceText: 'private source' },
    { specConformance: 'approved' }, { examReview: 'current' }, { documents: { ...input.documents, exam: '' } },
    { documents: { ...input.documents, exam: '\ud800' } }, { documents: { brief: 'one file only' } },
    { documents: { ...input.documents, extra: 'unplanned file' } }]) await assert.rejects(planCandidateBundle({ ...input, ...change }));
});

test('invalid purpose, lineage and prior-state combinations cannot become plans', async () => {
  for (const change of [{ previousBundleDigest: 'f'.repeat(64) }, { purpose: 'candidate-revision' }, { purpose: 'amendment' },
    { editedDocuments: ['brief'], specConformance: 'unreviewed', examReview: 'stale' },
    { editedDocuments: ['spec'], specConformance: 'unreviewed', examReview: 'stale' },
    { editedDocuments: ['exam'], examReview: 'unreviewed' }, { editedDocuments: ['exam', 'exam'], examReview: 'stale' },
    { relationship: { itemId: input.itemId, revision: input.expectedHead } }]) await assert.rejects(planCandidateBundle({ ...input, ...change }));
});
