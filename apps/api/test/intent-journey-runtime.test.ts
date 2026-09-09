import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { mcpProtocolVersion } from '../src/mcp.ts';
import { createIdentityRuntime, type IdentityRuntimeDependencies } from '../src/runtime.ts';
import { intentJourneyRuntimeFixture } from './intent-journey-runtime.fixture.ts';

const inputFor = (configuration: { organizationId: string; productId: string; repository: string }) => ({
  organizationId: configuration.organizationId, productId: configuration.productId, repository: configuration.repository, requestId: randomUUID(),
});
test('identity runtime requires complete explicit journey profile, factory and separate authority; no legacy agent ambiguity', async t => {
  const f = await intentJourneyRuntimeFixture(t); let created = 0, authorized = 0;
  const ports = { ...f.ports, createIntentJourney: async () => { created++; return f.owned; }, authorizeIntentJourney: async () => { authorized++; } };
  for (const [profile, dependencies] of [[f.base, ports], [f.profile, f.ports], [f.profile, { ...ports, authorizeIntentJourney: undefined }],
    [f.profile, { ...ports, createIntentJourney: undefined }], [{ ...f.profile, intentJourney: { ...f.configuration, extra: true } }, ports],
    [{ ...f.profile, intentJourney: { ...f.configuration, repository: 'github:9' } }, ports],
    [{ ...f.profile, intentJourney: { ...f.configuration, branch: 'other' } }, ports],
    [f.profile, { ...ports, intentAgent: { organizationId: f.configuration.organizationId, develop: async () => null } }],
    [f.profile, { ...ports, modelGateway: {} }]] as const)
    await assert.rejects(createIdentityRuntime(profile, f.secrets, dependencies as IdentityRuntimeDependencies), /configuration could not be initialized/);
  assert.equal(created, 0); assert.equal(authorized, 0); assert.equal(f.source.calls.length, 0); assert.equal(f.state.closed, 0);
});
test('denied activation never constructs a journey; denial after construction closes transferred ownership once', async t => {
  const f = await intentJourneyRuntimeFixture(t); let created = 0, checks = 0, denied = true;
  const ports = { ...f.ports, createIntentJourney: async () => { created++; return f.owned; },
    authorizeIntentJourney: async () => { if (denied || ++checks === 2) throw new Error('PRIVATE denied activation'); } };
  await assert.rejects(createIdentityRuntime(f.profile, f.secrets, ports), /configuration could not be initialized/);
  assert.equal(created, 0); assert.equal(f.state.closed, 0); denied = false;
  await assert.rejects(createIdentityRuntime(f.profile, f.secrets, ports), /configuration could not be initialized/);
  assert.equal(created, 1); assert.equal(f.state.closed, 1); assert.equal(f.source.calls.length, 0);
});
test('invalid transferred capability configuration closes ownership before exposing a runtime', async t => {
  const f = await intentJourneyRuntimeFixture(t); (f.services.candidateSaveStarter.scope as any).subject = 'foreign';
  await assert.rejects(createIdentityRuntime(f.profile, f.secrets, { ...f.ports,
    authorizeIntentJourney: async () => {}, createIntentJourney: async () => f.owned }), /configuration could not be initialized/);
  assert.equal(f.state.closed, 1); assert.equal(f.source.calls.length, 0);
});
test('signed identity and current native Git grants reach the managed service; missing grants, foreign products and revocation deny', async t => {
  const f = await intentJourneyRuntimeFixture(t); let calls = 0, allowed = true;
  f.services.intentDrafts.create = async () => { calls++; return { outcome: 'unavailable', savedToGit: false }; };
  const runtime = await createIdentityRuntime(f.profile, f.secrets, { ...f.ports, createIntentJourney: async () => f.owned,
    authorizeIntentJourney: async context => { assert.deepEqual(context.configuration, f.configuration); if (!allowed) throw new Error('PRIVATE policy unavailable'); } });
  t.after(() => runtime.shutdown()); assert.equal(f.source.calls.length, 0); assert.equal(runtime.status().database.connections, 0);
  const input = inputFor(f.configuration), post = (patch = {}) => runtime.fetch(f.request('intent.draft.create', { ...input, ...patch }));
  assert.equal((await runtime.fetch(f.request('intent.draft.create', input, 'invalid'))).status, 401); assert.equal(calls, 0);
  const response = await post(); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { outcome: 'unavailable', savedToGit: false });
  assert.equal(calls, 1); assert.ok(f.counts().jwks > 0 && f.counts().assertions > 0);
  assert.equal((await post({ productId: 'foreign' })).status, 403); assert.equal(calls, 1);
  allowed = false; const denied = await post(); assert.equal(denied.status, 503); assert.doesNotMatch(await denied.text(), /PRIVATE/); assert.equal(calls, 1); allowed = true;
  f.publish({ ...f.grant, toolGrants: [] }); assert.equal((await post()).status, 403);
  f.publish({ ...f.grant, active: false }); assert.equal((await post()).status, 401); assert.equal(calls, 1);
  assert.equal(f.source.mutations(), 0); assert.equal(runtime.status().database.connections, 0); assert.deepEqual(f.state.calls, []);
  await runtime.shutdown(); assert.equal(f.state.closed, 1); assert.equal(runtime.status().database.closed, true);
});
test('managed browser runtime drains an authenticated call before journey resources and shared identity pools', async t => {
  const f = await intentJourneyRuntimeFixture(t); let entered!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; }), held = new Promise<void>(resolve => { release = resolve; });
  f.services.intentDrafts.create = async (_input, current) => { entered(); await held; await current(); return { outcome: 'unavailable', savedToGit: false }; };
  const runtime = await createIdentityRuntime(f.profile, f.secrets, { ...f.ports, createIntentJourney: async () => f.owned, authorizeIntentJourney: async () => {} });
  t.after(async () => { release(); await runtime.shutdown(); });
  const request = f.request('intent.draft.create', inputFor(f.configuration)), pending = runtime.fetch(request);
  await Promise.race([started, pending.then(() => assert.fail('Expected admitted synthetic call'))]);
  const stop = runtime.shutdown(); await Promise.resolve(); assert.equal(runtime.status().state, 'draining');
  assert.equal(f.state.closed, 0); assert.equal(runtime.status().database.closed, false);
  assert.equal((await runtime.fetch(f.request('intent.draft.create', inputFor(f.configuration)))).status, 503);
  release(); assert.equal((await pending).status, 200); await stop;
  assert.equal(f.state.closed, 1); assert.equal(runtime.status().database.closed, true); assert.equal(runtime.status().state, 'stopped');
});
test('journey cleanup failure remains closed and sanitized while other resources still close', async t => {
  const f = await intentJourneyRuntimeFixture(t);
  f.owned.shutdown = async () => { f.state.closed++; throw new Error('PRIVATE resource details'); };
  const runtime = await createIdentityRuntime(f.profile, f.secrets, { ...f.ports, createIntentJourney: async () => f.owned, authorizeIntentJourney: async () => {} });
  await assert.rejects(runtime.shutdown(), /^Error: Identity service shutdown failed\.$/);
  assert.equal(f.state.closed, 1); assert.equal(runtime.status().database.closed, true); assert.equal(runtime.status().state, 'failed');
  await assert.rejects(runtime.shutdown()); assert.equal(f.state.closed, 1); assert.equal((await runtime.fetch(f.request('intent.draft.create', {}))).status, 503);
});
test('HTTP and explicit MCP mounting share the managed journey and current authority without exposing publication records', async t => {
  const f = await intentJourneyRuntimeFixture(t); let calls = 0, allowed = true;
  f.services.intentDrafts.create = async () => { calls++; return { outcome: 'unavailable', savedToGit: false }; };
  const runtime = await createIdentityRuntime({ ...f.profile, mcp: { clientIds: ['steer-web'] } }, f.secrets, {
    ...f.ports, createIntentJourney: async () => f.owned,
    authorizeIntentJourney: async () => { if (!allowed) throw new Error('PRIVATE managed policy revoked'); },
  });
  const client = new Client({ name: 'steer-synthetic-managed-journey', version: '1.0.0' }, { versionNegotiation: { mode: { pin: mcpProtocolVersion } } });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL('https://steer.example/mcp'), {
      protocolVersion: mcpProtocolVersion, requestInit: { headers: { authorization: `Bearer ${f.token}` } },
      fetch: async (input, init) => runtime.fetch(new Request(input, init)),
    }));
    const input = inputFor(f.configuration), http = await runtime.fetch(f.request('intent.draft.create', input));
    assert.equal(http.status, 200);
    const mcp = await client.callTool({ name: 'intent.draft.create', arguments: input }); assert.ok(!mcp.isError);
    assert.deepEqual((mcp.structuredContent as { result: unknown }).result, await http.json()); assert.equal(calls, 2);
    const listed = await client.listTools(); assert.ok(listed.tools.every(tool => !/publication/i.test(tool.name)));
    allowed = false; const denied = await client.callTool({ name: 'intent.draft.create', arguments: input });
    assert.equal(denied.isError, true); assert.doesNotMatch(JSON.stringify(denied), /PRIVATE/); assert.equal(calls, 2);
    allowed = true; f.publish({ ...f.grant, toolGrants: [] });
    assert.equal((await client.callTool({ name: 'intent.draft.create', arguments: input })).isError, true);
    assert.equal(calls, 2); assert.equal(f.source.mutations(), 0); assert.deepEqual(f.state.calls, []);
  } finally { await client.close(); await runtime.shutdown(); }
  assert.equal(f.state.closed, 1); assert.equal(runtime.status().database.closed, true);
});
