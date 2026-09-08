import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { describeTools, invokeTool, ToolError, type InvocationContext, type Principal } from '../src/index.ts';
import { intentDevelopmentPrepareOutputSchema, type IntentDevelopmentPreparer } from '../src/intent-development-prepare-contracts.ts';
function fixture() {
  const scope = { organizationId: 'org', productId: 'product', repository: 'github:52', configurationRevision: 'r1' };
  const input = { ...scope, draftId: randomUUID(), revision: 1, revisionDigest: 'a'.repeat(64), scopeInputDigest: 'b'.repeat(64), sourceSnapshotDigest: 'c'.repeat(64), choice: { action: 'new-distinct', reason: 'Human direction, not clearance' } };
  const output = { ...input, kind: 'steer-development-prepare/v1', outcome: 'prepared', reference: { operationId: randomUUID(), inputDigest: 'd'.repeat(64) },
    coverage: { inventoryComplete: true, inventoryCount: 1, includedCount: 1, accessGapCount: 0, gapCount: 0, complete: true }, originalPreserved: true, readyToRequestStart: true,
    semanticReviewComplete: false, authoritativeClearance: false, executionAuthorized: false, documentsReady: false, savedToGit: false, gateSigned: false };
  const principal: Principal = { subject: 'human', organizationId: scope.organizationId, type: 'human', hats: [], toolGrants: ['intent.development.prepare'], expiresAt: new Date(Date.now() + 60000).toISOString() };
  const state = { fresh: principal as unknown, calls: 0 };
  const service: IntentDevelopmentPreparer = { scope: { ...scope, subject: principal.subject }, prepare: async (_input, current) => { await current(); state.calls++; return output; } };
  const context: InvocationContext = { principal, now: new Date(), revalidate: async () => state.fresh, services: { intentDevelopmentPreparer: service } };
  return { input, output, principal, state, service, context };
}
test('preparation is an explicit human command and does not claim execution, semantic clearance or Git saving', async () => {
  const f = fixture(); assert.deepEqual(await invokeTool('intent.development.prepare', f.input, f.context), f.output);
  assert.equal(describeTools().find(t => t.name === 'intent.development.prepare')?.kind, 'command');
});
test('wrong owner/product/configuration, missing or stale identity and extra authority input prevent preparation', async () => {
  const f = fixture(); const { revalidate: _unused, ...noCurrent } = f.context;
  for (const context of [noCurrent, { ...f.context, services: {} }, { ...f.context, principal: { ...f.principal, toolGrants: ['intent.development.start'] } },
    { ...f.context, principal: { ...f.principal, type: 'agent' } }]) await assert.rejects(invokeTool('intent.development.prepare', f.input, context), ToolError);
  for (const key of ['organizationId', 'productId', 'repository', 'configurationRevision']) await assert.rejects(invokeTool('intent.development.prepare', { ...f.input, [key]: 'foreign' }, f.context), ToolError);
  await assert.rejects(invokeTool('intent.development.prepare', { ...f.input, budget: 5 }, f.context), ToolError);
  f.state.fresh = { ...f.principal, subject: 'foreign' }; await assert.rejects(invokeTool('intent.development.prepare', f.input, f.context), ToolError); assert.equal(f.state.calls, 0);
});
test('late permission loss and substituted direction/source bindings withhold preparation acknowledgements', async () => {
  const f = fixture();
  for (const patch of [{ draftId: randomUUID() }, { revision: 2 }, { sourceSnapshotDigest: 'f'.repeat(64) }, { scopeInputDigest: 'e'.repeat(64) },
    { choice: { action: 'new-distinct', reason: 'Silently changed direction' } }, { executionAuthorized: true }, { authoritativeClearance: true }]) {
    f.service.prepare = async () => ({ ...f.output, ...patch }); await assert.rejects(invokeTool('intent.development.prepare', f.input, f.context), ToolError);
  }
  f.service.prepare = async () => { f.state.fresh = null; return f.output; }; await assert.rejects(invokeTool('intent.development.prepare', f.input, f.context), ToolError);
});
test('incomplete/unknown/conflict responses cannot manufacture ready source records or hide omitted coverage', () => {
  const { output } = fixture();
  const incomplete = { ...output, outcome: 'scope-incomplete', reference: null, originalPreserved: false, readyToRequestStart: false,
    coverage: { ...output.coverage, inventoryComplete: false, complete: false } };
  assert.ok(intentDevelopmentPrepareOutputSchema.safeParse(incomplete).success);
  for (const value of [{ ...incomplete, readyToRequestStart: true }, { ...incomplete, reference: output.reference },
    { ...incomplete, coverage: { ...incomplete.coverage, complete: true } }, { ...output, reference: null },
    { ...output, outcome: 'unknown' }, { ...output, outcome: 'conflict' }]) assert.equal(intentDevelopmentPrepareOutputSchema.safeParse(value).success, false);
});
