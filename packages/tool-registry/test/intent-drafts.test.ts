import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { invokeTool, ToolError, describeTools, type InvocationContext, type Principal } from '../src/index.ts';
import { describeIntentDraftRevision } from '../src/intent-draft-content.ts';
import type { IntentDraftService } from '../src/intent-draft-contracts.ts';

async function fixture() {
  const scope = { organizationId: 'org', productId: 'product', repository: 'github:52' }, draftId = randomUUID(), mutationId = randomUUID();
  const now = new Date('2026-09-08T10:00:00.000Z');
  const principal: Principal = { subject: 'human', organizationId: scope.organizationId, type: 'human', hats: [],
    toolGrants: ['intent.draft.create', 'intent.draft.append', 'intent.draft.read'], expiresAt: new Date(now.getTime() + 60000).toISOString() };
  const content = { originalText: ' Verbatim intent 🌸\r\n', clarificationTurns: [], documents: { brief: ' Brief ', spec: ' Spec\r\n', exam: ' NOT RUN ' } };
  const described = await describeIntentDraftRevision({ ...scope, draftId }, content, null);
  const reference = { draftId, revision: 1, revisionDigest: 'a'.repeat(64), sourceRevision: 1, scopeInputDigest: described.scopeInputDigest, latestRevision: 1, savedToGit: false as const };
  const state = { calls: 0, fresh: principal as unknown };
  const service: IntentDraftService = { scope: { ...scope, subject: principal.subject },
    create: async (input, revalidate) => { await revalidate(); state.calls++; return { outcome: 'created', requestId: input.requestId, draftId,
      createdAt: now.toISOString(), useUntil: new Date(now.getTime() + 60000).toISOString(), retentionDeadline: new Date(now.getTime() + 60000).toISOString(), contentPreserved: false, savedToGit: false }; },
    append: async (_input, revalidate) => { await revalidate(); state.calls++; return { ...reference, outcome: 'acknowledged', mutationId }; },
    read: async (_input, revalidate) => { await revalidate(); state.calls++; return { ...reference, content }; },
  };
  const context: InvocationContext = { principal, now, clock: () => now, revalidate: async () => state.fresh, services: { intentDrafts: service } };
  return { scope, draftId, mutationId, now, principal, content, reference, state, service, context,
    append: { ...scope, draftId, mutationId, expectedRevision: 0, expectedDigest: null, content }, read: { ...scope, draftId, revision: 'latest' as const } };
}
test('draft tools expose exact content and acknowledgement contracts without generation, Git save or gate claims', async () => {
  const f = await fixture();
  const created = await invokeTool('intent.draft.create', { ...f.scope, requestId: randomUUID() }, f.context);
  assert.equal(created.outcome, 'created'); assert.equal(created.savedToGit, false);
  const appended = await invokeTool('intent.draft.append', f.append, f.context); assert.equal(appended.outcome, 'acknowledged');
  const read = await invokeTool('intent.draft.read', f.read, f.context); assert.deepEqual(read.content, f.content); assert.equal(read.savedToGit, false);
  assert.equal(f.state.calls, 3);
  assert.deepEqual(describeTools().filter(v => v.name.startsWith('intent.draft.')).map(v => v.name).sort(),
    ['intent.draft.append', 'intent.draft.create', 'intent.draft.discover', 'intent.draft.read']);
});
test('draft access denies agents, foreign owner/product/repository, expired identity and missing services or grants before calls', async () => {
  const f = await fixture();
  const { revalidate: _revalidate, ...withoutRevalidation } = f.context;
  for (const context of [{ ...f.context, principal: { ...f.principal, type: 'agent' } }, { ...f.context, principal: { ...f.principal, toolGrants: [] } },
    { ...f.context, services: {} }, withoutRevalidation, { ...f.context, principal: { ...f.principal, expiresAt: f.now.toISOString() } }])
    await assert.rejects(invokeTool('intent.draft.read', f.read, context), ToolError);
  for (const input of [{ ...f.read, productId: 'other' }, { ...f.read, repository: 'other' }, { ...f.read, subject: 'other' },
    { ...f.read, organizationId: 'other' }]) await assert.rejects(invokeTool('intent.draft.read', input, f.context), ToolError);
  f.state.fresh = { ...f.principal, subject: 'other' }; await assert.rejects(invokeTool('intent.draft.read', f.read, f.context), ToolError); assert.equal(f.state.calls, 0);
});
test('draft read never releases private output when identity or grant changes during service I/O', async () => {
  for (const fresh of [null, { subject: 'other' }, { toolGrants: [] }]) {
    const f = await fixture(); f.service.read = async () => { f.state.fresh = fresh === null ? null : { ...f.principal, ...fresh }; return { ...f.reference, content: f.content }; };
    await assert.rejects(invokeTool('intent.draft.read', f.read, f.context), ToolError);
  }
});
test('draft acknowledgement/readback rejects substituted revisions, source fingerprints, extra authority and private failures', async () => {
  const f = await fixture();
  for (const output of [{ ...f.reference, content: f.content, savedToGit: true }, { ...f.reference, content: f.content, approved: true },
    { ...f.reference, content: { ...f.content, originalText: 'substitute' } }, { ...f.reference, content: f.content, draftId: randomUUID() }]) {
    f.service.read = async () => output; await assert.rejects(invokeTool('intent.draft.read', f.read, f.context), ToolError);
  }
  f.service.append = async () => ({ ...f.reference, outcome: 'acknowledged', mutationId: randomUUID() });
  await assert.rejects(invokeTool('intent.draft.append', f.append, f.context), ToolError);
  f.service.read = async () => { throw new Error('private secret detail'); };
  await assert.rejects(invokeTool('intent.draft.read', f.read, f.context), /^Error: The required service is not configured or available\.$/);
});
test('unknown and conflict draft writes remain explicit and malformed parents or authority-bearing content deny before writes', async () => {
  const f = await fixture();
  for (const outcome of ['unknown', 'conflict', 'unavailable']) {
    f.service.append = async () => ({ outcome, savedToGit: false }); assert.equal((await invokeTool('intent.draft.append', f.append, f.context)).outcome, outcome);
  }
  for (const input of [{ ...f.append, expectedDigest: 'a'.repeat(64) }, { ...f.append, mutationId: f.mutationId + '\n' },
    { ...f.append, content: { ...f.content, gateSigned: true } }]) await assert.rejects(invokeTool('intent.draft.append', input, f.context), ToolError);
  assert.equal(f.state.calls, 0);
});
