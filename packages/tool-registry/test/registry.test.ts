import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { createOpenApiDocument, defineQuery, describeTools, invokeTool, ToolError } from '../src/index.ts';

const now = new Date('2026-09-04T12:00:00Z');
const principal = {
  subject: 'human-1', organizationId: 'org-a', type: 'human',
  hats: ['product-lead'], toolGrants: ['session.context'], expiresAt: '2026-09-04T12:01:00Z',
};
const context = { principal, now };
const denied = (code: string) => (cause: unknown) => cause instanceof ToolError && cause.code === code;

test('a current explicitly granted principal receives only its own verified context', () => {
  assert.deepEqual(invokeTool('session.context', { organizationId: 'org-a' }, context), {
    subject: 'human-1', organizationId: 'org-a', type: 'human', hats: ['product-lead'], toolGrants: ['session.context'],
  });
  assert.throws(() => invokeTool('session.context', { organizationId: 'org-b' }, context), denied('FORBIDDEN'));
  assert.throws(() => invokeTool('session.context', { organizationId: 'org-a' }, {
    now, principal: { ...principal, toolGrants: [] },
  }), denied('FORBIDDEN'));
});

test('missing, malformed and expired identity is rejected including the expiry instant', () => {
  for (const identity of [null, {}, { ...principal, hats: ['super-admin'] }, { ...principal, expiresAt: now.toISOString() }]) {
    assert.throws(() => invokeTool('session.context', { organizationId: 'org-a' }, { now, principal: identity }), denied('UNAUTHENTICATED'));
  }
  assert.throws(() => invokeTool('session.context', { organizationId: 'org-a' }, {
    ...context, now: new Date('invalid'),
  }), denied('UNAUTHENTICATED'));
});

test('agent identity uses the same explicit grant and organization boundary', () => {
  const agentContext = { now, principal: { ...principal, type: 'agent', hats: [] } };
  assert.equal(invokeTool('session.context', { organizationId: 'org-a' }, agentContext).type, 'agent');
  assert.throws(() => invokeTool('session.context', { organizationId: 'org-b' }, agentContext), denied('FORBIDDEN'));
});

test('unknown tools and prototype-property names do not dispatch', () => {
  for (const name of ['missing', '__proto__', 'constructor', 'toString']) {
    assert.throws(() => invokeTool(name, {}, context), denied('TOOL_NOT_FOUND'));
  }
});

test('input authority injection is rejected and denial happens before handler execution', () => {
  let calls = 0;
  const tool = defineQuery({
    name: 'test.read', description: 'Test isolation',
    input: z.strictObject({ organizationId: z.string() }), output: z.strictObject({ ok: z.boolean() }),
    handler: () => { calls++; return { ok: true }; },
  });
  const authorized = { now, principal: { ...principal, toolGrants: ['test.read'] } };
  assert.throws(() => tool.invoke({ organizationId: 'org-a', hats: ['org-admin'] }, authorized), denied('INVALID_INPUT'));
  assert.throws(() => tool.invoke({ organizationId: 'org-b' }, authorized), denied('FORBIDDEN'));
  assert.throws(() => tool.invoke({ organizationId: 'org-a' }, context), denied('FORBIDDEN'));
  assert.equal(calls, 0);
  assert.deepEqual(tool.invoke({ organizationId: 'org-a' }, authorized), { ok: true });
  assert.equal(calls, 1);
});

test('invalid handler output and thrown content are replaced with a safe internal error', () => {
  const definition = {
    name: 'session.context', description: 'Output validation',
    input: z.strictObject({ organizationId: z.string() }), output: z.strictObject({ value: z.string() }),
  };
  const invalid = defineQuery({ ...definition, handler: () => ({ value: 42 } as unknown as { value: string }) });
  const throwing = defineQuery({ ...definition, handler: (): { value: string } => { throw new Error('private-adapter-content'); } });
  for (const query of [invalid, throwing]) {
    assert.throws(() => query.invoke({ organizationId: 'org-a' }, context), (cause: unknown) =>
      cause instanceof ToolError && cause.code === 'INTERNAL_ERROR' && !cause.message.includes('private'));
  }
});

test('OpenAPI and discovery use exactly the same input and output schemas as dispatch', () => {
  const tools = describeTools();
  const api = createOpenApiDocument();
  assert.deepEqual(Object.keys(api.paths), tools.map((tool) => `/v1/tools/${tool.name}`));
  for (const tool of tools) {
    const operation = api.paths[`/v1/tools/${tool.name}`]?.post;
    assert.ok(operation);
    assert.equal(operation.operationId, tool.name);
    assert.deepEqual(operation.requestBody.content['application/json'].schema, tool.inputSchema);
    assert.deepEqual(operation.responses['200'].content['application/json'].schema, tool.outputSchema);
    assert.equal(tool.inputSchema.additionalProperties, false);
  }
});
