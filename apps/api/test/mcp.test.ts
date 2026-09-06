import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { describeTools } from '@steer/tool-registry';
import { createMcpEndpoint, mcpProtocolVersion } from '../src/mcp.ts';
import { createApi } from '../src/app.ts';

const origin = 'https://steer.test', now = new Date('2026-09-05T10:00:00Z');
const principal = { subject: 'synthetic-agent', organizationId: 'org-a', type: 'agent', hats: [],
  toolGrants: ['session.context', 'projection.artifact.read', 'projection.changes.read', 'projection.snapshot.read', 'intent.brief.read', 'intent.brief.catalog', 'workflow.reconciliation.start', 'workflow.reconciliation.status'], expiresAt: new Date(now.getTime() + 300000).toISOString() };
const input = { organizationId: 'org-a', repository: 'github:1', path: 'BRIEF.md', revision: 'a'.repeat(40) };
const content = '# Brief: Synthetic artifact\n\n## Problem\n\nA scoped synthetic problem.\n';
const output = { ...input, kind: 'projection', content, blobSha: createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex'), contentDigest: createHash('sha256').update(content).digest('hex') };
const scope = { organizationId: 'org-a', repository: 'github:1', paths: ['BRIEF.md'] };
async function connect(endpoint: ReturnType<typeof createMcpEndpoint>) {
  const client = new Client({ name: 'steer-synthetic-test', version: '1.0.0' }, { versionNegotiation: { mode: { pin: mcpProtocolVersion } } });
  const transport = new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), {
    protocolVersion: mcpProtocolVersion, requestInit: { headers: { authorization: 'Bearer synthetic-test' } },
    fetch: async (input, init) => endpoint.fetch(new Request(input, init)),
  });
  await client.connect(transport); return client;
}
const toolError = (result: Awaited<ReturnType<Client['callTool']>>) => {
  assert.equal(result.isError, true); const first = result.content[0]; assert.equal(first?.type, 'text');
  return JSON.parse((first as { text: string }).text).error.code;
};

test('human Brief preview has HTTP/MCP parity without enabling default access or agent confirmation', async () => {
  let actor = { ...principal, type: 'human', toolGrants: ['intent.brief.preview'] };
  const dependencies = { authenticate: async () => actor, now: () => now };
  const endpoint = createMcpEndpoint(origin, dependencies); const client = await connect(endpoint);
  const args = { organizationId: 'org-a', draft: { title: 'Draft only', problem: 'A supplied problem', outcome: '',
    users: [], systems: [], constraints: [], openQuestions: [], successMeasure: '' } };
  const request = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args) };
  try {
    const result = await client.callTool({ name: 'intent.brief.preview', arguments: args }); assert.ok(!result.isError);
    const response = await createApi(dependencies).request('/v1/tools/intent.brief.preview', request);
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json(); assert.deepEqual((result.structuredContent as { result: unknown }).result, body);
    assert.equal(body.saved, false); assert.equal(body.confirmed, false); assert.equal(body.executionAuthorized, false);
    assert.equal((await createApi().request('/v1/tools/intent.brief.preview', request)).status, 401);
    actor = { ...actor, type: 'agent' };
    assert.equal(toolError(await client.callTool({ name: 'intent.brief.preview', arguments: args })), 'FORBIDDEN');
  } finally { await client.close(); await endpoint.shutdown(); }
});

