import assert from 'node:assert/strict';
import test from 'node:test';
import { invokeTool, describeTools, type Principal, type InvocationContext } from '../src/index.ts';
import { intentScopeDiscoveryOutputSchema, type IntentScopeDiscoveryReader } from '../src/intent-scope-discovery-contracts.ts';
import { scopeDiscoveryFixture } from './intent-scope-discovery.fixture.ts';
function setup() {
  const f = scopeDiscoveryFixture(); let calls = 0;
  const principal: Principal = { organizationId: 'org', subject: 'human', type: 'human', hats: [], toolGrants: ['intent.scope.discover'], expiresAt: new Date(Date.now() + 300000).toISOString() };
  const state = { current: principal as unknown };
  const service: IntentScopeDiscoveryReader = { scope: { ...f.input, subject: 'human' }, async discover(_input, current) { await current(); calls++; return f.output; } };
  const context: InvocationContext = { principal, now: new Date(), revalidate: async () => state.current, services: { intentScopeDiscovery: service } };
  return { f, principal, state, service, context, calls: () => calls };
}
test('scope discovery is a separately granted human metadata query, never a chronological or content claim', async () => {
  const { f, context } = setup(); assert.deepEqual(await invokeTool('intent.scope.discover', f.input, context), f.output);
  assert.equal(describeTools().find(t => t.name === 'intent.scope.discover')?.kind, 'query');
});
test('scope discovery fails closed before service access for foreign scope, missing authority, agents and injected configuration', async () => {
  const { f, context, principal, service, calls } = setup();
  for (const patch of [{ services: {} }, { revalidate: undefined }, { principal: { ...principal, type: 'agent' } }, { principal: { ...principal, toolGrants: ['intent.scope.read'] } },
    { services: { intentScopeDiscovery: { ...service, scope: { ...service.scope, subject: 'foreign' } } } }])
    await assert.rejects(invokeTool('intent.scope.discover', f.input, { ...context, ...patch } as InvocationContext));
  for (const patch of [{ productId: 'other' }, { subject: 'foreign' }, { limit: 100 }, { configurationRevision: 'caller' }, { model: 'caller' }])
    await assert.rejects(invokeTool('intent.scope.discover', { ...f.input, ...patch }, context));
  assert.equal(calls(), 0);
});
test('scope discovery enforces exact source/cursor echoes and final authority', async () => {
  const { f, context, service, state } = setup();
  for (const patch of [{ revision: 2 }, { revisionDigest: 'f'.repeat(64) }, { cursor: f.entry.reviewId }, { contentLoaded: true }, { executionAuthorized: true }]) {
    service.discover = async () => ({ ...f.output, ...patch }); await assert.rejects(invokeTool('intent.scope.discover', f.input, context));
  }
  service.discover = async () => { state.current = null; return f.output; }; await assert.rejects(invokeTool('intent.scope.discover', f.input, context));
});
test('scope metadata pages reject duplicates, unbounded content, expiry and invalid pagination', () => {
  const { output, entry } = scopeDiscoveryFixture();
  for (const patch of [{ entries: [entry, entry] }, { entries: Array(21).fill(entry) }, { observedAt: output.useUntil },
    { nextCursor: entry.reviewId }, { entries: [{ ...entry, title: 'private' }] }, { order: 'newest-first' }])
    assert.equal(intentScopeDiscoveryOutputSchema.safeParse({ ...output, ...patch }).success, false);
  const entries = Array.from({ length: 20 }, (_, i) => ({ ...entry, reviewId: `00000000-0000-4000-8000-${String(20-i).padStart(12, '0')}` }));
  assert.equal(intentScopeDiscoveryOutputSchema.safeParse({ ...output, entries, nextCursor: entries.at(-1)!.reviewId }).success, true);
});
