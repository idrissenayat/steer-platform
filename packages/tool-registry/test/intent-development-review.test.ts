import assert from 'node:assert/strict';
import test from 'node:test';
import { invokeTool, describeTools, type Principal, type InvocationContext } from '../src/index.ts';
import type { IntentDevelopmentReviewReader } from '../src/intent-development-review-contracts.ts';
import { developmentFixture } from './intent-development.fixture.ts';

async function setup() {
  const f = await developmentFixture(); let calls = 0;
  const principal: Principal = { organizationId: f.scope.organizationId, subject: 'human', type: 'human', hats: [],
    toolGrants: ['intent.development.review'], expiresAt: new Date(Date.now() + 300000).toISOString() };
  const state = { current: principal as unknown };
  const service: IntentDevelopmentReviewReader = { scope: { ...f.scope, subject: 'human', configurationRevision: f.review.configurationRevision },
    async review(_input, revalidate) { await revalidate(); calls++; return f.review; } };
  const context: InvocationContext = { principal, now: new Date(), revalidate: async () => state.current, services: { intentDevelopmentReviewReader: service } };
  return { f, principal, service, state, context, calls: () => calls };
}
test('source metadata is an explicit current-human query with no generation or false clearance', async () => {
  const { f, context } = await setup(); assert.deepEqual(await invokeTool('intent.development.review', f.input, context), f.review);
  assert.equal(describeTools().find(t => t.name === 'intent.development.review')?.kind, 'query');
});
test('missing/wrong service, grant, identity, product and injected execution fields are rejected', async () => {
  const { f, context, principal, service, calls } = await setup();
  for (const patch of [{ services: {} }, { revalidate: undefined }, { principal: { ...principal, type: 'agent' } },
    { principal: { ...principal, toolGrants: ['intent.development.prepare'] } },
    { services: { intentDevelopmentReviewReader: { ...service, scope: { ...service.scope, subject: 'foreign' } } } }])
    await assert.rejects(invokeTool('intent.development.review', f.input, { ...context, ...patch } as InvocationContext));
  await assert.rejects(invokeTool('intent.development.review', { ...f.input, productId: 'foreign' }, context));
  await assert.rejects(invokeTool('intent.development.review', { ...f.input, budget: 5 }, context)); assert.equal(calls(), 0);
});
test('changed configuration/source/evidence and late grant revocation suppress source release', async () => {
  const { f, context, service, state } = await setup();
  for (const patch of [{ configurationRevision: 'wrong' }, { scopeInputDigest: 'f'.repeat(64) }, { sourceSnapshotDigest: 'f'.repeat(64) },
    { evidence: { ...f.evidence, documents: [{ sourceId: 'brief-1', content: 'Changed bytes' }] } }, { authoritativeClearance: true }]) {
    service.review = async () => ({ ...f.review, ...patch }); await assert.rejects(invokeTool('intent.development.review', f.input, context));
  }
  service.review = async () => { state.current = null; return f.review; }; await assert.rejects(invokeTool('intent.development.review', f.input, context));
});
