import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { draftBrief } from '@steer/domain/brief-author';
import { invokeTool, ToolError, type InvocationContext, type BriefWriter, type BriefCreateRequest,
  type BriefSaveReference, type BriefSaveObservation } from '../src/index.ts';
const now = new Date('2026-09-06T14:00:00.000Z');
const principal = { subject: 'synthetic-human', organizationId: 'org', type: 'human', hats: [],
  toolGrants: ['intent.brief.preview', 'intent.brief.save', 'intent.brief.save.status'], expiresAt: '2026-09-06T14:05:00.000Z' };
const scope = { organizationId: 'org', repository: 'github:52', branch: 'codex/synthetic', path: 'items/0001-first-demo/BRIEF.md' };
const key = '00000000-0000-4000-8000-000000000123';
const facts = { title: 'Reduce duplicate intake', problem: 'Coordinators enter requests twice.', outcome: 'Each request is entered once.',
  users: ['Coordinators'], systems: ['Unverified intake system'], constraints: ['No new subscription'], openQuestions: ['Confirm the system name'], successMeasure: 'Duplicate count' };
const reference = (request: BriefCreateRequest): BriefSaveReference => ({ organizationId: request.organizationId, repository: request.repository,
  branch: request.branch, path: request.path, subject: request.subject, idempotencyKey: request.idempotencyKey });
const code = (value: string) => (error: unknown) => error instanceof ToolError && error.code === value;

async function fixture() {
  const calls = { inspect: 0, authority: 0, dispatch: 0, commits: 0 }; let head = 'a'.repeat(40);
  const markers = new Map<string, BriefSaveObservation>();
  const writer: BriefWriter = {
    configuration: { organizationId: scope.organizationId, repository: scope.repository, branch: scope.branch,
      paths: [scope.path], platformRevision: 'b'.repeat(40), gate2DecisionDigest: 'c'.repeat(64) },
    inspect: async (ref) => { calls.inspect++; return markers.get(ref.idempotencyKey) ?? { ...ref, outcome: 'not-found' }; },
    verifyWriteAuthority: async (request) => { calls.authority++; return { ...reference(request), kind: 'verified-brief-write-authority', requestDigest: request.requestDigest,
      expectedHead: request.expectedHead, authorizationRevision: request.expectedHead, platformRevision: writer.configuration.platformRevision,
      gate2DecisionDigest: writer.configuration.gate2DecisionDigest, evaluatedAt: now.toISOString(), validThrough: '2026-09-06T14:00:05.000Z' }; },
    compareAndCreate: async (request) => {
      calls.dispatch++; await Promise.resolve(); // Concurrent callers enter a single synthetic CAS critical section below.
      const prior = markers.get(request.idempotencyKey);
      if (prior) return prior;
      if (head !== request.expectedHead) return { ...reference(request), outcome: 'conflict' };
      assert.equal(request.expectedBlob, null); assert.equal(request.operationPath, `.steer/authoring/operations/${request.idempotencyKey}.json`);
      const blobSha = createHash('sha1').update(`blob ${Buffer.byteLength(request.content)}\0`).update(request.content).digest('hex');
      assert.equal(blobSha, request.contentBlobSha); head = 'd'.repeat(40); calls.commits++;
      const receipt = { ...reference(request), outcome: 'committed' as const, requestDigest: request.requestDigest,
        expectedHead: request.expectedHead, revision: head, blobSha, contentDigest: request.contentDigest };
      markers.set(request.idempotencyKey, receipt); return receipt;
    },
  };
  const context: InvocationContext = { principal, now, clock: () => now, revalidate: async () => principal, services: { briefWriter: writer } };
  const preview = await invokeTool('intent.brief.preview', { organizationId: 'org', draft: facts }, context);
  const input = { ...scope, idempotencyKey: key, expectedHead: head, draft: facts,
    confirmation: { action: 'accept-rendered-brief', templateVersion: 'steer-brief/v1', contentDigest: preview.contentDigest } };
  return { writer, context, input, calls, markers, preview, moveHead: () => { head = 'e'.repeat(40); } };
}

