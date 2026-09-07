import assert from 'node:assert/strict';
import { test } from 'node:test';
import { invokeTool, describeTools, type InvocationContext } from '../src/index.ts';
import type { AgentOutput } from '../src/agent-contracts.ts';
import { intentAgentFixture } from '../../../tests/fixtures/intent-agent.ts';
const fixture = await intentAgentFixture(), { now, principal, input } = fixture;
const output: AgentOutput = { kind: 'intent-agent-candidate', organizationId: 'org', subject: 'human', sourceDigest: 'a'.repeat(64), configurationRevision: 'test', message: 'Who books?', questions: ['Who books?'], documents: null, saved: false, gateSigned: false, executionAuthorized: false };
const context = (): InvocationContext => ({ principal, now, clock: () => now, revalidate: async () => principal,
  services: { ...fixture.context.services, intentAgent: { organizationId: 'org', develop: async () => output } } });

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
  await assert.rejects(invokeTool('intent.agent.develop', input, { ...context(), services: { ...fixture.context.services, intentAgent: { organizationId: 'org', develop: async () => { throw new Error('private-provider-content'); } } } }),
    (error: Error) => !error.message.includes('private-provider-content'));
});

test('missing, forged and stale proposals or missing read grants cannot reach the agent service', async () => {
  let calls = 0; const ctx = context(); ctx.services!.intentAgent = { organizationId: 'org', develop: async () => { calls++; return output; } };
  const { disposition, ...without } = input;
  await assert.rejects(invokeTool('intent.agent.develop', without, ctx), { code: 'INVALID_INPUT' });
  for (const field of ['sourceDigest', 'catalogFingerprint', 'reviewFingerprint']) {
    await assert.rejects(invokeTool('intent.agent.develop', { ...input, disposition: { ...disposition, [field]: '0'.repeat(64) } }, ctx), { code: 'SCOPE_REVIEW_CHANGED' });
  }
  await assert.rejects(invokeTool('intent.agent.develop', { ...input, clarification: 'Now include a different product' }, ctx), { code: 'SCOPE_REVIEW_CHANGED' });
  for (const grant of principal.toolGrants.slice(1)) {
    const changed = { ...principal, toolGrants: principal.toolGrants.filter(value => value !== grant) };
    await assert.rejects(invokeTool('intent.agent.develop', input, { ...ctx, principal: changed, revalidate: async () => changed }), { code: 'FORBIDDEN' });
  }
  assert.equal(calls, 0);
});

test('service receives server-retrieved evidence and concurrent source change suppresses generated output', async () => {
  const f = await intentAgentFixture(); let calls = 0;
  const ctx = { ...f.context, services: { ...f.context.services, intentAgent: { organizationId: 'org', develop: async (source, subject, revalidate, evidence) => {
    calls++; assert.deepEqual(evidence, f.review); assert.deepEqual(source.disposition.choice, input.disposition.choice); await revalidate();
    const path = f.reader.scope.paths.find(path => path.endsWith('/SPEC.md'))!;
    f.values.set(path, f.source(path, 'Changed scope during generation')); return output;
  } } } } satisfies InvocationContext;
  await assert.rejects(invokeTool('intent.agent.develop', f.input, ctx), { code: 'SCOPE_REVIEW_CHANGED' }); assert.equal(calls, 1);
});
