import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { describeTools, invokeTool, ToolError, type InvocationContext, type Principal } from '../src/index.ts';
import type { IntentScopeStarter } from '../src/intent-scope-start-contracts.ts';
function fixture() {
  const scope = { organizationId: 'org', productId: 'product', repository: 'github:52' };
  const input = { ...scope, reviewId: randomUUID(), preparationDigest: 'a'.repeat(64), draftId: randomUUID(), revision: 1, revisionDigest: 'b'.repeat(64) };
  const output = { ...input, kind: 'steer-scope-start/v1', receipt: { outcome: 'acknowledged', workflowId: `steer-scope/v1/org/${input.reviewId}`, runId: randomUUID(), state: 'RUNNING' },
    savedToGit: false, gateSigned: false, semanticReviewComplete: false, authoritativeClearance: false, executionAuthorized: false, retryAuthorized: false };
  const principal: Principal = { organizationId: scope.organizationId, subject: 'human', type: 'human', hats: [], toolGrants: ['intent.scope.start'], expiresAt: new Date(Date.now() + 60000).toISOString() };
  const state = { fresh: principal as unknown, calls: 0 };
  const service: IntentScopeStarter = { scope: { ...scope, subject: principal.subject }, start: async (_input, fresh) => { await fresh(); state.calls++; return output; } };
  const context: InvocationContext = { principal, now: new Date(), revalidate: async () => state.fresh, services: { intentScopeStarter: service } };
  return { input, output, principal, state, service, context };
}
test('scope start is an explicit human command; acknowledgement is not document/save/gate success', async () => {
  const f = fixture(); assert.deepEqual(await invokeTool('intent.scope.start', f.input, f.context), f.output);
  assert.equal(describeTools().find(t => t.name === 'intent.scope.start')?.kind, 'command');
});
test('no grant, service, fresh identity, matching owner/scope or human account means no start', async () => {
  const f = fixture();
  const { revalidate: _unused, ...noRevalidation } = f.context;
  for (const context of [{ ...f.context, services: {} }, noRevalidation,
    { ...f.context, principal: { ...f.principal, toolGrants: ['intent.scope.read'] } },
    { ...f.context, principal: { ...f.principal, type: 'agent' } }]) await assert.rejects(invokeTool('intent.scope.start', f.input, context), ToolError);
  for (const k of ['organizationId', 'productId', 'repository']) await assert.rejects(invokeTool('intent.scope.start', { ...f.input, [k]: 'foreign' }, f.context), ToolError);
  f.state.fresh = { ...f.principal, subject: 'other' }; await assert.rejects(invokeTool('intent.scope.start', f.input, f.context), ToolError);
  assert.equal(f.state.calls, 0);
});
test('late permission loss withholds ACK and does not invoke the scheduler a second time', async () => {
  const f = fixture(); f.service.start = async () => { f.state.calls++; f.state.fresh = null; return f.output; };
  await assert.rejects(invokeTool('intent.scope.start', f.input, f.context), ToolError); assert.equal(f.state.calls, 1);
});
test('substituted source, workflow, authority flags, extra input and private errors are rejected', async () => {
  const f = fixture();
  for (const patch of [{ draftId: randomUUID() }, { revision: 2 }, { revisionDigest: 'c'.repeat(64) }, { preparationDigest: 'c'.repeat(64) },
    { receipt: { ...f.output.receipt, workflowId: 'other' } }, { semanticReviewComplete: true }, { savedToGit: true }, { retryAuthorized: true }]) {
    f.service.start = async () => ({ ...f.output, ...patch }); await assert.rejects(invokeTool('intent.scope.start', f.input, f.context), ToolError);
  }
  await assert.rejects(invokeTool('intent.scope.start', { ...f.input, grant: true }, f.context), ToolError);
  f.service.start = async () => { throw new Error('private-start-error'); };
  await assert.rejects(invokeTool('intent.scope.start', f.input, f.context), { message: 'The required service is not configured or available.' });
});