test('canonical Brief catalog/read references have HTTP and MCP parity without granting access to legacy aliases', async () => {
  const path = 'items/0125-canonical-outcome/BRIEF.md', canonical = { ...input, path };
  const reference = { path, revision: input.revision, contentDigest: output.contentDigest };
  const dependencies = { authenticate: async () => principal, now: () => now,
    services: { artifactProjection: { scope: { ...scope, paths: [path] }, read: async () => ({ ...output, path }), catalog: async () => [reference] } } };
  const api = createApi(dependencies), endpoint = createMcpEndpoint(origin, dependencies), client = await connect(endpoint);
  try {
    for (const [name, args] of [['intent.brief.catalog', { organizationId: scope.organizationId, repository: scope.repository }],
      ['intent.brief.read', { ...canonical, contentDigest: output.contentDigest }]] as const) {
      const result = await client.callTool({ name, arguments: args }); assert.ok(!result.isError);
      const response = await api.request(`/v1/tools/${name}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args) });
      assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual((result.structuredContent as { result: unknown }).result, await response.json());
    }
    assert.equal(toolError(await client.callTool({ name: 'intent.brief.read', arguments: { ...input, contentDigest: output.contentDigest } })), 'FORBIDDEN');
  } finally { await client.close(); await endpoint.shutdown(); }
});

test('Brief save and readback are discovered but unavailable through both transports without a trusted writer', async () => {
  const human = { ...principal, type: 'human', toolGrants: ['intent.brief.preview', 'intent.brief.save', 'intent.brief.save.status'] };
  const dependencies = { authenticate: async () => human, now: () => now };
  const endpoint = createMcpEndpoint(origin, dependencies); const client = await connect(endpoint); const api = createApi(dependencies);
  const reference = { organizationId: 'org-a', repository: 'github:1', branch: 'codex/synthetic', path: 'items/0001-demo/BRIEF.md',
    idempotencyKey: '00000000-0000-4000-8000-000000000123' };
  const save = { ...reference, expectedHead: 'a'.repeat(40), draft: { title: 'Synthetic', problem: 'A problem', outcome: 'An outcome', users: ['A team'], systems: ['Unverified system'], constraints: [], openQuestions: [], successMeasure: '' },
    confirmation: { action: 'accept-rendered-brief', templateVersion: 'steer-brief/v1', contentDigest: 'b'.repeat(64) } };
  try {
    const discovered = await client.listTools();
    assert.equal(discovered.tools.find((tool) => tool.name === 'intent.brief.save')?.annotations?.readOnlyHint, false);
    assert.equal(discovered.tools.find((tool) => tool.name === 'intent.brief.save.status')?.annotations?.readOnlyHint, true);
    for (const [name, args] of [['intent.brief.save', save], ['intent.brief.save.status', reference]] as const) {
      assert.equal(toolError(await client.callTool({ name, arguments: args })), 'UNAVAILABLE');
      const request = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args) };
      const response = await api.request(`/v1/tools/${name}`, request); assert.equal(response.status, 503);
      assert.equal((await response.json()).error.code, 'UNAVAILABLE');
      assert.equal((await createApi().request(`/v1/tools/${name}`, request)).status, 401);
    }
  } finally { await client.close(); await endpoint.shutdown(); }
});

test('official MCP v2 client lists canonical schemas and calls the same tools as HTTP', async () => {
  const schedulingScope = { organizationId: 'org-a', repository: 'github:1', itemId: 'intent/0001' };
  const receipt = { workflowId: 'steer-reconcile/v1/org-a/github%3A1/intent%2F0001', runId: '00000000-0000-4000-8000-000000000039' };
  const dependencies = { authenticate: async () => principal, now: () => now,
    services: { artifactProjection: { scope, read: async () => output,
      catalog: async () => [{ path: input.path, revision: input.revision, contentDigest: output.contentDigest }] },
      projectionChanges: { scope, read: async () => ({ events: [], cursor: null, hasMore: false, snapshotRequired: true }) }, reconciliationScheduler: {
      scope: schedulingScope, workflowId: receipt.workflowId, limits: { maxRounds: 2, minIntervalMs: 1000 },
      start: async () => ({ ...receipt, outcome: 'started' }), inspect: async () => ({ ...receipt, outcome: 'found', state: 'RUNNING' }),
    }, projectionSnapshot: { scope, read: async () => ({ records: [], cursor: null }) } } };
  const endpoint = createMcpEndpoint(origin, dependencies); const client = await connect(endpoint);
  try {
    const discovered = await client.listTools(); assert.equal(discovered.tools.length, describeTools().length);
    for (const expected of describeTools()) {
      const actual = discovered.tools.find((tool) => tool.name === expected.name)!;
      assert.deepEqual(actual.inputSchema, expected.inputSchema);
      assert.equal(actual.annotations?.readOnlyHint, expected.kind === 'query');
      assert.equal(actual.annotations?.idempotentHint, expected.kind === 'query');
      assert.deepEqual((actual.outputSchema?.properties as Record<string, unknown>)?.result, expected.outputSchema);
    }
    const api = createApi(dependencies);
    for (const [name, args] of [['session.context', { organizationId: 'org-a' }], ['projection.artifact.read', input],
      ['intent.brief.read', { ...input, contentDigest: output.contentDigest }],
      ['intent.brief.catalog', { organizationId: input.organizationId, repository: input.repository }],
      ['projection.changes.read', { organizationId: scope.organizationId, repository: scope.repository, cursor: null, limit: 100 }],
      ['projection.snapshot.read', { organizationId: scope.organizationId, repository: scope.repository }],
      ['workflow.reconciliation.start', { ...schedulingScope, rounds: 1, intervalMs: 1000 }], ['workflow.reconciliation.status', schedulingScope]] as const) {
      const result = await client.callTool({ name, arguments: args }); assert.ok(!result.isError);
      const http = await api.request(`/v1/tools/${name}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args) });
      assert.deepEqual((result.structuredContent as { result: unknown })?.result, await http.json());
    }
  } finally { await client.close(); await endpoint.shutdown(); }
});