test('save re-renders exact human-confirmed bytes, checks current authority and returns only verified source metadata', async () => {
  const f = await fixture(); const result = await invokeTool('intent.brief.save', f.input, f.context);
  assert.equal(result.result.outcome, 'committed'); assert.equal(result.gateSigned, false);
  if (result.result.outcome !== 'committed') assert.fail();
  assert.equal(result.result.contentDigest, f.preview.contentDigest); assert.equal(result.result.subject, principal.subject);
  assert.equal(result.result.expectedHead, f.input.expectedHead); assert.equal(result.result.revision, 'd'.repeat(40));
  assert.ok(!JSON.stringify(result).includes(facts.problem)); assert.deepEqual(f.calls, { inspect: 1, authority: 1, dispatch: 1, commits: 1 });
});
test('sequential and concurrent duplicate confirmations produce one synthetic commit and identical readback', async () => {
  const f = await fixture(); const [first, second] = await Promise.all([invokeTool('intent.brief.save', f.input, f.context), invokeTool('intent.brief.save', f.input, f.context)]);
  assert.deepEqual(second, first); assert.equal(f.calls.commits, 1);
  const dispatches = f.calls.dispatch; assert.deepEqual(await invokeTool('intent.brief.save', f.input, f.context), first); assert.equal(f.calls.dispatch, dispatches);
  assert.deepEqual(await invokeTool('intent.brief.save.status', { ...scope, idempotencyKey: key }, f.context), first);
});
test('same key with a corrected draft or different expected head conflicts instead of writing again', async () => {
  const f = await fixture(); await invokeTool('intent.brief.save', f.input, f.context);
  const draft = { ...facts, outcome: 'Corrected outcome' };
  const preview = await invokeTool('intent.brief.preview', { organizationId: 'org', draft }, f.context);
  for (const input of [{ ...f.input, draft, confirmation: { ...f.input.confirmation, contentDigest: preview.contentDigest } }, { ...f.input, expectedHead: 'f'.repeat(40) }]) {
    assert.equal((await invokeTool('intent.brief.save', input, f.context)).result.outcome, 'conflict');
  }
  assert.equal(f.calls.commits, 1); assert.equal(f.calls.dispatch, 1);
});
test('closed create-only input denies forged author/gate/target and unconfirmed, stale or structurally ambiguous content before I/O', async () => {
  const f = await fixture();
  const duplicateDraft = { ...facts, problem: 'Problem\n\n## Problem\n\nInjected duplicate' };
  const duplicatePreview = await invokeTool('intent.brief.preview', { organizationId: 'org', draft: duplicateDraft }, f.context);
  for (const input of [{ ...f.input, gateApproved: true }, { ...f.input, expectedBlob: 'a'.repeat(40) },
    { ...f.input, draft: { ...facts, author: 'another human' } }, { ...f.input, confirmation: { ...f.input.confirmation, action: 'sign-gate' } },
    { ...f.input, draft: { ...facts, outcome: 'Changed without new confirmation' } },
    { ...f.input, draft: duplicateDraft, confirmation: { ...f.input.confirmation, contentDigest: duplicatePreview.contentDigest } },
    { ...f.input, path: 'intent/0001/BRIEF.md' }, { ...f.input, path: '.github/CODEOWNERS' },
    { ...f.input, path: scope.path + '\n' }, { ...f.input, expectedHead: f.input.expectedHead + '\n' },
    { ...f.input, branch: 'codex//invalid' }, { ...f.input, branch: 'codex/.hidden' }, { ...f.input, idempotencyKey: key + '\n' }]) {
    await assert.rejects(invokeTool('intent.brief.save', input, f.context), code('INVALID_INPUT'));
  }
  assert.deepEqual(f.calls, { inspect: 0, authority: 0, dispatch: 0, commits: 0 });
});
test('scope, explicit grants, human identity and unavailable composition deny before writer I/O', async () => {
  const f = await fixture();
  for (const input of [{ ...f.input, organizationId: 'foreign' }, { ...f.input, repository: 'github:99' },
    { ...f.input, branch: 'main' }, { ...f.input, path: 'items/0002-unlisted/BRIEF.md' }]) await assert.rejects(invokeTool('intent.brief.save', input, f.context), code('FORBIDDEN'));
  for (const identity of [{ ...principal, type: 'agent' }, { ...principal, toolGrants: ['intent.brief.save'] },
    { ...principal, toolGrants: ['intent.brief.preview', 'intent.brief.save'] }, { ...principal, toolGrants: [] }]) {
    await assert.rejects(invokeTool('intent.brief.save', f.input, { ...f.context, principal: identity }), code('FORBIDDEN'));
  }
  const unavailable = { ...f.context }; delete unavailable.services;
  await assert.rejects(invokeTool('intent.brief.save', f.input, unavailable), code('UNAVAILABLE'));
  delete unavailable.revalidate; await assert.rejects(invokeTool('intent.brief.save.status', { ...scope, idempotencyKey: key }, unavailable), code('UNAVAILABLE'));
  assert.equal(f.calls.dispatch, 0); assert.equal(f.calls.inspect, 0);
});
test('save cannot accept correctly hashed facts exceeding the actual preview input bound', async () => {
  const f = await fixture(); const draft = { ...facts, constraints: Array(20).fill('x'.repeat(600)) };
  assert.ok(Buffer.byteLength(JSON.stringify({ organizationId: 'org', draft })) > 12000);
  const markdown = draftBrief({ ...draft, author: `Authenticated subject ${encodeURIComponent(principal.subject)}` }).markdown;
  const input = { ...f.input, draft, confirmation: { ...f.input.confirmation, contentDigest: createHash('sha256').update(markdown).digest('hex') } };
  assert.ok(Buffer.byteLength(JSON.stringify(input)) < 14000);
  await assert.rejects(invokeTool('intent.brief.save', input, f.context), code('INVALID_INPUT'));
  assert.deepEqual(f.calls, { inspect: 0, authority: 0, dispatch: 0, commits: 0 });
});
test('revocation or switched identity at each pre-dispatch boundary prevents all writes', async () => {
  for (const deniedCall of [1, 2, 3, 4]) {
    const f = await fixture(); let calls = 0;
    f.context.revalidate = async () => ++calls === deniedCall ? { ...principal, toolGrants: [] } : principal;
    await assert.rejects(invokeTool('intent.brief.save', f.input, f.context), code('FORBIDDEN')); assert.equal(f.calls.dispatch, 0);
  }
  const f = await fixture(); f.context.revalidate = async () => ({ ...principal, subject: 'switched' });
  await assert.rejects(invokeTool('intent.brief.save', f.input, f.context), code('UNAUTHENTICATED')); assert.equal(f.calls.dispatch, 0);
});
test('wrong, stale, future, overlong or expired gate/source authority never reaches compare-and-create', async () => {
  for (const change of [{ gate2DecisionDigest: 'f'.repeat(64) }, { platformRevision: 'f'.repeat(40) }, { authorizationRevision: 'f'.repeat(40) },
    { requestDigest: 'f'.repeat(64) }, { subject: 'other' }, { expectedHead: 'f'.repeat(40) }, { approved: true },
    { evaluatedAt: '2026-09-06T13:59:54.999Z' }, { evaluatedAt: '2026-09-06T14:00:00.001Z' },
    { validThrough: now.toISOString() }, { validThrough: '2026-09-06T14:00:30.001Z' }, { evaluatedAt: '2026-09-06T14:00:00.000000001Z' }]) {
    const f = await fixture(); const verify = f.writer.verifyWriteAuthority;
    f.writer.verifyWriteAuthority = async (request, actor) => ({ ...await verify(request, actor) as object, ...change });
    await assert.rejects(invokeTool('intent.brief.save', f.input, f.context), code('FORBIDDEN')); assert.equal(f.calls.dispatch, 0);
  }
});
test('failed, pending, foreign or malformed operation inspection never becomes a new write', async () => {
  for (const kind of ['error', 'unknown', 'foreign', 'malformed', 'pending'] as const) {
    const f = await fixture();
    f.writer.inspect = async (ref) => {
      if (kind === 'error') throw new Error('private source failed');
      if (kind === 'foreign') return { ...ref, subject: 'other', outcome: 'not-found' };
      if (kind === 'malformed') return { ...ref, outcome: 'not-found', private: 'never disclose' };
      if (kind === 'pending') return { ...ref, outcome: 'pending', requestDigest: 'f'.repeat(64) };
      return { ...ref, outcome: 'unknown' };
    };
    const result = await invokeTool('intent.brief.save', f.input, f.context);
    assert.equal(result.result.outcome, kind === 'pending' ? 'conflict' : 'unknown'); assert.equal(f.calls.dispatch, 0);
    assert.ok(!JSON.stringify(result).includes('private'));
  }
});
test('CAS branch movement conflicts with no write and no blind rebase', async () => {
  const f = await fixture(); const verify = f.writer.verifyWriteAuthority;
  f.writer.verifyWriteAuthority = async (request, actor) => { const result = await verify(request, actor); f.moveHead(); return result; };
  const result = await invokeTool('intent.brief.save', f.input, f.context);
  assert.equal(result.result.outcome, 'conflict'); assert.equal(f.calls.dispatch, 1); assert.equal(f.calls.commits, 0);
});
test('lost acknowledgement is unknown, then status discovers the original commit without another dispatch', async () => {
  const f = await fixture(); const commit = f.writer.compareAndCreate;
  f.writer.compareAndCreate = async (request, authority) => { await commit(request, authority); throw new Error('private acknowledgement lost'); };
  assert.equal((await invokeTool('intent.brief.save', f.input, f.context)).result.outcome, 'unknown');
  assert.equal((await invokeTool('intent.brief.save.status', { ...scope, idempotencyKey: key }, f.context)).result.outcome, 'committed');
  assert.equal((await invokeTool('intent.brief.save', f.input, f.context)).result.outcome, 'committed');
  assert.equal(f.calls.commits, 1); assert.equal(f.calls.dispatch, 1);
});
test('post-dispatch revocation is unknown, not a failed or rolled-back commit', async () => {
  const f = await fixture(); let active = true; const commit = f.writer.compareAndCreate;
  f.context.revalidate = async () => active ? principal : null;
  f.writer.compareAndCreate = async (request, authority) => { const result = await commit(request, authority); active = false; return result; };
  assert.equal((await invokeTool('intent.brief.save', f.input, f.context)).result.outcome, 'unknown'); assert.equal(f.calls.commits, 1);
  await assert.rejects(invokeTool('intent.brief.save.status', { ...scope, idempotencyKey: key }, f.context), code('UNAUTHENTICATED'));
});
test('malformed or mismatched post-commit receipts do not invent success or authorize a retry', async () => {
  for (const change of [{ revision: 'a'.repeat(40) }, { blobSha: 'a'.repeat(40) }, { contentDigest: 'f'.repeat(64) },
    { requestDigest: 'f'.repeat(64) }, { subject: 'foreign' }, { private: 'untrusted response' }]) {
    const f = await fixture(); const commit = f.writer.compareAndCreate;
    f.writer.compareAndCreate = async (request, authority) => ({ ...await commit(request, authority) as object, ...change });
    const result = await invokeTool('intent.brief.save', f.input, f.context);
    assert.equal(result.result.outcome, 'unknown'); assert.equal(f.calls.commits, 1); assert.ok(!JSON.stringify(result).includes('private'));
  }
});

