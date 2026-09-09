import assert from 'node:assert/strict';
import test from 'node:test';
import { invokeTool, describeTools, type Principal, type InvocationContext } from '../src/index.ts';
import { type IntentAdmissionDiscovery } from '../src/intent-admission-discovery-contracts.ts';
import { admissionDiscoveryFixture } from './intent-admission-discovery.fixture.ts';
function setup() {
  const f = admissionDiscoveryFixture(); let calls = 0;
  const principal: Principal = { organizationId: 'org', subject: 'human', type: 'human', hats: [], toolGrants: ['intent.admissions.discover'], expiresAt: new Date(Date.now() + 300000).toISOString() };
  const state = { current: principal as unknown };
  const service: IntentAdmissionDiscovery = { scope: { ...f.input, subject: 'human' }, async discover(_input, current) { await current(); calls++; return f.output; } };
  const context: InvocationContext = { principal, now: new Date(), revalidate: async () => state.current, services: { intentAdmissionDiscovery: service } };
  return { f, principal, state, service, context, calls: () => calls };
}
test('all-revision preparation diagnostics is a separately authorized human query with no content or execution claim', async () => {
  const { f, context } = setup(); assert.deepEqual(await invokeTool('intent.admissions.discover', f.input, context), f.output);
  assert.equal(describeTools().find(t => t.name === 'intent.admissions.discover')?.kind, 'query');
});
test('preparation diagnostics denies agents, wrong grants, scope and injected configuration before service access', async () => {
  const { f, context, principal, service, calls } = setup();
  for (const patch of [{ services: {} }, { revalidate: undefined }, { principal: { ...principal, type: 'agent' } }, { principal: { ...principal, toolGrants: ['intent.draft.discover'] } },
    { services: { intentAdmissionDiscovery: { ...service, scope: { ...service.scope, subject: 'foreign' } } } }])
    await assert.rejects(invokeTool('intent.admissions.discover', f.input, { ...context, ...patch } as InvocationContext));
  for (const patch of [{ productId: 'other' }, { subject: 'foreign' }, { limit: 100 }, { configurationRevision: 'caller' }, { model: 'caller' }])
    await assert.rejects(invokeTool('intent.admissions.discover', { ...f.input, ...patch }, context));
  assert.equal(calls(), 0);
});
test('preparation diagnostics enforces exact cursor/owner echoes and final identity', async () => {
  const { f, context, service, state } = setup();
  for (const patch of [{ draftId: f.output.entries[0]!.kind === 'development' ? f.output.entries[0]!.operationId : '' }, { retryAuthorized: true }, { executionAuthorized: true },
    { cursor: { revision: 2, kind: 'development', runId: '00000000-0000-4000-8000-000000000009', latestRevisionDigest: f.output.latest.revisionDigest, bindingSetDigest: f.output.bindingSetDigest } }]) {
    service.discover = async () => ({ ...f.output, ...patch }); await assert.rejects(invokeTool('intent.admissions.discover', f.input, context));
  }
  service.discover = async () => { state.current = null; return f.output; }; await assert.rejects(invokeTool('intent.admissions.discover', f.input, context));
});
