import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { candidateSavePreviewFixture } from './candidate-save-preview.fixture.ts';
import { describeCandidateSavePreview, verifyCandidateSavePreview } from '../src/candidate-save-preview-contracts.ts';
import { describeCandidateSaveDocuments, describeCandidateSaveReview } from '../src/candidate-save-review-contracts.ts';
import { planCandidateBundle } from '../src/candidate-bundle-contracts.ts';

test('package preview is reproducible across reconstruction and hands exact manifest/consent bytes to existing admission without an operation ID', async () => {
  const f = await candidateSavePreviewFixture(), p = f.prepared;
  assert.deepEqual(await describeCandidateSavePreview(f.previewInput, f.output, f.content.documents, f.lineage, f.destination, 'app:synthetic'), p);
  assert.deepEqual(await verifyCandidateSavePreview(f.previewInput, p.output, f.content.documents), p.output);
  assert.equal('operationId' in p.submission.bundle, false);
  const plan = await planCandidateBundle({ ...p.submission.bundle, operationId: randomUUID() }, p.submission.confirmation);
  assert.equal(plan.manifestDigest, p.output.manifestDigest); assert.equal(plan.pointerDigest, p.output.pointerDigest);
  assert.ok(plan.confirmationDigest); assert.equal(plan.files.length, 7);
  assert.equal(p.output.proposedConfirmation.bundleManifestDigest, p.output.manifestDigest);
  assert.deepEqual(p.output.manifest.lineage.editedDocuments, []);
  assert.equal(p.output.manifest.examReview.state, 'unreviewed');
  for (const k of ['saveConfirmed', 'operationCreated', 'savedToGit', 'executionAuthorized', 'gateSigned'] as const) assert.equal(p.output[k], false);
  assert.doesNotMatch(JSON.stringify(p.output), /Human-edited Exam|bundle-operations|00000000-0000-4000-8000-000000000000/);
});
test('human differences are computed from exact original bytes and invalidate Spec/Exam applicability without fabricating independent review', async () => {
  const f = await candidateSavePreviewFixture();
  for (const name of ['brief', 'spec', 'exam'] as const) {
    const docs = { ...f.content.documents, [name]: `${f.content.documents[name]}\nHuman change فارسی` };
    const review = await describeCandidateSaveReview(f.input, f.scope.subject, f.scope.branch, docs, f.evidence, f.binding);
    const input = { ...f.previewInput, reviewDigest: review.reviewDigest };
    const p = await describeCandidateSavePreview(input, review, docs, f.lineage, f.destination, 'app:synthetic');
    assert.deepEqual(p.output.manifest.lineage.editedDocuments, [name]);
    assert.equal(p.output.manifest.specConformance.state, name === 'exam' ? 'unreviewed' : 'stale');
    assert.equal(p.output.manifest.examReview.state, 'stale');
    assert.notEqual(p.output.manifest.bundleId, f.prepared.output.manifest.bundleId);
    await assert.rejects(verifyCandidateSavePreview(input, p.output, f.content.documents));
  }
});
test('changed lineage, profiles, lifecycle authority and service identity change the package identity', async () => {
  const f = await candidateSavePreviewFixture();
  for (const [lineage, destination, committer] of [
    [{ ...f.lineage, architect: { ...f.lineage.architect, configurationRevision: 'profile-r2' } }, f.destination, 'app:synthetic'],
    [{ ...f.lineage, originalDocuments: await describeCandidateSaveDocuments({ ...f.content.documents, brief: 'Older original' }) }, f.destination, 'app:synthetic'],
    [f.lineage, { ...f.destination, authorityDigest: '1'.repeat(64) }, 'app:synthetic'],
    [f.lineage, f.destination, 'app:other'],
  ] as const) {
    const p = await describeCandidateSavePreview(f.previewInput, f.output, f.content.documents, lineage, destination, committer);
    assert.notEqual(p.output.manifest.bundleId, f.prepared.output.manifest.bundleId);
    assert.notEqual(p.output.previewDigest, f.prepared.output.previewDigest);
  }
});
test('wrong destination, head, source, generation reference and extra authority fields fail closed', async () => {
  const f = await candidateSavePreviewFixture();
  for (const patch of [{ itemId: '0260-other' }, { repository: 'foreign' }, { branch: 'other' }, { expectedHead: 'a'.repeat(40) },
    { lifecycle: 'candidate-not-pulled' }, { purpose: 'candidate-revision', previousBundleDigest: '1'.repeat(64), lifecycle: 'candidate-not-pulled' },
    { saveAuthorized: true }, { relationship: { itemId: '0261-other', revision: f.output.expectedHead } }])
    await assert.rejects(describeCandidateSavePreview(f.previewInput, f.output, f.content.documents, f.lineage, { ...f.destination, ...patch }, 'app:synthetic'));
  for (const lineage of [{ ...f.lineage, operationId: randomUUID() }, { ...f.lineage, inputDigest: 'a'.repeat(64) },
    { ...f.lineage, source: { ...f.lineage.source, draftId: randomUUID() } },
    { ...f.lineage, source: { ...f.lineage.source, latestRevision: 2 } },
    { ...f.lineage, source: { ...f.lineage.source, revisionDigest: 'f'.repeat(64) } }])
    await assert.rejects(describeCandidateSavePreview(f.previewInput, f.output, f.content.documents, lineage, f.destination, 'app:synthetic'));
  for (const patch of [{ savedToGit: true }, { manifestDigest: '0'.repeat(64) }, { previewDigest: '0'.repeat(64) }])
    await assert.rejects(verifyCandidateSavePreview(f.previewInput, { ...f.prepared.output, ...patch }, f.content.documents));
});
test('linked new work, pre-pull corrections and amendment proposals bind their exact distinct lifecycle without canonical Spec/Exam writes', async () => {
  const f = await candidateSavePreviewFixture(2, true), brief = f.evidence.inventory[0]!;
  const target = { path: brief.path, revision: f.output.expectedHead, contentDigest: brief.contentDigest }, targetId = brief.targetId.slice('items/'.length);
  const create = async (action: 'new-linked' | 'extend-existing', patch: object, proposalId: string | null = null) => {
    const choice = { action, target, reason: 'Explicit direction after complete assessment.' };
    const review = await describeCandidateSaveReview({ ...f.input, choice }, f.scope.subject, f.scope.branch, f.content.documents, f.evidence, f.binding);
    const itemId = action === 'extend-existing' ? targetId : f.previewInput.itemId;
    return describeCandidateSavePreview({ ...f.previewInput, choice, itemId, proposalId, reviewDigest: review.reviewDigest }, review,
      f.content.documents, f.lineage, { ...f.destination, itemId, ...patch }, 'app:synthetic');
  };
  const linked = await create('new-linked', { relationship: { itemId: targetId, revision: target.revision } });
  assert.equal(linked.output.manifest.relationship?.itemId, targetId);
  await assert.rejects(create('new-linked', {}));
  await assert.rejects(create('extend-existing', {}));
  const correction = await create('extend-existing', { purpose: 'candidate-revision', previousBundleDigest: '1'.repeat(64), lifecycle: 'candidate-not-pulled',
    relationship: { itemId: '0300-related', revision: target.revision } });
  assert.equal(correction.output.manifest.relationship?.itemId, '0300-related');
  const proposalId = randomUUID(), amendment = { proposalId, target: { itemId: targetId, revision: target.revision }, parentProposalDigest: null };
  const proposed = await create('extend-existing', { purpose: 'amendment', lifecycle: 'existing-target-proposal-only', amendment });
  await assert.rejects(create('extend-existing', { purpose: 'amendment', lifecycle: 'existing-target-proposal-only', amendment }, proposalId),
    /unavailable|changed/, 'Selecting an existing proposal cannot be reinterpreted as creating its first pointer.');
  assert.equal(proposed.output.pointerPath, `items/${targetId}/proposals/${proposalId}.json`);
  const plan = await planCandidateBundle({ ...proposed.submission.bundle, operationId: randomUUID() }, proposed.submission.confirmation);
  assert.equal(plan.files.length, 6);
  assert.equal(plan.files.some(file => [`items/${targetId}/BRIEF.md`, `items/${targetId}/SPEC.md`, `items/${targetId}/EXAM.md`].includes(file.path)), false);
  const patch = { purpose: 'amendment', lifecycle: 'existing-target-proposal-only', previousBundleDigest: '2'.repeat(64),
    amendment: { ...amendment, parentProposalDigest: '3'.repeat(64) } };
  await assert.rejects(create('extend-existing', patch));
  const revised = await create('extend-existing', patch, proposalId);
  assert.equal(revised.output.manifest.previousBundleDigest, '2'.repeat(64));
  const legacy = await candidateSavePreviewFixture(2), source = legacy.evidence.inventory[0]!;
  const choice = { action: 'new-linked' as const, target: { path: source.path, revision: legacy.output.expectedHead, contentDigest: source.contentDigest }, reason: 'No implicit migration' };
  const review = await describeCandidateSaveReview({ ...legacy.input, choice }, legacy.scope.subject, legacy.scope.branch, legacy.content.documents, legacy.evidence, legacy.binding);
  await assert.rejects(describeCandidateSavePreview({ ...legacy.previewInput, choice, reviewDigest: review.reviewDigest }, review, legacy.content.documents, legacy.lineage, legacy.destination, 'app:synthetic'));
});
