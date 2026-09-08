import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { buildIntentEvidenceEnvelope, validateIntentScopeAssessment } from '../src/intent-evidence-contracts.ts';

const contents = [
  '# Clinic\n\n## Out of scope\n\nSend patients appointment reminders.\n\n- Not for clinicians.\n',
  '# Account recovery\n\nAccount holders regain access using a recovery link sent to their inbox.\n',
];
const source = (content: string, n: number) => ({
  sourceId: `source-${n}`, targetId: `intent/${String(n).padStart(4, '0')}`,
  path: `intent/${String(n).padStart(4, '0')}/BRIEF.md`, status: 'canonical',
  contentDigest: createHash('sha256').update(content).digest('hex'),
  blobOid: createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex'),
});
const input = (values = contents) => ({
  organizationId: 'org', productId: 'product', repository: 'github:1', branch: 'main', head: 'a'.repeat(40),
  scopeInputDigest: 'b'.repeat(64), permissionsRevision: 'grants-r1', retrievalConfigurationRevision: 'full-docs-r1',
  inventoryComplete: true, accessGapCount: 0,
  inventory: values.map(source), documents: values.map((content, n) => ({ sourceId: `source-${n}`, content })),
});
const output = (envelope: Awaited<ReturnType<typeof buildIntentEvidenceEnvelope>>) => ({
  assessmentInputDigest: envelope.assessmentInputDigest, configurationRevision: 'review-r1',
  findings: envelope.evidence.map(ref => ({ targetId: ref.targetId, assessedSourceIds: [ref.sourceId],
    relation: 'related-distinct', overlapExplanation: 'Synthetic assessment fixture; not a model evaluation.',
    missingScopeExplanation: 'Synthetic explanation.',
    citations: [{ sourceId: ref.sourceId, startByte: ref.startByte, endByte: ref.endByte, quote: ref.content }],
  })),
});

