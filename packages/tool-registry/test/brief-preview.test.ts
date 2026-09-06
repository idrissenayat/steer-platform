import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { invokeTool, ToolError, createOpenApiDocument, type InvocationContext } from '../src/index.ts';
const now = new Date('2026-09-06T12:00:00Z');
const principal = { subject: 'person:synthetic', organizationId: 'org', type: 'human', hats: [],
  toolGrants: ['intent.brief.preview'], expiresAt: '2026-09-06T12:05:00Z' };
const input = { organizationId: 'org', draft: { title: 'Fewer handoffs', problem: 'Requests are duplicated.',
  outcome: 'Enter each request once.', users: ['Coordinators'], systems: ['User-supplied system'],
  constraints: ['No new subscription'], openQuestions: ['Which team owns intake?'], successMeasure: 'Duplicate count' } };
const context = (): InvocationContext => ({ principal, now, clock: () => now, revalidate: async () => principal });
const code = (value: string) => (error: unknown) => error instanceof ToolError && error.code === value;
test('preview binds authenticated author and exact content without persistence or authority', async () => {
  const result = await invokeTool('intent.brief.preview', input, context());
  assert.equal(result.subject, principal.subject); assert.equal(result.organizationId, 'org');
  assert.ok(result.markdown.includes('Originator: Authenticated subject person%3Asynthetic'));
  for (const fact of [input.draft.problem, input.draft.outcome, ...input.draft.systems, ...input.draft.openQuestions]) assert.ok(result.markdown.includes(fact));
  assert.equal(result.contentDigest, createHash('sha256').update(result.markdown).digest('hex'));
  assert.deepEqual(result.missing, []); assert.equal(result.saved, false); assert.equal(result.confirmed, false); assert.equal(result.executionAuthorized, false);
  assert.deepEqual(await invokeTool('intent.brief.preview', input, context()), result);
  const corrected = await invokeTool('intent.brief.preview', { ...input, draft: { ...input.draft, outcome: 'Corrected outcome' } }, context());
  assert.notEqual(corrected.contentDigest, result.contentDigest); assert.equal(corrected.confirmed, false);
});
test('incomplete drafts surface missing facts rather than refusing correction or inventing answers', async () => {
  const result = await invokeTool('intent.brief.preview', { organizationId: 'org', draft: { title: '', problem: '', outcome: '', users: [], systems: [], constraints: [], openQuestions: [], successMeasure: '' } }, context());
  assert.deepEqual(result.missing, ['problem', 'proposed outcome', 'affected users', 'affected systems', 'title', 'success measure']);
  assert.ok(result.markdown.includes('to be captured before Gate 1')); assert.equal(result.confirmed, false);
});
test('preview requires human, explicit grant, current session and exact tenant', async () => {
  for (const [identity, error] of [[null, 'UNAUTHENTICATED'], [{ ...principal, type: 'agent' }, 'FORBIDDEN'],
    [{ ...principal, toolGrants: [] }, 'FORBIDDEN'], [{ ...principal, expiresAt: now.toISOString() }, 'UNAUTHENTICATED']] as const) {
    await assert.rejects(invokeTool('intent.brief.preview', input, { ...context(), principal: identity }), code(error));
  }
  await assert.rejects(invokeTool('intent.brief.preview', { ...input, organizationId: 'foreign' }, context()), code('FORBIDDEN'));
  const unavailable = context(); delete unavailable.revalidate;
  await assert.rejects(invokeTool('intent.brief.preview', input, unavailable), code('UNAVAILABLE'));
});
test('revocation, subject switch, grant loss, clock rollback and expiry deny before releasing preview', async () => {
  for (const replacement of [null, { ...principal, subject: 'another' }, { ...principal, toolGrants: [] }, { ...principal, organizationId: 'foreign' }]) {
    for (const failingCall of [1, 2]) {
      let calls = 0;
      await assert.rejects(invokeTool('intent.brief.preview', input, { ...context(), revalidate: async () => ++calls === failingCall ? replacement : principal }), (error) => error instanceof ToolError);
    }
  }
  for (const clock of [new Date(now.getTime() - 1), new Date(principal.expiresAt), new Date(NaN)]) {
    await assert.rejects(invokeTool('intent.brief.preview', input, { ...context(), clock: () => clock }), code('UNAUTHENTICATED'));
  }
});
test('closed bounded input excludes forged author, signatures, target and oversized fields', async () => {
  for (const value of [{ ...input, confirmed: true }, { ...input, repository: 'github:52' },
    { ...input, draft: { ...input.draft, author: 'forged' } }, { ...input, draft: { ...input.draft, title: 'x\n## Problem' } },
    { ...input, draft: { ...input.draft, problem: 'x'.repeat(4001) } },
    { ...input, draft: { ...input.draft, users: Array(21).fill('person') } },
    { ...input, draft: { ...input.draft, constraints: Array(20).fill('界'.repeat(1000)) } }]) {
    await assert.rejects(invokeTool('intent.brief.preview', value, context()), code('INVALID_INPUT'));
  }
});
test('preview is discoverable as a read-only contract without write or signature capability', () => {
  const document = createOpenApiDocument();
  assert.equal(document.paths['/v1/tools/intent.brief.preview']?.post['x-steer-kind'], 'query');
  assert.equal(document.paths['/v1/tools/intent.brief.save'], undefined);
});
