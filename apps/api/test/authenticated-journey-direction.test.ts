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
