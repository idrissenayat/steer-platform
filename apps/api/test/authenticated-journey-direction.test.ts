import assert from 'node:assert/strict';
import test from 'node:test';
import { scopeReviewFixture } from '../../../packages/tool-registry/test/intent-scope-review.fixture.ts';
import { authenticatedJourneyChoice, authenticatedJourneyItem, type AuthenticatedJourneyDirection } from './authenticated-journey-direction.fixture.ts';

test('authenticated direction binds the exact versioned Brief at the current evidence head, not its root mirror', async () => {
  const f = await scopeReviewFixture(4, true);
  const target = f.evidence.inventory.find(source => source.path === 'items/0002-existing/BRIEF.md')!;
  target.status = 'candidate'; target.path = 'items/0002-existing/candidates/57762718-d38a-4926-b96d-7a1c40fdd6f7/BRIEF.md';
  const choice = authenticatedJourneyChoice('candidate-revision', f.evidence);
  assert.equal(authenticatedJourneyItem('candidate-revision'), '0002-existing'); assert.equal(choice.action, 'extend-existing');
  assert.ok('target' in choice); assert.deepEqual(choice.target, { path: target.path, revision: f.evidence.head, contentDigest: target.contentDigest });
  const changed = authenticatedJourneyChoice('candidate-revision', { ...f.evidence, head: 'f'.repeat(40) });
  assert.ok('target' in changed); assert.equal(changed.target.revision, 'f'.repeat(40));
});
test('missing, ambiguous or noncandidate target cannot silently become new distinct work', async () => {
  const f = await scopeReviewFixture(4, true), target = f.evidence.inventory[2]!;
  for (const direction of ['candidate-revision', 'new-linked'] as const) assert.throws(() => authenticatedJourneyChoice(direction, f.evidence));
  target.status = 'candidate';
  for (const direction of ['candidate-revision', 'new-linked'] as const) assert.throws(() => authenticatedJourneyChoice(direction, f.evidence));
  target.path = 'items/0002-existing/candidates/57762718-d38a-4926-b96d-7a1c40fdd6f7/BRIEF.md';
  for (const direction of ['candidate-revision', 'new-linked'] as const)
    assert.throws(() => authenticatedJourneyChoice(direction, { ...f.evidence, inventory: [...f.evidence.inventory, { ...target, sourceId: 'ambiguous' }] }));
  assert.throws(() => authenticatedJourneyItem('unknown' as AuthenticatedJourneyDirection));
  const distinct = authenticatedJourneyChoice('new-distinct', f.evidence);
  assert.equal(authenticatedJourneyItem('new-distinct'), '0273-synthetic'); assert.equal(distinct.action, 'new-distinct'); assert.equal('target' in distinct, false);
});
test('new-linked keeps its exact reviewed target separate from the new destination and from revision intent', async () => {
  const f = await scopeReviewFixture(4, true), target = f.evidence.inventory[2]!;
  target.status = 'candidate'; target.path = 'items/0002-existing/candidates/57762718-d38a-4926-b96d-7a1c40fdd6f7/BRIEF.md';
  const linked = authenticatedJourneyChoice('new-linked', f.evidence), revision = authenticatedJourneyChoice('candidate-revision', f.evidence);
  assert.equal(linked.action, 'new-linked'); assert.ok('target' in linked && 'target' in revision);
  assert.deepEqual(linked.target, { path: target.path, revision: f.evidence.head, contentDigest: target.contentDigest });
  assert.deepEqual(linked.target, revision.target); assert.notEqual(linked.reason, revision.reason);
  assert.equal(authenticatedJourneyItem('new-linked'), '0281-linked');
  assert.notEqual(authenticatedJourneyItem('new-linked'), authenticatedJourneyItem('candidate-revision'));
  const refreshed = authenticatedJourneyChoice('new-linked', { ...f.evidence, head: 'f'.repeat(40) });
  assert.ok('target' in refreshed); assert.equal(refreshed.target.revision, 'f'.repeat(40));
  assert.equal(linked.target.revision, f.evidence.head, 'A later choice cannot mutate the earlier reviewed revision.');
});
test('first amendment explicitly selects the canonical Brief and current reviewed commit without a new-item fallback', async () => {
  const f = await scopeReviewFixture(6, true), target = f.evidence.inventory.find(source => source.path === 'items/0003-existing/BRIEF.md')!;
  const choice = authenticatedJourneyChoice('first-amendment', f.evidence);
  assert.equal(authenticatedJourneyItem('first-amendment'), '0003-existing'); assert.equal(choice.action, 'extend-existing');
  assert.ok('target' in choice); assert.deepEqual(choice.target, { path: target.path, revision: f.evidence.head, contentDigest: target.contentDigest });
  const later = authenticatedJourneyChoice('first-amendment', { ...f.evidence, head: 'f'.repeat(40) });
  assert.ok('target' in later); assert.equal(later.target.revision, 'f'.repeat(40)); assert.equal(choice.target.revision, f.evidence.head);
  for (const inventory of [f.evidence.inventory.filter(source => source !== target),
    [...f.evidence.inventory, { ...target, sourceId: 'ambiguous-canonical' }],
    f.evidence.inventory.map(source => source === target ? { ...source, status: 'candidate' } : source),
    f.evidence.inventory.map(source => source === target ? { ...source, path: 'items/0003-existing/candidates/57762718-d38a-4926-b96d-7a1c40fdd6f7/BRIEF.md' } : source)])
    assert.throws(() => authenticatedJourneyChoice('first-amendment', { ...f.evidence, inventory }));
});
test('proposal continuation reviews the current canonical target, never substitutes the prior proposal body or another item', async () => {
  const f = await scopeReviewFixture(6, true), target = f.evidence.inventory.find(source => source.path === 'items/0001-existing/BRIEF.md')!;
  const choice = authenticatedJourneyChoice('proposal-continuation', f.evidence);
  assert.equal(authenticatedJourneyItem('proposal-continuation'), '0001-existing'); assert.equal(choice.action, 'extend-existing');
  assert.ok('target' in choice); assert.deepEqual(choice.target, { path: target.path, revision: f.evidence.head, contentDigest: target.contentDigest });
  const later = authenticatedJourneyChoice('proposal-continuation', { ...f.evidence, head: 'f'.repeat(40) });
  assert.ok('target' in later); assert.equal(later.target.revision, 'f'.repeat(40)); assert.equal(choice.target.revision, f.evidence.head);
  for (const inventory of [f.evidence.inventory.filter(source => source !== target),
    [...f.evidence.inventory, { ...target, sourceId: 'ambiguous-continuation' }],
    ...['candidate', 'amendment'].map(status => f.evidence.inventory.map(source => source === target ? { ...source, status } : source)),
    f.evidence.inventory.map(source => source === target ? { ...source, path: 'items/0001-existing/candidates/57762718-d38a-4926-b96d-7a1c40fdd6f7/BRIEF.md' } : source)])
    assert.throws(() => authenticatedJourneyChoice('proposal-continuation', { ...f.evidence, inventory }));
});
