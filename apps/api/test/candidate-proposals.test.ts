import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createGitHubReader, type DirectoryRepositoryReader } from '@steer/adapters/github';
import { planCandidateBundle } from '@steer/tool-registry/candidate-bundle-contracts';
import { verifyCandidateProposals } from '@steer/tool-registry/candidate-proposal-contracts';
import { createVerifiedCandidateProposalReader } from '../src/runtime.ts';
import { createApi } from '../src/app.ts';
import { createMcpEndpoint, mcpProtocolVersion } from '../src/mcp.ts';
import { candidateInput } from '../../../packages/tool-registry/test/candidate-read-fixture.ts';
import { fixture, binding, now } from '../../../packages/adapters/test/github-brief-fixture.ts';

const tool = 'intent.candidate.proposals', path = `/v1/tools/${tool}`;
const actor = { subject: 'human', organizationId: 'org', type: 'human', hats: [], toolGrants: [tool], expiresAt: new Date(now.getTime() + 300000).toISOString() };
const scope = { subject: actor.subject, organizationId: 'org', productId: 'product', repository: 'github:52', branch: binding.branch, itemIds: [candidateInput.itemId] };
const post = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
async function setup(t: { after(run: () => void): void }, count = 1) {
  const git = fixture(t), ids: string[] = [], target = { itemId: candidateInput.itemId, revision: git.head() };
  for (let n = 0; n < count; n++) {
    const proposalId = randomUUID(); ids.push(proposalId);
    const plan = await planCandidateBundle({ ...candidateInput, expectedHead: git.head(), purpose: 'amendment', bundleId: randomUUID(), operationId: randomUUID(),
      amendment: { proposalId, target, parentProposalDigest: null } });
    git.add(plan.files.map(file => ({ path: file.path, content: file.content })));
  }
  const { subject: _subject, itemIds: _ids, ...home } = scope;
  const input = { ...home, itemId: candidateInput.itemId, revision: git.head(), cursor: null };
  const native = createGitHubReader(binding, { appJwt: async () => 'synthetic-app-jwt', fetch: git.transport, now: () => now });
  return { git, ids: ids.sort(), target, input, native,
    make: (reader: DirectoryRepositoryReader = native, authorize: () => Promise<void> = async () => {}) => createVerifiedCandidateProposalReader(reader, scope, authorize) };
}
test('actual HTTP/MCP lists paged same-commit native Git proposals without documents, lifecycle authority or writes', async t => {
  const f = await setup(t, 11), reader = f.make();
  const dependencies = { authenticate: async () => actor, now: () => now, services: { candidateProposalReader: reader } };
  const api = createApi(dependencies), endpoint = createMcpEndpoint('https://steer.test', dependencies);
  const client = new Client({ name: 'synthetic-proposals', version: '1' }, { versionNegotiation: { mode: { pin: mcpProtocolVersion } } });
  try {
    f.git.add([{ path: `items/${candidateInput.itemId}/proposals/${randomUUID()}.json`, content: 'later invalid pointer' }]);
    const first = await api.request(path, post(f.input)); assert.equal(first.status, 200); assert.equal(first.headers.get('cache-control'), 'no-store');
    const page = verifyCandidateProposals(f.input, await first.json());
    assert.deepEqual(page.entries.map(e => e.proposalId), f.ids.slice(0, 10)); assert.equal(page.inventoryCount, 11);
    const input = { ...f.input, cursor: page.nextCursor }, second = await api.request(path, post(input));
    const tail = verifyCandidateProposals(input, await second.json()); assert.deepEqual(tail.entries.map(e => e.proposalId), f.ids.slice(10)); assert.equal(tail.nextCursor, null);
    assert.ok(page.entries.every(e => e.target.revision === f.target.revision && e.reference.revision === f.input.revision));
    assert.equal(page.lifecycleVerified, false); assert.doesNotMatch(JSON.stringify(page), /Saved Brief|Candidate Exam|unsafe|documents|manifestContent/);
    await client.connect(new StreamableHTTPClientTransport(new URL('https://steer.test/mcp'), { protocolVersion: mcpProtocolVersion,
      requestInit: { headers: { authorization: 'Bearer synthetic' } }, fetch: (input, init) => endpoint.fetch(new Request(input, init)) }));
    assert.equal((await client.listTools()).tools.find(t => t.name === tool)!.annotations?.readOnlyHint, true);
    assert.deepEqual((await client.callTool({ name: tool, arguments: input })).structuredContent, { result: tail });
    assert.equal(f.git.mutations(), 0); assert.equal(f.git.approvals(), 0); assert.ok(f.git.calls.every(c => !c.path.includes('/git/ref/heads/')));
  } finally { reader.close(); await client.close(); await endpoint.shutdown(); }
});
test('proposal discovery denies missing grant, foreign scope, extra input, late identity loss and forged output', async t => {
  const f = await setup(t); let current: unknown = actor, calls = 0;
  const service = f.make({ ...f.native, readArtifact: async (...args) => { const value = await f.native.readArtifact(...args); if (++calls === 2) current = null; return value; } });
  const api = createApi({ authenticate: async () => current, now: () => now, services: { candidateProposalReader: service } });
  assert.equal((await api.request(path, post(f.input))).status, 401); assert.equal(calls, 2); service.close();
  let reads = 0; const fake = { scope, list: async () => { reads++; throw new Error('PRIVATE'); } };
  const send = (principal: unknown, input: unknown, installed = true) => createApi({ authenticate: async () => principal, now: () => now,
    services: installed ? { candidateProposalReader: fake } : {} }).request(path, post(input));
  assert.equal((await send(actor, f.input, false)).status, 503);
  assert.equal((await send({ ...actor, toolGrants: [] }, f.input)).status, 403);
  assert.equal((await send({ ...actor, subject: 'other' }, f.input)).status, 403);
  for (const key of ['organizationId', 'productId', 'repository', 'branch', 'itemId'])
    assert.equal((await send(actor, { ...f.input, [key]: 'other' })).status, key === 'itemId' ? 422 : 403);
  for (const patch of [{ revision: 'main' }, { savedToGit: true }, { cursor: '../' }]) assert.equal((await send(actor, { ...f.input, ...patch })).status, 422);
  assert.equal(reads, 0); const failed = await send(actor, f.input); assert.equal(failed.status, 503); assert.doesNotMatch(await failed.text(), /PRIVATE/);
  const reader = f.make(); const value = await reader.list(f.input, async () => {}); reader.close();
  for (const patch of [{ revision: 'a'.repeat(40) }, { entries: [...value.entries, ...value.entries] }, { lifecycleVerified: true }, { savedToGit: true }]) {
    const broken = createApi({ authenticate: async () => actor, now: () => now, services: { candidateProposalReader: { scope, list: async () => ({ ...value, ...patch }) } } });
    assert.equal((await broken.request(path, post(f.input))).status, 500);
  }
});
test('unverifiable inventory or pointer is unavailable, never an empty/new-proposal claim', async t => {
  const f = await setup(t), inventory = await f.native.readDirectoryInventory(`items/${f.input.itemId}`, f.input.revision);
  for (const patch of [{ organizationId: 'other' }, { entries: [...inventory.entries, inventory.entries[0]] },
    { entries: inventory.entries.map(e => e.path.endsWith('.json') ? { ...e, mode: '120000' } : e) },
    { entries: inventory.entries.filter(e => e.path !== `items/${f.input.itemId}`) },
    { entries: inventory.entries.map(e => e.path.endsWith('/SPEC.md') ? { ...e, objectSha: '0'.repeat(40) } : e) }]) {
    const reader = f.make({ ...f.native, readDirectoryInventory: async () => ({ ...inventory, ...patch }) } as DirectoryRepositoryReader);
    await assert.rejects(reader.list(f.input, async () => {}), /unavailable/); reader.close();
  }
  const bad = f.git.add([{ path: `items/${f.input.itemId}/proposals/not-a-uuid.json`, content: '{}' }]);
  const reader = f.make(); await assert.rejects(reader.list({ ...f.input, revision: bad }, async () => {}));
  await assert.rejects(reader.list({ ...f.input, cursor: randomUUID() }, async () => {})); reader.close();
  const empty = await setup(t, 0), emptyReader = empty.make();
  assert.equal((await emptyReader.list(empty.input, async () => {})).inventoryCount, 0); emptyReader.close();
});
test('closing a pending proposal inventory denies late references and keeps the four-slot admission bound', async t => {
  const f = await setup(t); let reads = 0, release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const reader = f.make({ ...f.native, readDirectoryInventory: async (...args) => { reads++; await pending; return f.native.readDirectoryInventory(...args); } });
  const jobs = Array.from({ length: 4 }, () => assert.rejects(reader.list(f.input, async () => {})));
  for (let i = 0; i < 100 && reads !== 4; i++) await new Promise(r => setImmediate(r));
  assert.equal(reads, 4); await assert.rejects(reader.list(f.input, async () => {}));
  reader.close(); await Promise.all(jobs); release(); await new Promise(r => setImmediate(r));
  await assert.rejects(reader.list(f.input, async () => {})); assert.equal(reads, 4);
});
