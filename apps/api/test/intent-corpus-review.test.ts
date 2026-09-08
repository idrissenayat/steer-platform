import assert from 'node:assert/strict';
import test from 'node:test';
import { createCorpusRecordedDevelopmentReviewer } from '../src/runtime.ts';
import { createApi } from '../src/app.ts';
import { createGitHubReader } from '@steer/adapters/github';
import { verifyDevelopmentReview } from '@steer/tool-registry/intent-development-review-contracts';
import { developmentFixture } from '../../../packages/tool-registry/test/intent-development.fixture.ts';
import { fixture, binding, now } from '../../../packages/adapters/test/github-brief-fixture.ts';

async function setup(t: { after(run: () => void): void }) {
  const f = await developmentFixture(), git = fixture(t);
  git.add([{ path: 'intent/0001/BRIEF.md', content: '# Legacy billing\nHuman invoices.\n' },
    { path: 'intent/0001/SPEC.md', content: '# Scope\nOut of scope: patient booking\n' }]);
  const reader = createGitHubReader(binding, { appJwt: async () => 'synthetic-app-jwt', fetch: git.transport, now: () => now });
  const config = { ...f.scope, branch: binding.branch, subject: 'human', configurationRevision: 'r1', recordsPolicyDigest: 'a'.repeat(64) };
  let authorized = true;
  const reviewer = createCorpusRecordedDevelopmentReviewer(reader, config, 'retrieval-r1', {
    drafts: { scope: { ...f.scope, subject: 'human' }, create: async () => assert.fail('Read-only review'), append: async () => assert.fail('Read-only review'),
      read: async () => ({ draftId: f.input.draftId, revision: 1, sourceRevision: 1, revisionDigest: f.input.revisionDigest, scopeInputDigest: f.input.scopeInputDigest, latestRevision: 1, content: f.content, savedToGit: false }) },
    authority: { authorize: async () => { if (!authorized) throw new Error('PRIVATE'); return { permissionsRevision: 'p1' }; },
      select: async context => ({ ...context, selection: 'canonical', authorityDigest: 'a'.repeat(64) }), authorizeSource: async () => {} },
    authorizeReview: async () => {},
  });
  const app = createApi({ authenticate: async () => ({ organizationId: 'org', subject: 'human', type: 'human', hats: [],
    toolGrants: ['intent.development.review'], expiresAt: new Date(Date.now() + 300000).toISOString() }), services: { intentDevelopmentReviewReader: reviewer } });
  t.after(() => reviewer.close());
  const post = () => app.fetch(new Request('https://steer.example/v1/tools/intent.development.review', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f.input) }));
  return { f, git, reader, post, revoke: () => { authorized = false; } };
}
test('actual review HTTP consumes repository-enumerated native Git evidence through the existing recorded review composition', async t => {
  const f = await setup(t), response = await f.post(); assert.equal(response.status, 200);
  const { output, envelope } = await verifyDevelopmentReview(f.f.input, await response.json());
  assert.equal(output.evidence.head, f.git.head()); assert.equal(envelope.coverage.complete, true);
  assert.deepEqual(output.evidence.inventory.map(s => s.path), ['intent/0001/BRIEF.md', 'intent/0001/SPEC.md']);
  assert.match(output.evidence.documents[1]!.content, /Out of scope: patient booking/);
  assert.equal(output.scopeBatchPlan.batches.length, 1); assert.equal(output.scopeBatchPlan.coverage.plannedCount, 2);
  assert.equal(output.scopeBatchPlan.scopeInputDigest, f.f.input.scopeInputDigest); assert.equal(output.scopeBatchPlan.modelCallsStarted, 0);
  assert.equal(output.semanticReviewComplete, false); assert.equal(output.executionAuthorized, false); assert.equal(f.git.mutations(), 0);
});
test('actual corpus review denies missing authority and changed Git head between its independent source reads', async t => {
  const denied = await setup(t); denied.revoke(); const r = await denied.post(); assert.notEqual(r.status, 200); assert.doesNotMatch(await r.text(), /PRIVATE|Legacy billing/);
  const f = await setup(t), read = f.reader.readHead; let heads = 0;
  f.reader.readHead = async () => { if (++heads === 3) f.git.add([{ path: 'intent/0001/SPEC.md', content: '# Changed scope\nBooking included\n' }]); return read(); };
  const changed = await f.post(); assert.notEqual(changed.status, 200); assert.equal(f.git.mutations(), 0);
});
