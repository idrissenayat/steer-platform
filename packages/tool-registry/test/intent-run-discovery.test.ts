import assert from 'node:assert/strict';
import test from 'node:test';
import { invokeTool, describeTools, type Principal, type InvocationContext } from '../src/index.ts';
import { intentRunDiscoveryOutputSchema, runCursorFor, type IntentRunDiscoveryReader } from '../src/intent-run-discovery-contracts.ts';
import { runDiscoveryFixture } from './intent-run-discovery.fixture.ts';
function setup() {
  const f = runDiscoveryFixture(); let calls = 0;
  const principal: Principal = { organizationId: 'org', subject: 'human', type: 'human', hats: [], toolGrants: ['intent.runs.discover'], expiresAt: new Date(Date.now() + 300000).toISOString() };
  const state = { current: principal as unknown };
  const service: IntentRunDiscoveryReader = { scope: { ...f.input, subject: 'human' }, async discover(_input, current) { await current(); calls++; return f.output; } };
  const context: InvocationContext = { principal, now: new Date(), revalidate: async () => state.current, services: { intentRunDiscovery: service } };
  return { f, principal, state, service, context, calls: () => calls };
}
test('all-revision run discovery is a separately authorized human query with no content or execution claim', async () => {
  const { f, context } = setup(); assert.deepEqual(await invokeTool('intent.runs.discover', f.input, context), f.output);
  assert.equal(describeTools().find(t => t.name === 'intent.runs.discover')?.kind, 'query');
});
test('run discovery denies agents, wrong grants, scope and injected configuration before service access', async () => {
  const { f, context, principal, service, calls } = setup();
  for (const patch of [{ services: {} }, { revalidate: undefined }, { principal: { ...principal, type: 'agent' } }, { principal: { ...principal, toolGrants: ['intent.draft.discover'] } },
    { services: { intentRunDiscovery: { ...service, scope: { ...service.scope, subject: 'foreign' } } } }])
    await assert.rejects(invokeTool('intent.runs.discover', f.input, { ...context, ...patch } as InvocationContext));
  for (const patch of [{ productId: 'other' }, { subject: 'foreign' }, { limit: 100 }, { configurationRevision: 'caller' }, { model: 'caller' }])
    await assert.rejects(invokeTool('intent.runs.discover', { ...f.input, ...patch }, context));
  assert.equal(calls(), 0);
});
test('run discovery enforces exact cursor/owner echoes and final identity', async () => {
  const { f, context, service, state } = setup();
  for (const patch of [{ draftId: f.output.entries[0]!.kind === 'development' ? f.output.entries[0]!.operationId : '' }, { contentLoaded: true }, { executionAuthorized: true },
    { cursor: runCursorFor(f.output.entries[1]!, f.output.latest.revisionDigest) }]) {
    service.discover = async () => ({ ...f.output, ...patch }); await assert.rejects(invokeTool('intent.runs.discover', f.input, context));
  }
  service.discover = async () => { state.current = null; return f.output; }; await assert.rejects(invokeTool('intent.runs.discover', f.input, context));
});
test('run pages reject mixed source bindings, invented chronology, duplicates, expired metadata and bad keysets', () => {
  const { output } = runDiscoveryFixture(), entry = output.entries[1]!;
  if (entry.kind !== 'scope') throw new Error('Expected synthetic scope entry');
  for (const patch of [{ entries: [entry, entry] }, { entries: [...output.entries].reverse() }, { entries: Array(21).fill(entry) },
    { entries: [{ ...entry, content: 'private' }] }, { observedAt: output.useUntil }, { order: 'newest-first' },
    { entries: [output.entries[0], { ...entry, source: { ...entry.source, scopeInputDigest: 'f'.repeat(64) } }] },
    { entries: [{ ...entry, source: { ...entry.source, revision: 3 } }] }, { nextCursor: runCursorFor(entry, output.latest.revisionDigest) }])
    assert.equal(intentRunDiscoveryOutputSchema.safeParse({ ...output, ...patch }).success, false);
  const entries = Array.from({ length: 20 }, (_, i) => ({ ...entry, kind: 'scope' as const, reviewId: `00000000-0000-4000-8000-${String(20-i).padStart(12, '0')}` }));
  assert.equal(intentRunDiscoveryOutputSchema.safeParse({ ...output, entries, nextCursor: runCursorFor(entries.at(-1)!, output.latest.revisionDigest) }).success, true);
});