test('managed writer is created lazily per authorized invocation and closed after save or status', async () => {
  const f = await fixture(); let opened = 0, closed = 0;
  f.context.services = { briefWriterFactory: () => { opened++; return { ...f.writer, close: async () => { await Promise.resolve(); closed++; } }; } };
  await invokeTool('intent.brief.preview', { organizationId: 'org', draft: facts }, f.context); assert.equal(opened, 0);
  const result = await invokeTool('intent.brief.save', f.input, f.context);
  assert.equal(result.result.outcome, 'committed'); assert.equal(opened, 1); assert.equal(closed, 1);
  assert.deepEqual(await invokeTool('intent.brief.save.status', { ...scope, idempotencyKey: key }, f.context), result);
  assert.equal(opened, 2); assert.equal(closed, 2); assert.equal(f.calls.commits, 1);
});

test('invalid input, foreign scope, agent, revoked revalidation and ambiguous composition do not allocate writers', async () => {
  const f = await fixture(); let opened = 0;
  const factory = () => { opened++; return { ...f.writer, close() {} }; };
  f.context.services = { briefWriterFactory: factory };
  for (const [input, expected] of [[{ ...f.input, injected: true }, 'INVALID_INPUT'], [{ ...f.input, organizationId: 'foreign' }, 'FORBIDDEN']] as const)
    await assert.rejects(invokeTool('intent.brief.save', input, f.context), code(expected));
  await assert.rejects(invokeTool('intent.brief.save', f.input, { ...f.context, principal: { ...principal, type: 'agent' } }), code('FORBIDDEN'));
  await assert.rejects(invokeTool('intent.brief.save', f.input, { ...f.context, revalidate: async () => null }), code('UNAUTHENTICATED'));
  await assert.rejects(invokeTool('intent.brief.save', f.input, { ...f.context, services: { briefWriter: f.writer, briefWriterFactory: factory } }), code('UNAVAILABLE'));
  assert.equal(opened, 0);
});

