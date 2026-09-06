import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { createRequestBoundGitHubBriefWriter } from '../src/code-host/github-brief-writer.ts';
import { fixture, now, binding, config, ref } from './github-brief-fixture.ts';
import { invokeTool, type Principal, type InvocationContext } from '@steer/tool-registry';

const principal: Principal = { organizationId: 'org', subject: ref.subject, type: 'human', hats: ['product-lead'],
  toolGrants: ['intent.brief.preview', 'intent.brief.save', 'intent.brief.save.status'],
  expiresAt: new Date(now.getTime() + 60000).toISOString() };
const context = { issuer: 'https://identity.example.invalid/realms/steer', establishedAt: now.toISOString(),
  sessionBinding: 'a'.repeat(64), principal };
function setup(t: TestContext) {
  const f = fixture(t);
  const dependencies = { issuer: context.issuer, authenticate: async (): Promise<unknown> => structuredClone(context),
    verifyAuthority: f.verifyAuthority, fetch: f.transport, appJwt: async () => 'synthetic-app-jwt', now: () => now };
  return { ...f, dependencies, make: () => createRequestBoundGitHubBriefWriter(binding, config, dependencies) };
}

test('request-bound writer verifies twice and commits through actual store into native Git', async (t) => {
  const f = setup(t), writer = f.make();
  assert.equal((await writer.inspect(ref, principal)).outcome, 'not-found');
  const proof = await writer.verifyWriteAuthority(f.request, principal);
  assert.equal(f.approvals(), 1);
  const result = await writer.compareAndCreate(f.request, proof);
  assert.equal(result.outcome, 'committed'); assert.equal(f.approvals(), 2); assert.equal(f.mutations(), 1);
  assert.deepEqual(await f.make().inspect(ref, principal), result);
  assert.deepEqual(await writer.compareAndCreate(f.request, proof), result);
  assert.equal(f.mutations(), 1); assert.equal(f.approvals(), 2);
});

test('shared registry previews, confirms, saves and reads the exact Brief through composed writer', async (t) => {
  const f = setup(t), writer = f.make();
  const invocation: InvocationContext = { principal, now, clock: () => now,
    revalidate: async () => principal, services: { briefWriter: writer } };
  const draft = { title: 'Reduce duplicate intake', problem: 'Coordinators enter requests twice.',
    outcome: 'Each request is entered once.', users: ['Coordinators'], systems: ['Unverified intake system'],
    constraints: ['No new subscription'], openQuestions: ['Confirm the system name'], successMeasure: 'Duplicate count' };
  const preview = await invokeTool('intent.brief.preview', { organizationId: ref.organizationId, draft }, invocation);
  const { subject: _subject, ...scope } = ref;
  const input = { ...scope, expectedHead: f.head(), draft, confirmation: { action: 'accept-rendered-brief',
    templateVersion: 'steer-brief/v1', contentDigest: preview.contentDigest } };
  const saved = await invokeTool('intent.brief.save', input, invocation);
  assert.equal(saved.result.outcome, 'committed'); assert.equal(saved.gateSigned, false);
  if (saved.result.outcome !== 'committed') assert.fail();
  assert.equal(saved.result.contentDigest, preview.contentDigest);
  assert.match(f.git(['show', `${saved.result.revision}:${ref.path}`]), /Reduce duplicate intake/);
  const status = await invokeTool('intent.brief.save.status', scope, { ...invocation, services: { briefWriter: f.make() } });
  assert.deepEqual(status, saved);
  assert.deepEqual(await invokeTool('intent.brief.save', input, { ...invocation, services: { briefWriter: f.make() } }), saved);
  assert.equal(f.mutations(), 1); assert.equal(f.approvals(), 2);
});

test('missing trusted verifier or mismatched binding cannot create a writer', (t) => {
  const f = setup(t);
  assert.throws(() => createRequestBoundGitHubBriefWriter(binding, config, { ...f.dependencies, verifyAuthority: undefined! }));
  assert.throws(() => createRequestBoundGitHubBriefWriter(binding, { ...config, organizationId: 'foreign' }, f.dependencies));
  assert.equal(f.calls.length, 0);
});

test('agent, foreign scope, expired identity and missing grants deny before provider access', async (t) => {
  for (const patch of [{ type: 'agent', hats: [] }, { subject: 'foreign' }, { organizationId: 'foreign' },
    { expiresAt: now.toISOString() }, { toolGrants: [] }, { hats: ['product-lead', 'product-lead'] }]) {
    const f = setup(t); f.dependencies.authenticate = async () => ({ ...context, principal: { ...principal, ...patch } });
    await assert.rejects(f.make().inspect(ref, principal)); assert.equal(f.calls.length, 0);
  }
  const f = setup(t); await assert.rejects(f.make().inspect({ ...ref, path: 'items/9999-foreign/BRIEF.md' }, principal));
  assert.equal(f.calls.length, 0);
});

test('status-only human can read receipt state but cannot obtain write authority', async (t) => {
  const f = setup(t), status = { ...principal, toolGrants: ['intent.brief.save.status'] };
  f.dependencies.authenticate = async () => ({ ...context, principal: status });
  const writer = f.make(); assert.equal((await writer.inspect(ref, status)).outcome, 'not-found');
  const calls = f.calls.length;
  await assert.rejects(writer.verifyWriteAuthority(f.request, status)); assert.equal(f.calls.length, calls);
});

