import assert from 'node:assert/strict';
import { test } from 'node:test';
import { invokeTool, ToolError, type InvocationContext, type BriefDestinationReader } from '../src/index.ts';
const now = new Date('2026-09-06T15:00:00.000Z');
const principal = { subject: 'synthetic', organizationId: 'org', type: 'human', hats: [],
  toolGrants: ['intent.brief.destination'], expiresAt: '2026-09-06T15:05:00Z' };
const input = { organizationId: 'org' }, head = 'a'.repeat(40);
const scope = { ...input, repository: 'github:52', branch: 'codex/fixture', paths: ['items/0002-two/BRIEF.md', 'items/0001-one/BRIEF.md'] };
const service = (): BriefDestinationReader => ({ scope: structuredClone(scope), readHead: async () => head });
const context = (reader = service()): InvocationContext => ({ principal, now, clock: () => now,
  revalidate: async () => principal, services: { briefDestination: reader } });
const code = (value: string) => (error: unknown) => error instanceof ToolError && error.code === value;
const invoke = (ctx = context(), raw: unknown = input) => invokeTool('intent.brief.destination', raw, ctx);

test('destination returns a sorted detached Git observation, never saving or gate authority', async () => {
  const reader = service(); let reads = 0; reader.readHead = async () => { reads++; return head; };
  const result = await invoke(context(reader));
  assert.deepEqual(result, { ...scope, paths: [...scope.paths].sort(), kind: 'brief-destination-observation',
    observedHead: head, observedAt: now.toISOString(), writeAuthorized: false, gateVerified: false });
  result.paths.pop(); assert.equal(reader.scope.paths.length, 2); assert.equal(reads, 1);
  const agent = { ...principal, type: 'agent' };
  assert.equal((await invoke({ ...context(), principal: agent, revalidate: async () => agent })).observedHead, head);
});
test('input cannot choose a repository, branch, path or revision and authorization precedes head I/O', async () => {
  let reads = 0; const reader = service(); reader.readHead = async () => { reads++; return head; };
  for (const field of ['repository', 'branch', 'path', 'expectedHead', 'writeAuthorized', 'hats']) {
    await assert.rejects(invoke(context(reader), { ...input, [field]: 'injected' }), code('INVALID_INPUT'));
  }
  await assert.rejects(invoke(context(reader), { organizationId: 'other' }), code('FORBIDDEN'));
  for (const actor of [null, { ...principal, expiresAt: now.toISOString() }, { ...principal, type: 'agent', hats: ['product-lead'] }]) {
    await assert.rejects(invoke({ ...context(reader), principal: actor }), code('UNAUTHENTICATED'));
  }
  await assert.rejects(invoke({ ...context(reader), principal: { ...principal, toolGrants: [] } }), code('FORBIDDEN'));
  await assert.rejects(invoke({ ...context(reader), revalidate: async () => null }), code('UNAUTHENTICATED'));
  assert.equal(reads, 0);
});
test('unconfigured and invalid startup scope fail closed without reads', async () => {
  await assert.rejects(invoke({ ...context(), services: {} }), code('UNAVAILABLE'));
  const missingRefresh = context(); delete missingRefresh.revalidate;
  await assert.rejects(invoke(missingRefresh), code('UNAVAILABLE'));
  let reads = 0;
  for (const candidate of [{ ...scope, paths: [] }, { ...scope, paths: [scope.paths[0], scope.paths[0]] },
    { ...scope, paths: Array.from({ length: 101 }, (_, i) => `items/${String(i).padStart(4, '0')}-demo/BRIEF.md`) },
    { ...scope, paths: ['intent/0001/BRIEF.md'] }, { ...scope, branch: 'main@{other}' }, { ...scope, secret: 'private' }]) {
    const reader = { scope: candidate, readHead: async () => { reads++; return head; } } as BriefDestinationReader;
    await assert.rejects(invoke(context(reader)), code('UNAVAILABLE'));
  }
  await assert.rejects(invoke(context({ scope: { ...scope, organizationId: 'other' }, readHead: async () => { reads++; return head; } })), code('FORBIDDEN'));
  assert.equal(reads, 0);
});
test('revocation and identity switching during I/O suppress metadata', async () => {
  for (const next of [null, { ...principal, subject: 'other' }, { ...principal, organizationId: 'other' },
    { ...principal, type: 'agent' }, { ...principal, toolGrants: [] }, { ...principal, expiresAt: now.toISOString() }]) {
    let read = false; const reader = service(); reader.readHead = async () => { read = true; return head; };
    await assert.rejects(invoke({ ...context(reader), revalidate: async () => read ? next : principal }),
      (error: unknown) => error instanceof ToolError && ['UNAUTHENTICATED', 'FORBIDDEN'].includes(error.code));
    assert.equal(read, true);
  }
});
test('malformed heads and provider failures never leak source details', async () => {
  for (const value of [null, 'a'.repeat(39), `${head}\n`, { head, secret: 'private' }]) {
    await assert.rejects(invoke(context({ scope, readHead: async () => value })), code('INTERNAL_ERROR'));
  }
  await assert.rejects(invoke(context({ scope, readHead: async () => { throw new Error('private token'); } })),
    (error: unknown) => error instanceof ToolError && error.code === 'INTERNAL_ERROR' && !error.message.includes('private'));
});
test('late results, expiry, invalid clocks and rollback do not escape as fresh observations', async () => {
  for (const offset of [-1, 15001, 300000, Number.NaN]) {
    let read = false; const reader = service(); reader.readHead = async () => { read = true; return head; };
    await assert.rejects(invoke({ ...context(reader), clock: () => read ? new Date(now.getTime() + offset) : now }),
      (error: unknown) => error instanceof ToolError && ['UNAVAILABLE', 'UNAUTHENTICATED'].includes(error.code));
  }
});
