import assert from 'node:assert/strict';
import { test } from 'node:test';
import { invokeTool, ToolError, ProjectionCursorResetRequiredError, type InvocationContext, type ProjectionChangeReader } from '../src/index.ts';

const now = new Date('2026-09-05T13:00:00Z');
const principal = { subject: 'synthetic', organizationId: 'org-a', type: 'agent', hats: [], toolGrants: ['projection.changes.read'], expiresAt: '2026-09-05T13:05:00Z' };
const scope = { organizationId: 'org-a', repository: 'github:44' };
const input = { ...scope, cursor: null, limit: 2 };
const cursor = { ...scope, generation: '00000000-0000-4000-8000-000000000045', position: '1' };
const event = { position: '1', recordKey: 'synthetic-record', sourceRevision: 'a'.repeat(40), contentDigest: 'b'.repeat(64) };
const page = { events: [event], cursor, hasMore: false, snapshotRequired: true };
const reader = (): ProjectionChangeReader => ({ scope, read: async () => page });
const context = (service = reader()): InvocationContext => ({ principal, now, clock: () => now, revalidate: async () => principal, services: { projectionChanges: service } });
const code = (value: string) => (error: unknown) => error instanceof ToolError && error.code === value;

test('projection changes authorize exact fixed scope and bounded cursor before reading', async () => {
  let calls = 0; const service = reader(); service.read = async (value, identity) => { calls++; assert.deepEqual(value, { cursor: null, limit: 2 }); assert.deepEqual(identity, principal); return page; };
  assert.deepEqual(await invokeTool('projection.changes.read', input, context(service)), { ...scope, ...page, outcome: 'page' });
  for (const change of [{ organizationId: 'foreign' }, { repository: 'foreign' }, { cursor: { ...cursor, organizationId: 'foreign' } }, { cursor: { ...cursor, repository: 'foreign' } }]) {
    await assert.rejects(invokeTool('projection.changes.read', { ...input, ...change }, context(service)), code('FORBIDDEN'));
  }
  for (const change of [{ limit: 101 }, { limit: 0 }, { limit: 1.5 }, { cursor: { ...cursor, position: '1.1' } }, { paths: ['private'] }]) {
    await assert.rejects(invokeTool('projection.changes.read', { ...input, ...change }, context(service)), code('INVALID_INPUT'));
  }
  assert.equal(calls, 1);
});

test('missing composition, grants, revoked identities, agent hats and expired clocks deny before feed I/O', async () => {
  let calls = 0; const service = reader(); service.read = async () => { calls++; return page; };
  const noRefresh = context(service); delete noRefresh.revalidate;
  for (const ctx of [{ principal, now }, noRefresh]) await assert.rejects(invokeTool('projection.changes.read', input, ctx), code('UNAVAILABLE'));
  for (const current of [null, { ...principal, subject: 'other' }, { ...principal, type: 'human' }, { ...principal, hats: ['product-lead'] }]) {
    await assert.rejects(invokeTool('projection.changes.read', input, { ...context(service), revalidate: async () => current }), code('UNAUTHENTICATED'));
  }
  await assert.rejects(invokeTool('projection.changes.read', input, { ...context(service), revalidate: async () => ({ ...principal, toolGrants: [] }) }), code('FORBIDDEN'));
  for (const clock of [() => new Date(0), () => new Date('invalid'), () => new Date('2026-09-05T13:06:00Z')]) {
    await assert.rejects(invokeTool('projection.changes.read', input, { ...context(service), clock }), code('UNAUTHENTICATED'));
  }
  assert.equal(calls, 0);
});

test('revocation after I/O discards both reference pages and reset outcomes', async () => {
  for (const reset of [false, true]) {
    let active = true; const service = reader();
    service.read = async () => { active = false; if (reset) throw new ProjectionCursorResetRequiredError(); return page; };
    await assert.rejects(invokeTool('projection.changes.read', input, { ...context(service), revalidate: async () => active ? principal : null }), code('UNAUTHENTICATED'));
  }
});

test('malformed, foreign, skipped, truncated and silently reset pages fail without returning references', async () => {
  for (const changed of [{ ...page, private: 'secret' }, { ...page, cursor: { ...cursor, repository: 'foreign' } },
    { ...page, cursor: { ...cursor, position: '2' } }, { ...page, events: [{ ...event, position: '2' }] },
    { ...page, snapshotRequired: false }, { ...page, hasMore: true }, { ...page, cursor: null }]) {
    const service = reader(); service.read = async () => changed;
    await assert.rejects(invokeTool('projection.changes.read', input, context(service)), code('INTERNAL_ERROR'));
  }
  const service = reader(); service.read = async () => ({ events: [], cursor: { ...cursor, generation: '00000000-0000-4000-8000-000000000099' }, hasMore: false, snapshotRequired: false });
  await assert.rejects(invokeTool('projection.changes.read', { ...input, cursor }, context(service)), code('INTERNAL_ERROR'));
  service.read = async () => { throw new Error('private database failure'); };
  await assert.rejects(invokeTool('projection.changes.read', input, context(service)), code('INTERNAL_ERROR'));
});

test('explicit reset, empty feeds, caught-up cursors and exact large positions remain distinct', async () => {
  const service = reader(); service.read = async () => { throw new ProjectionCursorResetRequiredError(); };
  assert.deepEqual(await invokeTool('projection.changes.read', { ...input, cursor }, context(service)), { ...scope, outcome: 'reset-required' });
  service.read = async () => ({ events: [], cursor: null, hasMore: false, snapshotRequired: true });
  assert.equal((await invokeTool('projection.changes.read', input, context(service))).outcome, 'page');
  const large = { ...cursor, position: '9007199254740993' };
  service.read = async () => ({ events: [{ ...event, position: '9007199254740994' }], cursor: { ...large, position: '9007199254740994' }, hasMore: false, snapshotRequired: false });
  const result = await invokeTool('projection.changes.read', { ...input, cursor: large }, context(service));
  assert.equal(result.outcome, 'page'); if (result.outcome === 'page') assert.equal(result.cursor?.position, '9007199254740994');
  service.read = async () => ({ events: [], cursor: large, hasMore: false, snapshotRequired: false });
  assert.equal((await invokeTool('projection.changes.read', { ...input, cursor: large }, context(service))).outcome, 'page');
});