test('whole-source evidence preserves ancestor headings, exclusions and lexical-miss paraphrases', async () => {
  const envelope = await buildIntentEvidenceEnvelope(input());
  assert.equal(envelope.evidence[0]!.content, contents[0]);
  assert.match(envelope.evidence[0]!.content, /## Out of scope\n\nSend patients/);
  assert.match(envelope.evidence[0]!.content, /Not for clinicians/);
  assert.match(envelope.evidence[1]!.content, /regain access using a recovery link/);
  assert.equal(envelope.coverage.complete, true);
  assert.equal(envelope.semanticReviewComplete, false); assert.equal(envelope.authoritativeClearance, false);
  assert.ok(Object.isFrozen(envelope.evidence[0]));
  // These assertions prove evidence preservation, not semantic classification.
});

test('UTF-8 ranges count bytes and exact quotations cannot split or normalize characters', async () => {
  const envelope = await buildIntentEvidenceEnvelope(input(['# فارسی\n\ncafé ☕\r\n']));
  assert.equal(envelope.evidence[0]!.endByte, Buffer.byteLength('# فارسی\n\ncafé ☕\r\n'));
  assert.equal(validateIntentScopeAssessment(envelope, output(envelope), 'review-r1').state, 'assessed-declared-scope');
  const split = output(envelope); split.findings[0]!.citations[0]!.endByte = 3;
  assert.throws(() => validateIntentScopeAssessment(envelope, split, 'review-r1'), /splits a UTF-8/);
  const normalized = output(envelope); normalized.findings[0]!.citations[0]!.quote = '# فارسی\n\ncafe\u0301 ☕\n';
  assert.throws(() => validateIntentScopeAssessment(envelope, normalized, 'review-r1'), /does not match/);
});

test('hash and Git blob validation rejects substituted content before returning evidence', async () => {
  for (const field of ['contentDigest', 'blobOid'] as const) {
    const fixture = input(); fixture.inventory[0]![field] = '0'.repeat(field === 'contentDigest' ? 64 : 40);
    await assert.rejects(buildIntentEvidenceEnvelope(fixture), /pinned reference/);
  }
  const fixture = input(); fixture.documents[0]!.content += '\n';
  await assert.rejects(buildIntentEvidenceEnvelope(fixture), /pinned reference/);
});

test('bounded batches never truncate context or silently classify missing sources as assessed', async () => {
  const fixture = input([contents[0]!, 'x'.repeat(32001)]);
  const envelope = await buildIntentEvidenceEnvelope(fixture);
  assert.equal(envelope.evidence.length, 1); assert.equal(envelope.coverage.complete, false);
  assert.deepEqual(envelope.coverage.gaps, [{ sourceId: 'source-1', reason: 'context-limit' }]);
  assert.equal(validateIntentScopeAssessment(envelope, output(envelope), 'review-r1').state, 'incomplete');
  const batch = await buildIntentEvidenceEnvelope(input(Array(5).fill('x'.repeat(32000))));
  assert.equal(batch.evidence.length, 4); assert.equal(batch.coverage.gaps[0]!.reason, 'batch-limit');
  const countLimit = await buildIntentEvidenceEnvelope(input(Array(33).fill('Small document.')));
  assert.equal(countLimit.evidence.length, 32); assert.equal(countLimit.coverage.complete, false);
});

test('missing, incomplete inventory and aggregate access gaps never become clearance', async () => {
  for (const change of [{ inventoryComplete: false }, { accessGapCount: 1 }, { documents: [] }]) {
    const envelope = await buildIntentEvidenceEnvelope({ ...input(), ...change });
    assert.equal(envelope.coverage.complete, false);
    const checked = validateIntentScopeAssessment(envelope, output(envelope), 'review-r1');
    assert.equal(checked.state, 'incomplete'); assert.equal(checked.authoritativeClearance, false);
  }
  const fixture = { ...input(), inaccessibleSourceIds: ['private-patient-records'] };
  await assert.rejects(buildIntentEvidenceEnvelope(fixture));
});

test('inventory ordering is stable and snapshot fingerprints change with every scope boundary', async () => {
  const fixture = input(); const envelope = await buildIntentEvidenceEnvelope(fixture);
  const reordered = await buildIntentEvidenceEnvelope({ ...fixture, inventory: [...fixture.inventory].reverse(), documents: [...fixture.documents].reverse() });
  assert.equal(reordered.assessmentInputDigest, envelope.assessmentInputDigest);
  for (const change of [{ head: 'c'.repeat(40) }, { scopeInputDigest: 'd'.repeat(64) }, { productId: 'different' },
    { organizationId: 'other' }, { repository: 'github:2' }, { branch: 'other' }, { permissionsRevision: 'rev2' },
    { retrievalConfigurationRevision: 'other' }, { inventoryComplete: false }, { accessGapCount: 1 }]) {
    assert.notEqual((await buildIntentEvidenceEnvelope({ ...fixture, ...change })).assessmentInputDigest, envelope.assessmentInputDigest);
  }
});

test('unknown and duplicate source IDs, paths and untrusted extra fields reject', async () => {
  const fixture = input();
  for (const change of [
    { inventory: [fixture.inventory[0], fixture.inventory[0]] },
    { inventory: [fixture.inventory[0], { ...fixture.inventory[1], path: fixture.inventory[0]!.path }] },
    { documents: [fixture.documents[0], fixture.documents[0]] },
    { documents: [{ sourceId: 'invented', content: 'text' }] },
    { inventory: [{ ...fixture.inventory[0], path: 'https://outside.invalid/BRIEF.md' }] },
    { inventory: [{ ...fixture.inventory[0], targetId: 'intent/9999' }] },
    { documents: [{ sourceId: 'source-0', content: '\ud800' }] }, { authorized: true },
  ]) await assert.rejects(buildIntentEvidenceEnvelope({ ...fixture, ...change }));
});

test('assessments reject stale bindings, invented citations, targets and invalid ranges', async () => {
  const envelope = await buildIntentEvidenceEnvelope(input());
  const check = (value: unknown) => validateIntentScopeAssessment(envelope, value, 'review-r1');
  for (const change of [{ assessmentInputDigest: '9'.repeat(64) }, { configurationRevision: 'old' }, { authoritativeClearance: true }]) {
    assert.throws(() => check({ ...output(envelope), ...change }));
  }
  for (const change of [{ sourceId: 'invented' }, { startByte: -1 }, { startByte: 8, endByte: 4 }, { endByte: 100000 }, { quote: 'invented text' }]) {
    const result = output(envelope); Object.assign(result.findings[0]!.citations[0]!, change); assert.throws(() => check(result));
  }
  const wrongTarget = output(envelope); wrongTarget.findings[0]!.targetId = 'intent/9999'; assert.throws(() => check(wrongTarget));
  const wrongSource = output(envelope); wrongSource.findings[0]!.assessedSourceIds = ['source-1']; assert.throws(() => check(wrongSource));
  const duplicate = output(envelope); duplicate.findings.push(duplicate.findings[0]!); assert.throws(() => check(duplicate));
});

test('unassessed and abstained evidence stays incomplete even when other findings have valid citations', async () => {
  const envelope = await buildIntentEvidenceEnvelope(input());
  const partial = output(envelope); partial.findings.pop();
  const checked = validateIntentScopeAssessment(envelope, partial, 'review-r1');
  assert.equal(checked.state, 'incomplete'); assert.deepEqual(checked.unassessedSourceIds, ['source-1']);
  const abstained = output(envelope); abstained.findings[0]!.relation = 'insufficient-evidence';
  assert.equal(validateIntentScopeAssessment(envelope, abstained, 'review-r1').state, 'incomplete');
});
