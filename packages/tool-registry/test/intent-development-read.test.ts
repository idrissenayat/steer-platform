import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { invokeTool, ToolError, describeTools, type InvocationContext, type Principal } from '../src/index.ts';
import { intentDevelopmentReadOutputSchema, type IntentDevelopmentReader } from '../src/intent-development-read-contracts.ts';

function fixture() {
  const scope = { organizationId: 'org', productId: 'product', repository: 'github:52' };
  const input = { ...scope, operationId: randomUUID(), inputDigest: 'a'.repeat(64) };
  const output = { ...input, kind: 'steer-development-read/v1', source: { draftId: randomUUID(), revision: 1, revisionDigest: 'b'.repeat(64), scopeInputDigest: 'c'.repeat(64), latestRevision: 1 },
    status: 'pending', steps: [{ role: 'architect', state: 'pending' }, { role: 'test-agent', state: 'pending' }], results: [],
    savedToGit: false, gateSigned: false, executionAuthorized: false, retryAuthorized: false };
  const now = new Date(), principal: Principal = { subject: 'human', organizationId: scope.organizationId, type: 'human', hats: [],
    toolGrants: ['intent.development.read'], expiresAt: new Date(now.getTime() + 60000).toISOString() };
  const state = { calls: 0, fresh: principal as unknown };
  const service: IntentDevelopmentReader = { scope: { ...scope, subject: principal.subject }, read: async (_input, revalidate) => { await revalidate(); state.calls++; return output; } };
  const context: InvocationContext = { principal, now, clock: () => now, revalidate: async () => state.fresh, services: { intentDevelopmentReader: service } };
  return { scope, input, output, now, principal, state, service, context };
}
test('development reader is an explicit human query, not a start/retry/save or workflow-query shortcut', async () => {
  const f = fixture(); assert.deepEqual(await invokeTool('intent.development.read', f.input, f.context), f.output);
  const tool = describeTools().find(t => t.name === 'intent.development.read'); assert.equal(tool?.kind, 'query');
  assert.equal(tool?.authorization, 'explicit-tool-grant'); assert.equal(f.state.calls, 1);
});
test('reader denies absent/revoked grants, agent identity, wrong owner/scope and expired sessions before service access', async () => {
  const f = fixture(); const { revalidate: _unused, ...noRevalidation } = f.context;
  for (const context of [noRevalidation, { ...f.context, services: {} }, { ...f.context, principal: { ...f.principal, toolGrants: [] } },
    { ...f.context, principal: { ...f.principal, type: 'agent' } }, { ...f.context, principal: { ...f.principal, expiresAt: f.now.toISOString() } }])
    await assert.rejects(invokeTool('intent.development.read', f.input, context), ToolError);
  for (const key of ['organizationId', 'productId', 'repository']) await assert.rejects(invokeTool('intent.development.read', { ...f.input, [key]: 'other' }, f.context), ToolError);
  f.state.fresh = { ...f.principal, subject: 'other' }; await assert.rejects(invokeTool('intent.development.read', f.input, f.context), ToolError);
  assert.equal(f.state.calls, 0);
});
test('current revalidation after awaited reads withholds all results on account/grant/expiry changes', async () => {
  for (const change of [null, { subject: 'other' }, { toolGrants: [] }]) {
    const f = fixture(); f.service.read = async () => { f.state.fresh = change === null ? null : { ...f.principal, ...change }; return f.output; };
    await assert.rejects(invokeTool('intent.development.read', f.input, f.context), ToolError);
  }
});
test('foreign output bindings, false-ready status, authority fields and raw service errors cannot reach the caller', async () => {
  const f = fixture();
  for (const patch of [{ organizationId: 'other' }, { productId: 'other' }, { repository: 'other' }, { operationId: randomUUID() },
    { inputDigest: 'd'.repeat(64) }, { status: 'candidates-ready' }, { savedToGit: true }, { providerSecret: 'private' }]) {
    f.service.read = async () => ({ ...f.output, ...patch }); await assert.rejects(invokeTool('intent.development.read', f.input, f.context), ToolError);
  }
  f.service.read = async () => { throw new Error('PRIVATE-RESPONSE'); };
  await assert.rejects(invokeTool('intent.development.read', f.input, f.context), { message: 'The required service is not configured or available.' });
});
test('status contracts distinguish verified clarification/candidates, supersession and expiry without restoring retry authority', () => {
  const { output } = fixture();
  const architect = { resultRef: randomUUID(), resultDigest: 'd'.repeat(64), result: { role: 'architect', output: { message: 'Clarify', questions: ['Which users?'], brief: null, spec: null } } };
  const clarified = { ...output, status: 'needs-clarification', steps: [{ role: 'architect', state: 'succeeded' }, { role: 'test-agent', state: 'pending' }], results: [architect] };
  assert.ok(intentDevelopmentReadOutputSchema.safeParse(clarified).success);
  assert.ok(intentDevelopmentReadOutputSchema.safeParse({ ...clarified, status: 'superseded', source: { ...output.source, latestRevision: 2 } }).success);
  assert.ok(intentDevelopmentReadOutputSchema.safeParse({ ...output, status: 'expired', steps: null }).success);
  for (const bad of [{ ...clarified, status: 'candidates-ready' }, { ...clarified, results: [architect, architect] },
    { ...clarified, steps: [{ role: 'architect', state: 'succeeded' }, { role: 'test-agent', state: 'claimed' }] },
    { ...output, steps: [{ role: 'architect', state: 'pending' }, { role: 'test-agent', state: 'claimed' }] },
    { ...clarified, status: 'expired' }, { ...clarified, retryAuthorized: true }]) assert.equal(intentDevelopmentReadOutputSchema.safeParse(bad).success, false);
});