test('MCP denies cross-tenant, forged fields, missing grants and revocation during async projection reads', async () => {
  let grants = principal.toolGrants, active = true, revoke = false;
  const endpoint = createMcpEndpoint(origin, { authenticate: async () => active ? { ...principal, toolGrants: grants } : null, now: () => now,
    services: { artifactProjection: { scope, read: async () => { if (revoke) active = false; return output; } } } });
  const client = await connect(endpoint);
  try {
    assert.equal(toolError(await client.callTool({ name: 'session.context', arguments: { organizationId: 'foreign' } })), 'FORBIDDEN');
    assert.equal(toolError(await client.callTool({ name: 'session.context', arguments: { organizationId: 'org-a', hats: ['org-admin'] } })), 'INVALID_INPUT');
    grants = []; assert.equal(toolError(await client.callTool({ name: 'session.context', arguments: { organizationId: 'org-a' } })), 'FORBIDDEN');
    grants = principal.toolGrants; revoke = true;
    const result = await client.callTool({ name: 'projection.artifact.read', arguments: input });
    assert.equal(toolError(result), 'UNAUTHENTICATED'); assert.ok(!JSON.stringify(result).includes(output.content));
    await assert.rejects(client.listTools());
  } finally { await client.close(); await endpoint.shutdown(); }
});

test('MCP transport rejects ambient credentials, origin/host aliases, legacy mode, streams and malformed bodies', async () => {
  const endpoint = createMcpEndpoint(origin, { authenticate: async () => principal, now: () => now });
  const request = (body = '{}', headers: Record<string, string> = {}, method = 'POST', url = `${origin}/mcp`) => endpoint.fetch(new Request(url, {
    method, headers: { authorization: 'Bearer synthetic', 'content-type': 'application/json', 'mcp-protocol-version': mcpProtocolVersion, ...headers },
    ...(method === 'POST' ? { body } : {}),
  }));
  try {
    for (const headers of [{ cookie: '__Host-steer-session=synthetic' }, { origin: 'https://foreign.test' }, { host: 'foreign.test' },
      { 'sec-fetch-site': 'cross-site' }, { 'mcp-session-id': 'synthetic' }, { 'last-event-id': '1' }]) assert.equal((await request('{}', headers)).status, 403);
    assert.equal((await request('{}', { authorization: '' })).status, 401);
    assert.equal((await request('{}', { 'mcp-protocol-version': '2025-11-25' })).status, 400);
    assert.equal((await request('{}', { 'content-type': 'text/plain' })).status, 415);
    assert.equal((await request('{}', {}, 'GET')).status, 405);
    assert.equal((await request('{}', {}, 'POST', `${origin}/mcp?token=synthetic`)).status, 403);
    for (const body of ['[{}]', 'not json', JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'subscriptions/listen' })]) assert.equal((await request(body)).status, 400);
    assert.equal((await request('x'.repeat(16385))).status, 413);
    const failed = await createMcpEndpoint(origin).fetch(new Request(`${origin}/mcp`, { method: 'POST', headers: { authorization: 'Bearer synthetic' } }));
    assert.equal(failed.status, 401); assert.equal(failed.headers.get('cache-control'), 'no-store');
  } finally { await endpoint.shutdown(); }
});

test('MCP admission and shutdown retain actual in-flight tool work without reopening', async () => {
  let release!: () => void, started!: () => void; let reads = 0;
  const blocked = new Promise<void>((resolve) => { release = resolve; }); const entered = new Promise<void>((resolve) => { started = resolve; });
  const endpoint = createMcpEndpoint(origin, { authenticate: async () => principal, now: () => now,
    services: { artifactProjection: { scope, read: async () => { if (++reads === 8) started(); await blocked; return output; } } } });
  const client = await connect(endpoint); let closed = false;
  const requests = Array.from({ length: 8 }, () => client.callTool({ name: 'projection.artifact.read', arguments: input }));
  try {
    await entered; await assert.rejects(client.callTool({ name: 'projection.artifact.read', arguments: input }));
    const shutdown = endpoint.shutdown().then(() => { closed = true; });
    await new Promise((resolve) => setImmediate(resolve)); assert.equal(closed, false); assert.equal(endpoint.status().active, 8);
    release(); assert.ok((await Promise.all(requests)).every((result) => !result.isError)); await shutdown;
    await assert.rejects(client.listTools()); assert.equal(endpoint.status().active, 0);
  } finally { release(); await Promise.allSettled(requests); await client.close(); await endpoint.shutdown(); }
});
