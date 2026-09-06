import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { createGitHubBriefWriterFactory } from '../src/code-host/github-brief-writer-factory.ts';
import { fixture, binding, config, ref, now } from './github-brief-fixture.ts';

const issuer = 'https://identity.example/realms/steer', authorizationPath = 'access/authorization.json';
const principal = { organizationId: 'org', subject: ref.subject, type: 'human' as const, hats: ['product-lead' as const],
  toolGrants: ['intent.brief.preview', 'intent.brief.save', 'intent.brief.save.status'], expiresAt: new Date(now.getTime() + 60000).toISOString() };
const context = { issuer, establishedAt: now.toISOString(), sessionBinding: 'a'.repeat(64), principal };
const grant = { ...principal, issuer, active: true, validAfter: new Date(now.getTime() - 1000).toISOString() };
function setup(t: TestContext, change: object = {}) {
  const f = fixture(t), document = { version: 'steer-authorization/v1', organizationId: 'org', records: [{ ...grant, ...change }] };
  f.request.expectedHead = f.add([{ path: authorizationPath, content: JSON.stringify(document) }]);
  const dependencies = { issuer, authorizationPath, verifyGateAuthority: f.verifyAuthority,
    fetch: f.transport, appJwt: async () => 'synthetic-app-jwt', now: () => now };
  const make = () => createGitHubBriefWriterFactory(binding, config, dependencies)(async () => structuredClone(context));
  return { ...f, dependencies, document, make };
}

test('factory composes real Git membership twice per proof and atomic native-Git save with current context', async (t) => {
  const f = setup(t), writer = f.make(); t.after(() => writer.close());
  const proof = await writer.verifyWriteAuthority(f.request, principal);
  assert.equal(f.approvals(), 1); assert.equal(f.mutations(), 0);
  const result = await writer.compareAndCreate(f.request, proof); assert.equal(result.outcome, 'committed');
  assert.equal(f.approvals(), 2); assert.equal(f.mutations(), 1);
  const reader = f.make(); t.after(() => reader.close()); assert.deepEqual(await reader.inspect(ref, principal), result);
});

test('plausible authenticated context and passing gate callback cannot bypass revoked, missing or narrow Git membership', async (t) => {
  for (const change of [{ active: false }, { subject: 'foreign' }, { toolGrants: ['intent.brief.save.status'] }, { hats: [] },
    { validAfter: new Date(now.getTime() + 1).toISOString() }, { expiresAt: now.toISOString() }]) {
    const f = setup(t, change), writer = f.make(); t.after(() => writer.close());
    await assert.rejects(writer.verifyWriteAuthority(f.request, principal)); assert.equal(f.approvals(), 0); assert.equal(f.mutations(), 0);
  }
});

test('committed authorization changes during gate verification discard the proof without Brief mutation', async (t) => {
  const f = setup(t);
  f.dependencies.verifyGateAuthority = async (request) => {
    const proof = await f.verifyAuthority(request);
    f.add([{ path: authorizationPath, content: JSON.stringify({ ...f.document, records: [{ ...grant, active: false }] }) }]); return proof;
  };
  const writer = f.make(); t.after(() => writer.close()); await assert.rejects(writer.verifyWriteAuthority(f.request, principal));
  assert.equal(f.approvals(), 1); assert.equal(f.mutations(), 0);
});

test('membership source integrity errors deny even with a valid gate callback', async (t) => {
  const f = setup(t); f.override((url, _init, result) => url.pathname.includes('/git/blobs/') ? { ...(result as object), content: Buffer.from('tampered').toString('base64') } : result);
  const writer = f.make(); t.after(() => writer.close()); await assert.rejects(writer.verifyWriteAuthority(f.request, principal));
  assert.equal(f.approvals(), 0); assert.equal(f.mutations(), 0);
});

test('gate lease is only shortened by fresh membership; malformed or overlong gate leases are not laundered', async (t) => {
  const f = setup(t, { expiresAt: new Date(now.getTime() + 2000).toISOString() });
  const writer = f.make(); t.after(() => writer.close());
  assert.equal((await writer.verifyWriteAuthority(f.request, principal)).validThrough, new Date(now.getTime() + 2000).toISOString());
  for (const change of [{ validThrough: new Date(now.getTime() + 31000).toISOString() }, { evaluatedAt: new Date(now.getTime() + 1).toISOString() },
    { evaluatedAt: new Date(now.getTime() - 6000).toISOString() }, { authorizationRevision: 'f'.repeat(40) }, { gate2DecisionDigest: 'f'.repeat(64) }]) {
    const g = setup(t); g.proof((proof) => ({ ...(proof as object), ...change })); const denied = g.make(); t.after(() => denied.close());
    await assert.rejects(denied.verifyWriteAuthority(g.request, principal)); assert.equal(g.mutations(), 0);
  }
});

test('same-human session switch cannot bind membership to an earlier proof context', async (t) => {
  const f = setup(t); let calls = 0;
  const writer = createGitHubBriefWriterFactory(binding, config, f.dependencies)(async () => ({ ...context, sessionBinding: ++calls === 1 ? context.sessionBinding : 'b'.repeat(64) }));
  t.after(() => writer.close()); await assert.rejects(writer.verifyWriteAuthority(f.request, principal)); assert.equal(f.approvals(), 0);
});

test('closing during an outstanding gate callback prevents further membership source reads', async (t) => {
  const f = setup(t); let entered!: () => void, release!: () => void;
  const ready = new Promise<void>((resolve) => { entered = resolve; });
  const pending = new Promise<void>((resolve) => { release = resolve; }); t.after(() => release());
  f.dependencies.verifyGateAuthority = async (request) => { entered(); await pending; return f.verifyAuthority(request); };
  const writer = f.make(), work = writer.verifyWriteAuthority(f.request, principal); await ready;
  const calls = f.calls.length; writer.close(); release(); await assert.rejects(work); assert.equal(f.calls.length, calls);
  await assert.rejects(writer.inspect(ref, principal));
});

test('unavailable full gate verifier and ambiguous membership target remain closed', (t) => {
  const f = setup(t);
  assert.throws(() => createGitHubBriefWriterFactory(binding, config, { ...f.dependencies, verifyGateAuthority: undefined! }));
  assert.throws(() => createGitHubBriefWriterFactory(binding, config, { ...f.dependencies, authorizationPath: ref.path }));
  assert.equal(f.calls.length, 0);
});

test('fresh exact-source second membership supersedes an expired first observation without extending the gate lease', async (t) => {
  const f = setup(t); let at = now;
  f.dependencies.now = () => at;
  f.dependencies.verifyGateAuthority = async (request) => {
    at = new Date(now.getTime() + 6000);
    return { ...(await f.verifyAuthority(request) as object), evaluatedAt: at.toISOString(), validThrough: new Date(at.getTime() + 3000).toISOString() };
  };
  const writer = f.make(); t.after(() => writer.close());
  const proof = await writer.verifyWriteAuthority(f.request, principal);
  assert.equal(proof.evaluatedAt, at.toISOString()); assert.equal(proof.validThrough, new Date(now.getTime() + 9000).toISOString());
  assert.equal(f.mutations(), 0);
});
