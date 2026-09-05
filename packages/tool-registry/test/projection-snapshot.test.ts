import assert from 'node:assert/strict';
import { test } from 'node:test';
import { invokeTool, ToolError, ProjectionSnapshotTooLargeError, type InvocationContext, type ProjectionSnapshotReader } from '../src/index.ts';

const now = new Date('2026-09-05T14:00:00Z');
const principal = { subject: 'synthetic', organizationId: 'org', type: 'human', hats: [], toolGrants: ['projection.snapshot.read'], expiresAt: '2026-09-05T14:05:00Z' };
const scope = { organizationId: 'org', repository: 'github:46' };
const record = { recordKey: 'synthetic', sourceRevision: 'a'.repeat(40), contentDigest: 'b'.repeat(64) };
const cursor = { ...scope, generation: '00000000-0000-4000-8000-000000000046', position: '9007199254740993' };
const page = { records: [record], cursor };
const reader = (): ProjectionSnapshotReader => ({ scope, read: async () => page });
const context = (service = reader()): InvocationContext => ({ principal, now, clock: () => now, revalidate: async () => principal, services: { projectionSnapshot: service } });
const code = (value: string) => (error: unknown) => error instanceof ToolError && error.code === value;

test('snapshot requires explicit scope and grant with current identity before and after read', async () => {
  let calls = 0; let active = true; const service = reader(); service.read = async () => { calls++; return page; };
  assert.deepEqual(await invokeTool('projection.snapshot.read', scope, context(service)), { ...scope, ...page, outcome: 'snapshot' });
  await assert.rejects(invokeTool('projection.snapshot.read', { ...scope, repository: 'foreign' }, context(service)), code('FORBIDDEN'));
  await assert.rejects(invokeTool('projection.snapshot.read', { ...scope, limit: 1 }, context(service)), code('INVALID_INPUT'));
  await assert.rejects(invokeTool('projection.snapshot.read', scope, { ...context(service), revalidate: async () => ({ ...principal, toolGrants: [] }) }), code('FORBIDDEN'));
  assert.equal(calls, 1);
  service.read = async () => { active = false; return page; };
  await assert.rejects(invokeTool('projection.snapshot.read', scope, { ...context(service), revalidate: async () => active ? principal : null }), code('UNAUTHENTICATED'));
});
test('snapshot rejects duplicate, oversized, foreign and private output without returning partial records', async () => {
  for (const value of [{ ...page, records: [record, record] }, { ...page, records: Array.from({ length: 1001 }, (_, i) => ({ ...record, recordKey: String(i) })) },
    { ...page, cursor: { ...cursor, organizationId: 'foreign' } }, { ...page, content: 'private' }]) {
    const service = reader(); service.read = async () => value;
    await assert.rejects(invokeTool('projection.snapshot.read', scope, context(service)), code('INTERNAL_ERROR'));
  }
});
test('snapshot absence, capacity and unknown failure remain distinct without fabricated checkpoints', async () => {
  await assert.rejects(invokeTool('projection.snapshot.read', scope, { principal, now }), code('UNAVAILABLE'));
  const service = reader(); service.read = async () => ({ records: [], cursor: null });
  assert.deepEqual(await invokeTool('projection.snapshot.read', scope, context(service)), { ...scope, records: [], cursor: null, outcome: 'snapshot' });
  service.read = async () => { throw new ProjectionSnapshotTooLargeError(); };
  await assert.rejects(invokeTool('projection.snapshot.read', scope, context(service)), code('UNAVAILABLE'));
  service.read = async () => { throw new Error('private database message'); };
  await assert.rejects(invokeTool('projection.snapshot.read', scope, context(service)), code('INTERNAL_ERROR'));
});
