import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createGitHubBriefWriterFactory } from '@steer/adapters/github-brief-writer-factory';
import { createApi } from '../src/app.ts';
import { createMcpEndpoint, mcpProtocolVersion } from '../src/mcp.ts';
// Test-only native Git/HTTP fixture. No application source imports test helpers.
import { fixture, binding, config, ref, now } from '../../../packages/adapters/test/github-brief-fixture.ts';

const issuer = 'https://identity.example/realms/steer', authorizationPath = 'access/authorization.json';
const principal = { organizationId: 'org', subject: ref.subject, type: 'human' as const, hats: ['product-lead' as const],
  toolGrants: ['intent.brief.preview', 'intent.brief.save', 'intent.brief.save.status'], expiresAt: new Date(now.getTime() + 60000).toISOString() };
const context = { issuer, establishedAt: now.toISOString(), sessionBinding: 'a'.repeat(64), principal };
const draft = { title: 'Reduce duplicate intake', problem: 'Coordinators enter requests twice.', outcome: 'Each request is entered once.',
  users: ['Coordinators'], systems: ['Unverified intake system'], constraints: ['No new subscription'],
  openQuestions: ['Confirm the system name'], successMeasure: 'Duplicate count' };

for (const mode of ['http', 'mcp', 'lost-ack'] as const) test(`${mode}: real factory/membership/store persists confirmed bytes in native Git and recovers through HTTP/MCP`, async (t) => {
  const f = fixture(t), document = { version: 'steer-authorization/v1', organizationId: 'org', records: [
    { ...principal, issuer, active: true, validAfter: new Date(now.getTime() - 1000).toISOString() },
  ] };
  f.request.expectedHead = f.add([{ path: authorizationPath, content: JSON.stringify(document) }]);
  const factory = createGitHubBriefWriterFactory(binding, config, { issuer, authorizationPath,
    verifyGateAuthority: f.verifyAuthority, fetch: f.transport, appJwt: async () => 'synthetic-app-jwt', now: () => now });
  let opened = 0, closed = 0;
  const dependencies = { authenticate: async () => principal, now: () => now, createBriefWriter: () => {
    opened++; const writer = factory(async () => structuredClone(context));
    return { ...writer, close: () => { closed++; writer.close(); } };
  } };
  const api = createApi(dependencies), origin = 'https://steer.test', endpoint = createMcpEndpoint(origin, dependencies);
  const client = new Client({ name: 'steer-0135-synthetic', version: '1.0.0' }, { versionNegotiation: { mode: { pin: mcpProtocolVersion } } });
  t.after(async () => { await client.close(); await endpoint.shutdown(); });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), {
    protocolVersion: mcpProtocolVersion, requestInit: { headers: { authorization: 'Bearer synthetic-context-fixture' } },
    fetch: async (input, init) => endpoint.fetch(new Request(input, init)),
  }));
  const http = async (name: string, input: unknown) => {
    const response = await api.request(`/v1/tools/${name}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store'); return response.json();
  };
  const mcp = async (name: string, input: Record<string, unknown>) => {
    const response = await client.callTool({ name, arguments: input }); assert.ok(!response.isError);
    return (response.structuredContent as { result: { result: { outcome: string; revision?: string; contentDigest?: string }; gateSigned: boolean } }).result;
  };
  const preview = await http('intent.brief.preview', { organizationId: 'org', draft }); assert.equal(opened, 0);
  const { subject: _subject, ...scope } = ref;
  const input = { ...scope, expectedHead: f.head(), draft, confirmation: {
    action: 'accept-rendered-brief', templateVersion: 'steer-brief/v1', contentDigest: preview.contentDigest,
  } };
  if (mode === 'lost-ack') f.loseAck();
  const result = await (mode === 'mcp' ? mcp : http)('intent.brief.save', input);
  assert.equal(result.result.outcome, mode === 'lost-ack' ? 'unknown' : 'committed'); assert.equal(result.gateSigned, false);
  assert.equal(opened, 1); assert.equal(closed, 1); assert.equal(f.mutations(), 1); assert.equal(f.approvals(), 2);
  const recovered = await mcp('intent.brief.save.status', scope); assert.equal(recovered.result.outcome, 'committed');
  assert.equal(recovered.result.revision, f.head()); assert.equal(recovered.result.contentDigest, preview.contentDigest);
  assert.match(f.git(['show', `${recovered.result.revision}:${ref.path}`]), /Reduce duplicate intake/);
  assert.deepEqual(await http('intent.brief.save.status', scope), recovered);
  assert.deepEqual(await http('intent.brief.save', input), recovered);
  assert.equal(opened, 4); assert.equal(closed, 4); assert.equal(f.mutations(), 1); assert.equal(f.approvals(), 2);
});