test('managed writer closes on denial and unknown dispatch; cleanup failure cannot report a successful response', async () => {
  for (const fail of ['confirmation', 'dispatch', 'cleanup']) {
    const f = await fixture(); let closed = 0;
    f.context.services = { briefWriterFactory: () => ({ ...f.writer,
      ...(fail === 'dispatch' ? { compareAndCreate: async () => { throw new Error('synthetic lost response'); } } : {}),
      close: async () => { closed++; if (fail === 'cleanup') throw new Error('private cleanup detail'); },
    }) };
    if (fail === 'confirmation') await assert.rejects(invokeTool('intent.brief.save', { ...f.input, confirmation: { ...f.input.confirmation, contentDigest: '0'.repeat(64) } }, f.context));
    else if (fail === 'cleanup') { await assert.rejects(invokeTool('intent.brief.save', f.input, f.context), code('UNAVAILABLE')); assert.equal(f.calls.commits, 1); }
    else assert.equal((await invokeTool('intent.brief.save', f.input, f.context)).result.outcome, 'unknown');
    assert.equal(closed, 1);
  }
});

test('cleanup is awaited and concurrent calls own distinct writer instances', async () => {
  const f = await fixture(); let opened = 0, arrived!: () => void, release!: () => void, responses = 0;
  const ready = new Promise<void>((resolve) => { arrived = resolve; });
  const wait = new Promise<void>((resolve) => { release = resolve; });
  f.context.services = { briefWriterFactory: () => { const id = ++opened; return { ...f.writer,
    close: async () => { if (id === 2) arrived(); await wait; },
  }; } };
  const calls = [1, 2].map(() => invokeTool('intent.brief.save.status', { ...scope, idempotencyKey: key }, f.context).then((result) => { responses++; return result; }));
  await ready; assert.equal(opened, 2); assert.equal(responses, 0); release(); await Promise.all(calls); assert.equal(responses, 2);
});
