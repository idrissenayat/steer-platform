import assert from 'node:assert/strict';
import test from 'node:test';
import { createIntentDevelopmentReviewer } from '../src/intent-development-reviewer.ts';
import { developmentFixture } from '../../tool-registry/test/intent-development.fixture.ts';

async function setup() {
  const f = await developmentFixture(), state = { reads: 0, evidenceReads: 0, authorizations: 0 };
  const config = { ...f.scope, subject: 'human', branch: f.evidence.branch, configurationRevision: f.review.configurationRevision, recordsPolicyDigest: 'a'.repeat(64) };
  const deps: Parameters<typeof createIntentDevelopmentReviewer>[1] = {
    drafts: { scope: { ...f.scope, subject: config.subject }, create: async () => assert.fail('read-only'), append: async () => assert.fail('read-only'),
      async read() { state.reads++; return { draftId: f.input.draftId, revision: 1, latestRevision: 1, sourceRevision: 1,
        revisionDigest: f.input.revisionDigest, scopeInputDigest: f.input.scopeInputDigest, content: f.content, savedToGit: false }; } },
    evidenceFor: async () => { state.evidenceReads++; return f.evidence; }, authorizeReview: async () => { state.authorizations++; },
  };
  return { f, state, config, deps, service: createIntentDevelopmentReviewer(config, deps) };
}
test('review reads latest exact draft and unchanged source bytes twice, without modifying drafts or creating operations', async () => {
  const { f, state, service } = await setup();
  assert.deepEqual(await service.review(f.input, async () => {}), f.review);
  assert.deepEqual(state, { reads: 2, evidenceReads: 2, authorizations: 2 }); service.close();
  await assert.rejects(service.review(f.input, async () => {}));
});
test('held/changed drafts, foreign scopes, changed evidence and missing provenance authority never release review', async () => {
  for (const mode of ['draft', 'source', 'authority', 'scope', 'read-body'] as const) {
    const { f, state, service, deps } = await setup();
    if (mode === 'draft') deps.drafts.read = async () => { throw new Error('PRIVATE'); };
    if (mode === 'source') deps.evidenceFor = async () => ({ ...f.evidence, head: ++state.evidenceReads === 1 ? f.evidence.head : 'f'.repeat(40) });
    if (mode === 'authority') deps.authorizeReview = async () => { throw new Error('PRIVATE'); };
    if (mode === 'scope') deps.drafts = { ...deps.drafts, scope: { ...deps.drafts.scope, subject: 'other' } };
    if (mode === 'read-body') { const read = deps.drafts.read; deps.drafts.read = async (input, current) => ({ ...await read(input, current) as object, latestRevision: 2 }); }
    await assert.rejects(service.review(f.input, async () => {}), error => { assert.doesNotMatch(String(error), /PRIVATE/); return true; }); service.close();
  }
});
test('incomplete source review remains incomplete, never creates evidence of newness', async () => {
  const { f, deps, service } = await setup(); deps.evidenceFor = async () => ({ ...f.evidence, inventoryComplete: false, accessGapCount: 1 });
  const result = await service.review(f.input, async () => {});
  assert.equal(result.evidence.inventoryComplete, false); assert.equal(result.evidence.accessGapCount, 1); assert.equal(result.authoritativeClearance, false);
});
test('pending dependencies retain bounded admission and late closure cannot release content', async () => {
  const { f, deps, service } = await setup(); const releases: Array<() => void> = [];
  deps.evidenceFor = async () => { await new Promise<void>(resolve => releases.push(resolve)); return f.evidence; };
  const current = async () => {};
  const reads = Array.from({ length: 4 }, () => service.review(f.input, current));
  await assert.rejects(service.review(f.input, current));
  for (let i = 0; i < 20 && releases.length < 4; i++) await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal(releases.length, 4); service.close(); releases.forEach(release => release());
  await Promise.all(reads.map(read => assert.rejects(read)));
});
