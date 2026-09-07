import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { describeTools } from '@steer/tool-registry';
import { createMcpEndpoint, mcpProtocolVersion } from '../src/mcp.ts';
import { createApi } from '../src/app.ts';
import { createGitHubReader } from '@steer/adapters/github';
import { fixture as gitFixture, binding as gitBinding, now as gitNow } from '../../../packages/adapters/test/github-brief-fixture.ts';

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

test('Brief destination observes real native Git heads through read-only GitHub adapter with HTTP/MCP parity', async (t) => {
  const source = gitFixture(t), credentials: unknown[] = [];
  const reader = createGitHubReader(gitBinding, { appJwt: async () => 'synthetic-app-jwt', now: () => gitNow,
    fetch: async (url, init) => {
      if (String(url).endsWith('/access_tokens')) credentials.push(JSON.parse(String(init?.body)));
      return source.transport(url, init);
    } });
  let actor = { ...principal, organizationId: gitBinding.organizationId, hats: [], toolGrants: ['intent.brief.destination'],
    expiresAt: new Date(gitNow.getTime() + 300000).toISOString() };
  const destination = { organizationId: gitBinding.organizationId, repository: `github:${gitBinding.repositoryId}`,
    branch: gitBinding.branch, paths: ['items/0148-demo/BRIEF.md'] };
  const dependencies = { authenticate: async () => actor, now: () => gitNow,
    services: { briefDestination: { scope: destination, readHead: () => reader.readHead() } } };
  const endpoint = createMcpEndpoint(origin, dependencies), client = await connect(endpoint), api = createApi(dependencies);
  const args = { organizationId: actor.organizationId };
  const request = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args) };
  try {
    assert.equal((await client.listTools()).tools.find((tool) => tool.name === 'intent.brief.destination')?.annotations?.readOnlyHint, true);
    for (let round = 0; round < 2; round++) {
      if (round) source.add([{ path: 'synthetic.txt', content: 'Advance the native branch, not a projection.' }]);
      const result = await client.callTool({ name: 'intent.brief.destination', arguments: args }); assert.ok(!result.isError);
      const response = await api.request('/v1/tools/intent.brief.destination', request);
      assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
      const body = await response.json(); assert.deepEqual((result.structuredContent as { result: unknown }).result, body);
      assert.deepEqual(body, { ...destination, kind: 'brief-destination-observation', observedHead: source.head(),
        observedAt: gitNow.toISOString(), gateVerified: false, writeAuthorized: false });
    }
    assert.deepEqual(credentials, [{ repository_ids: [52], permissions: { contents: 'read' } }]);
    assert.equal(source.mutations(), 0); assert.equal(source.approvals(), 0);
    const reads = source.calls.length; actor = { ...actor, toolGrants: [] };
    assert.equal(toolError(await client.callTool({ name: 'intent.brief.destination', arguments: args })), 'FORBIDDEN');
    assert.equal((await api.request('/v1/tools/intent.brief.destination', request)).status, 403);
    assert.equal(source.calls.length, reads);
    const disabled = createApi({ ...dependencies, services: {}, authenticate: async () => ({ ...actor, toolGrants: ['intent.brief.destination'] }) });
    assert.equal((await disabled.request('/v1/tools/intent.brief.destination', request)).status, 503);
  } finally { await client.close(); await endpoint.shutdown(); }
});

