import assert from 'node:assert/strict';
import test from 'node:test';
import { invokeTool, describeTools, type Principal, type InvocationContext } from '../src/index.ts';
import { intentDraftDiscoveryOutputSchema, type IntentDraftDiscoveryReader } from '../src/intent-draft-discovery-contracts.ts';
import { discoveryFixture } from './intent-draft-discovery.fixture.ts';

function setup() {
  const f = discoveryFixture(); let calls = 0;
  const principal: Principal = { organizationId: 'org', subject: 'human', type: 'human', hats: [], toolGrants: ['intent.draft.discover'], expiresAt: new Date(Date.now() + 300000).toISOString() };
  const state = { current: principal as unknown };
  const service: IntentDraftDiscoveryReader = { scope: { ...f.input, subject: 'human' },
    async discover(_input, current) { await current(); calls++; return f.output; } };
  const context: InvocationContext = { principal, now: new Date(), revalidate: async () => state.current, services: { intentDraftDiscovery: service } };
  return { f, service, principal, state, context, calls: () => calls };
}
test('draft discovery is a human query that returns bounded references, never content or execution authority', async () => {
  const { f, context } = setup(); assert.deepEqual(await invokeTool('intent.draft.discover', f.input, context), f.output);
  assert.equal(describeTools().find(t => t.name === 'intent.draft.discover')?.kind, 'query');
});
test('discovery rejects foreign scope, agent identity, missing service/grant and injected fields before reading', async () => {
  const { f, context, principal, service, calls } = setup();
  for (const patch of [{ services: {} }, { revalidate: undefined }, { principal: { ...principal, type: 'agent' } },
    { principal: { ...principal, toolGrants: [] } }, { services: { intentDraftDiscovery: { ...service, scope: { ...service.scope, subject: 'other' } } } }])
    await assert.rejects(invokeTool('intent.draft.discover', f.input, { ...context, ...patch } as InvocationContext));
  for (const patch of [{ productId: 'other' }, { subject: 'other' }, { limit: 100 }]) await assert.rejects(invokeTool('intent.draft.discover', { ...f.input, ...patch }, context));
  assert.equal(calls(), 0);
});
test('discovery validates exact cursor/scope echoes and suppresses late permission loss', async () => {
  const { f, context, service, state } = setup();
  for (const patch of [{ productId: 'other' }, { cursor: { createdAt: f.entry.createdAt, draftId: f.entry.draftId } }, { contentLoaded: true }, { executionAuthorized: true }]) {
    service.discover = async () => ({ ...f.output, ...patch }); await assert.rejects(invokeTool('intent.draft.discover', f.input, context));
  }
  service.discover = async () => { state.current = null; return f.output; };
  await assert.rejects(invokeTool('intent.draft.discover', f.input, context));
});
test('discovery pages enforce order, unique IDs, active lifetime, bounded pagination and no run without content metadata', () => {
  const { entry, output } = discoveryFixture();
  for (const patch of [{ entries: [entry, entry] }, { entries: Array(21).fill(entry) }, { observedAt: entry.useUntil },
    { entries: [{ ...entry, latest: null }] }, { nextCursor: { createdAt: entry.createdAt, draftId: entry.draftId } },
    { entries: [{ ...entry, latest: { ...entry.latest, sourceRevision: 2 } }] }, { entries: [{ ...entry, title: 'Private content' }] }])
    assert.equal(intentDraftDiscoveryOutputSchema.safeParse({ ...output, ...patch }).success, false);
  assert.equal(intentDraftDiscoveryOutputSchema.safeParse({ ...output, entries: [{ ...entry, latest: null, run: null }] }).success, true);
  const entries = Array.from({ length: 20 }, (_, i) => ({ ...entry, draftId: `00000000-0000-4000-8000-${String(20 - i).padStart(12, '0')}` }));
  assert.equal(intentDraftDiscoveryOutputSchema.safeParse({ ...output, entries, nextCursor: { createdAt: entry.createdAt, draftId: entries.at(-1)!.draftId } }).success, true);
});
