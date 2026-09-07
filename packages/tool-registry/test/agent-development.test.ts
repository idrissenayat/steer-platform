import assert from 'node:assert/strict';
import { test } from 'node:test';
import { invokeTool, describeTools, type InvocationContext } from '../src/index.ts';
import type { AgentOutput } from '../src/agent-contracts.ts';
const now = new Date('2026-09-07T12:00:00Z');
const principal = { organizationId: 'org', subject: 'human', type: 'human', hats: [], toolGrants: ['intent.agent.develop'], expiresAt: '2026-09-07T13:00:00Z' };
const input = { organizationId: 'org', intent: 'Book an appointment', clarification: '' };
const output: AgentOutput = { kind: 'intent-agent-candidate', organizationId: 'org', subject: 'human', sourceDigest: 'a'.repeat(64), configurationRevision: 'test', message: 'Who books?', questions: ['Who books?'], documents: null, saved: false, gateSigned: false, executionAuthorized: false };
const context = (): InvocationContext => ({ principal, now, clock: () => now, revalidate: async () => principal,
  services: { intentAgent: { organizationId: 'org', develop: async () => output } } });

test('agent command shares registry discovery and returns a scoped candidate', async () => {
  assert.equal(describeTools().find(tool => tool.name === 'intent.agent.develop')?.kind, 'command');
  assert.deepEqual(await invokeTool('intent.agent.develop', input, context()), output);
});
test('preview grants, other organizations and agent callers do not authorize paid generation', async () => {
  for (const changed of [{ toolGrants: ['intent.brief.preview'] }, { organizationId: 'other' }, { type: 'agent' }]) {
    await assert.rejects(invokeTool('intent.agent.develop', input, { ...context(), principal: { ...principal, ...changed } }), { code: 'FORBIDDEN' });
  }
});
test('unconfigured service is closed and changing identity suppresses a late result', async () => {
  await assert.rejects(invokeTool('intent.agent.develop', input, { ...context(), services: {} }), { code: 'UNAVAILABLE' });
  let reads = 0;
  await assert.rejects(invokeTool('intent.agent.develop', input, { ...context(), revalidate: async () => ++reads === 1 ? principal : { ...principal, subject: 'other' } }), { code: 'UNAUTHENTICATED' });
});
test('service scope mismatch and provider error text never leak source or secrets', async () => {
  await assert.rejects(invokeTool('intent.agent.develop', input, { ...context(), services: { intentAgent: { organizationId: 'other', develop: async () => output } } }), { code: 'FORBIDDEN' });
  await assert.rejects(invokeTool('intent.agent.develop', input, { ...context(), services: { intentAgent: { organizationId: 'org', develop: async () => { throw new Error('private-provider-content'); } } } }),
    (error: Error) => !error.message.includes('private-provider-content'));
});
