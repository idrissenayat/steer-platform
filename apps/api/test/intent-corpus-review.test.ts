import assert from 'node:assert/strict';
import test from 'node:test';
import { createCorpusRecordedDevelopmentReviewer } from '../src/runtime.ts';
import { createApi } from '../src/app.ts';
import { createGitHubReader } from '@steer/adapters/github';
import { verifyDevelopmentReview } from '@steer/tool-registry/intent-development-review-contracts';
import { developmentFixture } from '../../../packages/tool-registry/test/intent-development.fixture.ts';
import { fixture, binding, now } from '../../../packages/adapters/test/github-brief-fixture.ts';
import { withReviewReadSession } from '../../../packages/data/src/review-read-session.ts';

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
  const post = (input = f.input) => app.fetch(new Request('https://steer.example/v1/tools/intent.development.review', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }));
  return { f, git, reader, reviewer, post, revoke: () => { authorized = false; } };
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
test('actual corpus review denies missing authority and a changed Git head after its source batch', async t => {
  const denied = await setup(t); denied.revoke(); const r = await denied.post(); assert.notEqual(r.status, 200); assert.doesNotMatch(await r.text(), /PRIVATE|Legacy billing/);
  const f = await setup(t); let advanced = false;
  f.git.override((url, _init, value) => {
    if (url.pathname === '/graphql' && !advanced) { advanced = true; f.git.add([{ path: 'intent/0001/SPEC.md', content: '# Changed scope\nBooking included\n' }]); }
    return value;
  });
  const changed = await f.post(); assert.notEqual(changed.status, 200); assert.equal(f.git.mutations(), 0); assert.equal(advanced, true);
});
test('actual constructed review shares native Git bodies only within each complete read-only session', async t => {
  const f = await setup(t), batches = () => f.git.calls.filter(call => call.corpusQuery).length;
  let expected: unknown;
  for (let i = 0; i < 2; i++) {
    await withReviewReadSession(f.reviewer, f.f.input, async () => {}, async read => {
      const first = await read(async () => {}), second = await read(async () => {});
      assert.deepEqual(first, second); if (expected) assert.deepEqual(first, expected); expected = first;
    }, pending => pending, () => {});
    assert.equal(batches(), i + 1, 'one native batch retrieves both exact documents in each new phase, never in each repeated review');
    assert.equal(f.git.calls.filter(call => call.path.includes('/git/blobs/')).length, 0);
  }
  assert.equal(f.git.mutations(), 0);
});

test('actual HTTP review validates its draft before starting repository enumeration or body reads', async t => {
  const f = await setup(t), response = await f.post({ ...f.f.input, revision: 2 });
  assert.notEqual(response.status, 200); assert.deepEqual(f.git.calls, []); assert.equal(f.git.mutations(), 0);
});
test('shared native corpus rejects a revoked grant, changed head or caller after earlier successful reviews', async t => {
  for (const mode of ['grant', 'head', 'caller']) {
    const f = await setup(t); let valid = true;
    await assert.rejects(withReviewReadSession(f.reviewer, f.f.input, async () => { if (!valid) throw new Error('revoked'); }, async read => {
      await read(async () => {}); await read(async () => {});
      if (mode === 'grant') f.revoke();
      if (mode === 'head') f.git.add([{ path: 'intent/0001/SPEC.md', content: '# Changed scope\nBooking included\n' }]);
      if (mode === 'caller') valid = false;
    }, pending => pending, () => {}));
    assert.equal(f.git.mutations(), 0);
  }
});