test('fixed recorded Brief dispatch/status have HTTP/MCP parity with separate grants and no default scheduler', async () => {
  const scope = { organizationId: 'org-a', repository: 'github:1', itemId: 'intent/0175' };
  const idempotencyKey = '17500000-0000-4000-8000-000000000001', args = { ...scope, idempotencyKey };
  const workflowId = `steer-recorded-brief/v1/org-a/github%3A1/intent%2F0175/${idempotencyKey}`;
  const runId = '17500000-0000-4000-8000-000000000002';
  const names = ['workflow.recorded-brief.start', 'workflow.recorded-brief.status'];
  let actor: typeof principal | null = { ...principal, toolGrants: names }, calls = 0, revokeOnRead = false;
  const dependencies = { authenticate: async () => actor, now: () => now, services: { recordedBriefScheduler: {
    target: { scope, idempotencyKey }, workflowId,
    start: async () => { calls++; return { workflowId, outcome: 'unknown' }; },
    inspect: async () => { calls++; if (revokeOnRead) actor = null; return { workflowId, outcome: 'found', runId, state: 'RUNNING' }; },
  } } };
  const api = createApi(dependencies), endpoint = createMcpEndpoint(origin, dependencies), client = await connect(endpoint);
  const request = (value: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
  try {
    const discovered = await client.listTools();
    for (const name of names) {
      const tool = discovered.tools.find(item => item.name === name)!;
      assert.equal(tool.annotations?.readOnlyHint, name.endsWith('status'));
      assert.equal(tool.annotations?.idempotentHint, name.endsWith('status'));
      const mcp = await client.callTool({ name, arguments: args }); assert.ok(!mcp.isError);
      const response = await api.request(`/v1/tools/${name}`, request(args));
      assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual((mcp.structuredContent as { result: unknown }).result, await response.json());
      assert.equal((await api.request(`/v1/tools/${name}`, request({ ...args, subject: 'forged' }))).status, 422);
      assert.equal(toolError(await client.callTool({ name, arguments: { ...args, repository: 'github:2' } })), 'FORBIDDEN');
      assert.equal((await createApi().request(`/v1/tools/${name}`, request(args))).status, 401);
      assert.equal((await createApi({ ...dependencies, services: {} }).request(`/v1/tools/${name}`, request(args))).status, 503);
    }
    assert.equal(calls, 4);
    actor = { ...principal, toolGrants: ['intent.brief.save', 'projection.ingest', 'workflow.reconciliation.start'] };
    for (const name of names) {
      assert.equal(toolError(await client.callTool({ name, arguments: args })), 'FORBIDDEN');
      assert.equal((await api.request(`/v1/tools/${name}`, request(args))).status, 403);
    }
    assert.equal(calls, 4);
    actor = { ...principal, toolGrants: names }; revokeOnRead = true;
    assert.equal(toolError(await client.callTool({ name: names[1]!, arguments: args })), 'UNAUTHENTICATED');
    actor = { ...principal, toolGrants: names };
    assert.equal((await api.request(`/v1/tools/${names[1]}`, request(args))).status, 401);
    assert.equal(calls, 6);
  } finally { await client.close(); await endpoint.shutdown(); }
});


test('fixed recorded Brief recovery/status have HTTP/MCP parity with separate grants and no default scheduler', async () => {
  const scope = { organizationId: 'org-a', repository: 'github:1', itemId: 'intent/0182' };
  const idempotencyKey = '18200000-0000-4000-8000-000000000001', failedRunId = '18200000-0000-4000-8000-000000000003', args = { ...scope, idempotencyKey, failedRunId };
  const workflowId = `steer-recorded-brief-recovery/v1/org-a/github%3A1/intent%2F0182/${idempotencyKey}/${failedRunId}`;
  const runId = '18200000-0000-4000-8000-000000000002';
  const names = ['workflow.recorded-brief.recover', 'workflow.recorded-brief.recovery.status'];
  let actor: typeof principal | null = { ...principal, toolGrants: names }, calls = 0, revokeOnRead = false;
  const dependencies = { authenticate: async () => actor, now: () => now, services: { recordedBriefRecoveryScheduler: {
    plan: { target: { scope, idempotencyKey }, failedRunId }, workflowId,
    start: async () => { calls++; return { workflowId, outcome: 'unknown' }; },
    inspect: async () => { calls++; if (revokeOnRead) actor = null; return { workflowId, outcome: 'found', runId, state: 'RUNNING' }; },
  } } };
  const api = createApi(dependencies), endpoint = createMcpEndpoint(origin, dependencies), client = await connect(endpoint);
  const request = (value: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
  try {
    const discovered = await client.listTools();
    for (const name of names) {
      const tool = discovered.tools.find(item => item.name === name)!;
      assert.equal(tool.annotations?.readOnlyHint, name.endsWith('status'));
      assert.equal(tool.annotations?.idempotentHint, name.endsWith('status'));
      const mcp = await client.callTool({ name, arguments: args }); assert.ok(!mcp.isError);
      const response = await api.request(`/v1/tools/${name}`, request(args));
      assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual((mcp.structuredContent as { result: unknown }).result, await response.json());
      assert.equal((await api.request(`/v1/tools/${name}`, request({ ...args, subject: 'forged' }))).status, 422);
      assert.equal(toolError(await client.callTool({ name, arguments: { ...args, repository: 'github:2' } })), 'FORBIDDEN');
      assert.equal((await createApi().request(`/v1/tools/${name}`, request(args))).status, 401);
      assert.equal((await createApi({ ...dependencies, services: {} }).request(`/v1/tools/${name}`, request(args))).status, 503);
    }
    assert.equal(calls, 4);
    actor = { ...principal, toolGrants: ['intent.brief.save', 'projection.ingest', 'workflow.reconciliation.start', 'workflow.recorded-brief.start', 'workflow.recorded-brief.status'] };
    for (const name of names) {
      assert.equal(toolError(await client.callTool({ name, arguments: args })), 'FORBIDDEN');
      assert.equal((await api.request(`/v1/tools/${name}`, request(args))).status, 403);
    }
    assert.equal(calls, 4);
    actor = { ...principal, toolGrants: names }; revokeOnRead = true;
    assert.equal(toolError(await client.callTool({ name: names[1]!, arguments: args })), 'UNAUTHENTICATED');
    actor = { ...principal, toolGrants: names };
    assert.equal((await api.request(`/v1/tools/${names[1]}`, request(args))).status, 401);
    assert.equal(calls, 6);
  } finally { await client.close(); await endpoint.shutdown(); }
});

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

test('HTTP and official MCP client allocate and clean distinct request writers only for authorized save-status calls', async () => {
  const human = { ...principal, type: 'human', toolGrants: ['intent.brief.save.status', 'session.context'] };
  const reference = { organizationId: 'org-a', repository: 'github:1', branch: 'codex/synthetic', path: 'items/0001-demo/BRIEF.md',
    idempotencyKey: '00000000-0000-4000-8000-000000000134' };
  const requests: string[] = []; let closed = 0;
  const dependencies = { authenticate: async () => human, now: () => now, createBriefWriter: (request: Request) => {
    requests.push(new URL(request.url).pathname); return {
      configuration: { ...scope, branch: reference.branch, paths: [reference.path], platformRevision: 'a'.repeat(40), gate2DecisionDigest: 'b'.repeat(64) },
      inspect: async (ref: typeof reference & { subject: string }) => ({ ...ref, outcome: 'not-found' }),
      verifyWriteAuthority: async () => { assert.fail(); }, compareAndCreate: async () => { assert.fail(); }, close: async () => { closed++; },
    };
  } };
  const endpoint = createMcpEndpoint(origin, dependencies), client = await connect(endpoint), api = createApi(dependencies);
  try {
    await client.listTools(); await client.callTool({ name: 'session.context', arguments: { organizationId: 'org-a' } }); assert.equal(requests.length, 0);
    const result = await client.callTool({ name: 'intent.brief.save.status', arguments: reference }); assert.ok(!result.isError);
    assert.equal(closed, 1);
    const response = await api.request(`${origin}/v1/tools/intent.brief.save.status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(reference) });
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), (result.structuredContent as { result: unknown }).result);
    assert.equal(closed, 2); assert.deepEqual(requests, ['/mcp', '/v1/tools/intent.brief.save.status']);
    assert.equal(toolError(await client.callTool({ name: 'intent.brief.save.status', arguments: { ...reference, organizationId: 'foreign' } })), 'FORBIDDEN');
    assert.equal(toolError(await client.callTool({ name: 'intent.brief.save.status', arguments: { ...reference, injected: true } })), 'INVALID_INPUT');
    assert.equal(requests.length, 2);
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
