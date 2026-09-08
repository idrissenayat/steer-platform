import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createGitHubReader } from '@steer/adapters/github';
import { planCandidateBundle } from '@steer/tool-registry/candidate-bundle-contracts';
import { createApi } from '../src/app.ts';
import { createMcpEndpoint, mcpProtocolVersion } from '../src/mcp.ts';
import { createVerifiedCandidateBundleReader } from '../src/candidate-reader.ts';
import { candidateInput, candidateReadFixture } from '../../../packages/tool-registry/test/candidate-read-fixture.ts';
import { fixture, binding, now } from '../../../packages/adapters/test/github-brief-fixture.ts';

const actor = { subject: 'human', organizationId: 'org', type: 'human', hats: [],
  toolGrants: ['intent.candidate.read'], expiresAt: new Date(now.getTime() + 300000).toISOString() };
const scope = { subject: actor.subject, organizationId: 'org', productId: 'product', repository: 'github:52', branch: binding.branch, itemIds: [candidateInput.itemId] };
const request = (input: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
const path = '/v1/tools/intent.candidate.read';

test('actual HTTP and MCP reopen native Git bundle bytes at an older commit, with read-only parity', async t => {
  const git = fixture(t), plan = await planCandidateBundle({ ...candidateInput, expectedHead: git.head() });
  const revision = git.add(plan.files.map(file => ({ path: file.path, content: file.content })));
  const reference = { ...(await candidateReadFixture()).reference, revision, manifestDigest: plan.manifestDigest };
  git.add([{ path: `items/${candidateInput.itemId}/BRIEF.md`, content: '# Later root Brief, not the selected bundle' }]);
  const native = createGitHubReader(binding, { appJwt: async () => 'synthetic-app-jwt', fetch: git.transport, now: () => now });
  let checks = 0;
  const reader = createVerifiedCandidateBundleReader(native, scope, async (ref, subject) => {
    assert.equal(subject, actor.subject); assert.equal(ref.revision, revision); checks++;
  });
  const dependencies = { authenticate: async () => actor, now: () => now, services: { candidateBundleReader: reader } };
  const api = createApi(dependencies), endpoint = createMcpEndpoint('https://steer.test', dependencies);
  const client = new Client({ name: 'synthetic-candidate-reader', version: '1' }, { versionNegotiation: { mode: { pin: mcpProtocolVersion } } });
  const transport = new StreamableHTTPClientTransport(new URL('https://steer.test/mcp'), { protocolVersion: mcpProtocolVersion,
    requestInit: { headers: { authorization: 'Bearer synthetic-test' } },
    fetch: async (input, init) => endpoint.fetch(new Request(input, init)) });
  try {
    const response = await api.request(path, request(reference)); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const result = await response.json(); assert.deepEqual(result.documents, candidateInput.documents); assert.equal(result.reference.revision, revision);
    assert.equal(result.manifestContent, plan.files.find(file => file.path.endsWith('/MANIFEST.json'))!.content);
    await client.connect(transport);
    const tool = (await client.listTools()).tools.find(tool => tool.name === 'intent.candidate.read')!;
    assert.equal(tool.annotations?.readOnlyHint, true); assert.equal(tool.annotations?.idempotentHint, true);
    const mcp = await client.callTool({ name: 'intent.candidate.read', arguments: reference });
    assert.ok(!mcp.isError); assert.deepEqual(mcp.structuredContent, { result });
    assert.ok(checks >= 18); assert.equal(git.mutations(), 0); assert.equal(git.approvals(), 0);
    assert.ok(git.calls.every(call => call.method === 'GET' || call.path.endsWith('/access_tokens')));
    assert.ok(git.calls.every(call => !call.path.includes('/git/ref/heads/')));
  } finally { reader.close(); await client.close(); await endpoint.shutdown(); }
});

test('candidate HTTP denies uninstalled service, missing grant and foreign subject or scope before reading', async () => {
  const f = await candidateReadFixture(); let reads = 0;
  const service = { scope, read: async () => { reads++; return f.output; } };
  const send = (principal: unknown, installed = true, input: unknown = f.reference, serviceScope = scope) =>
    createApi({ authenticate: async () => principal, now: () => now,
      services: installed ? { candidateBundleReader: { ...service, scope: serviceScope } } : {} }).request(path, request(input));
  assert.equal((await send(null)).status, 401); assert.equal((await send(actor, false)).status, 503);
  assert.equal((await send({ ...actor, toolGrants: [] })).status, 403);
  for (const change of [{ organizationId: 'foreign' }, { productId: 'foreign' }, { repository: 'github:99' }, { branch: 'other' }, { itemId: '0008-other' }])
    assert.equal((await send(actor, true, { ...f.reference, ...change })).status, 403);
  assert.equal((await send(actor, true, f.reference, { ...scope, subject: 'other' })).status, 403);
  for (const change of [{ revision: 'main' }, { consent: true }, { itemId: '../0001' }])
    assert.equal((await send(actor, true, { ...f.reference, ...change })).status, 422);
  assert.equal(reads, 0);
});

test('candidate HTTP suppresses all bytes on revocation during native reads, malformed output and service errors', async t => {
  const git = fixture(t), plan = await planCandidateBundle(candidateInput);
  const revision = git.add(plan.files.map(file => ({ path: file.path, content: file.content })));
  const f = await candidateReadFixture(), reference = { ...f.reference, revision }; let current: unknown = actor, calls = 0;
  const native = createGitHubReader(binding, { appJwt: async () => 'synthetic-app-jwt', fetch: git.transport, now: () => now });
  const reader = createVerifiedCandidateBundleReader({ ...native, readArtifact: async (path, revision) => {
    const value = await native.readArtifact(path, revision); if (++calls === 2) current = null; return value;
  } }, scope, async () => {});
  try {
    const api = createApi({ authenticate: async () => current, now: () => now, services: { candidateBundleReader: reader } });
    const response = await api.request(path, request(reference)); assert.equal(response.status, 401); assert.equal(calls, 2);
    assert.doesNotMatch(await response.text(), /Saved Brief|فارسی|MANIFEST/);
  } finally { reader.close(); }
  for (const read of [async () => ({ ...f.output, documents: { ...f.output.documents, exam: 'PRIVATE substituted bytes' } }),
    async () => { throw new Error('PRIVATE adapter detail'); }]) {
    const api = createApi({ authenticate: async () => actor, now: () => now, services: { candidateBundleReader: { scope, read } } });
    const response = await api.request(path, request(f.reference)); assert.ok([500, 503].includes(response.status));
    assert.doesNotMatch(await response.text(), /PRIVATE|Saved Brief|فارسی/);
  }
});
