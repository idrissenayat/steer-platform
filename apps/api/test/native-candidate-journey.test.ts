import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeCandidateJourneyFixture } from './native-candidate-journey.fixture.ts';
import { scopeReviewFixture } from '../../../packages/tool-registry/test/intent-scope-review.fixture.ts';
import { prepareIntentScopeReview } from '@steer/tool-registry/intent-scope-review';
import { validateIntentScopeAssessment } from '@steer/tool-registry/intent-evidence-contracts';

test('native journey corpus resolves current candidate and amendment bytes before two-batch scope preparation',async t=>{
  const native=nativeCandidateJourneyFixture(t),f=await scopeReviewFixture(32);
  const evidence=await native.repositoryEvidence(f.evidence);
  assert.equal(evidence.inventory.length,34);assert.equal(evidence.documents.length,34);
  const prepared=await prepareIntentScopeReview(f.scope,evidence,f.profile);
  assert.equal(prepared.batches.length,2);
  for(const batch of prepared.batches)validateIntentScopeAssessment(batch.envelope,f.result(batch),f.profile.profileRevision);
  assert.notEqual(native.parents().originalTarget,evidence.head);
  assert.equal(native.git.mutations(),0);assert.equal(native.git.approvals(),0);
});