test('fresh authority is mandatory again after write-token issuance; stale or rebound proof cannot mutate', async (t) => {
  for (const patch of [{ gate2DecisionDigest: 'e'.repeat(64) }, { requestDigest: 'e'.repeat(64) },
    { evaluatedAt: new Date(now.getTime() - 6000).toISOString() }, { validThrough: now.toISOString() }]) {
    const f = setup(t), writer = f.make(), proof = await writer.verifyWriteAuthority(f.request, principal);
    f.proof((value) => ({ ...(value as object), ...patch }));
    assert.equal((await writer.compareAndCreate(f.request, proof)).outcome, 'unknown');
    assert.equal(f.approvals(), 2); assert.equal(f.mutations(), 0);
    assert.ok(f.calls.some((call) => call.path.endsWith('/access_tokens')));
  }
});

test('same-instant session replacement, issuer change and revocation during verifier deny', async (t) => {
  for (const change of [{ ...context, sessionBinding: 'b'.repeat(64) }, { ...context, issuer: 'https://foreign.invalid' },
    { ...context, principal: { ...principal, toolGrants: [] } }]) {
    const f = setup(t); let current: unknown = context;
    f.dependencies.authenticate = async () => current;
    f.dependencies.verifyAuthority = async (request) => { const proof = await f.verifyAuthority(request); current = change; return proof; };
    await assert.rejects(f.make().verifyWriteAuthority(f.request, principal)); assert.equal(f.calls.length, 0);
  }
});

test('grant revocation during write-token issuance prevents the final proof call and mutation', async (t) => {
  const f = setup(t); let revoked = false;
  f.dependencies.authenticate = async () => ({ ...context, principal: { ...principal, toolGrants: revoked ? [] : principal.toolGrants } });
  f.override((url, init, result) => {
    if (url.pathname.endsWith('/access_tokens') && JSON.parse(String(init?.body)).permissions.contents === 'write') revoked = true;
    return result;
  });
  const writer = f.make(), proof = await writer.verifyWriteAuthority(f.request, principal);
  assert.equal((await writer.compareAndCreate(f.request, proof)).outcome, 'unknown');
  assert.equal(f.approvals(), 1); assert.equal(f.mutations(), 0);
});

test('supplied principal cannot substitute a different authenticated human', async (t) => {
  const f = setup(t); await assert.rejects(f.make().inspect(ref, { ...principal, subject: 'other' }));
  assert.equal(f.calls.length, 0);
});

test('close and overlapping use deny without continuing a pending authority operation', async (t) => {
  const f = setup(t); let release!: () => void, entered!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const started = new Promise<void>((resolve) => { entered = resolve; });
  f.dependencies.verifyAuthority = async (request) => { entered(); await pending; return f.verifyAuthority(request); };
  const writer = f.make(), work = writer.verifyWriteAuthority(f.request, principal); await started;
  await assert.rejects(writer.inspect(ref, principal)); writer.close(); release(); await assert.rejects(work);
  await assert.rejects(writer.inspect(ref, principal)); assert.equal(f.calls.length, 0);
});

test('lost acknowledgement remains unknown and new authorized status read recovers without retry', async (t) => {
  const f = setup(t), writer = f.make(), proof = await writer.verifyWriteAuthority(f.request, principal); f.loseAck();
  assert.equal((await writer.compareAndCreate(f.request, proof)).outcome, 'unknown');
  assert.equal((await f.make().inspect(ref, principal)).outcome, 'committed'); assert.equal(f.mutations(), 1);
});

test('post-dispatch revocation cannot imply rollback; reauthorized status recovers original commit', async (t) => {
  const f = setup(t); let revoked = false;
  f.dependencies.authenticate = async () => ({ ...context, principal: { ...principal, toolGrants: revoked ? [] : principal.toolGrants } });
  f.override((url, _init, value) => { if (url.pathname === '/graphql') revoked = true; return value; });
  const writer = f.make(), proof = await writer.verifyWriteAuthority(f.request, principal);
  assert.equal((await writer.compareAndCreate(f.request, proof)).outcome, 'unknown'); assert.equal(f.mutations(), 1);
  await assert.rejects(f.make().inspect(ref, principal)); revoked = false;
  const result = await f.make().inspect(ref, principal); assert.equal(result.outcome, 'committed');
  if (result.outcome === 'committed') assert.equal(result.revision, f.head());
  assert.equal(f.mutations(), 1);
});

test('backward clock and logical deadline reject before provider activity', async (t) => {
  for (const times of [[0, 1000, 999], [0, 0, 15000]]) {
    const f = setup(t); let index = 0;
    f.dependencies.now = () => new Date(now.getTime() + times[Math.min(index++, times.length - 1)]!);
    await assert.rejects(f.make().inspect(ref, principal)); assert.equal(f.calls.length, 0);
  }
});

test('hung authentication times out and stays single-flight until it drains, without late provider calls', async (t) => {
  const f = setup(t); let release!: (value: unknown) => void;
  f.dependencies.authenticate = () => new Promise((resolve) => { release = resolve; });
  const writer = f.make(); await assert.rejects(writer.inspect(ref, principal));
  await assert.rejects(writer.inspect(ref, principal)); release(context);
  await new Promise((resolve) => setImmediate(resolve)); assert.equal(f.calls.length, 0);
  writer.close();
});
