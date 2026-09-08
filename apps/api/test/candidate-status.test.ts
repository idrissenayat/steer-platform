import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createCandidateSaveStatusReader } from '@steer/adapters/candidate-save-status-reader';
import { createGitHubCandidateBundleInspector } from '@steer/adapters/github-candidate-bundle-store';
import { planCandidateBundle } from '@steer/tool-registry/candidate-bundle-contracts';
import { createApi } from '../src/app.ts';
import { createMcpEndpoint, mcpProtocolVersion } from '../src/mcp.ts';
import { candidateInput } from '../../../packages/tool-registry/test/candidate-read-fixture.ts';
import { fixture, binding, now } from '../../../packages/adapters/test/github-brief-fixture.ts';

const actor = { subject: 'human', organizationId: 'org', type: 'human', hats: [],
  toolGrants: ['intent.candidate.save.status'], expiresAt: new Date(now.getTime() + 300000).toISOString() };
const scope = { subject: actor.subject, organizationId: 'org', productId: 'product', repository: 'github:52', branch: binding.branch, itemIds: [candidateInput.itemId] };
const publication = { organizationId: scope.organizationId, productId: scope.productId, repository: scope.repository, branch: scope.branch,
  itemIds: scope.itemIds, serviceCommitter: candidateInput.serviceCommitter, platformRevision: 'b'.repeat(40), gate2DecisionDigest: 'c'.repeat(64) };
const path = '/v1/tools/intent.candidate.save.status', request = (input: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
async function setup(t: { after(run: () => void): void }) {
  const git = fixture(t), bundle = { ...candidateInput, expectedHead: git.head() }, preview = await planCandidateBundle(bundle);
  const confirmation = { kind: 'steer-intent-save-binding/v1', organizationId: scope.organizationId, productId: scope.productId,
    subject: actor.subject, draftId: '00000000-0000-4000-8000-000000000001', draftRevision: 1, repository: scope.repository, branch: scope.branch,
    item: `items/${bundle.itemId}`, expectedHead: bundle.expectedHead, bundleManifestDigest: preview.manifestDigest,
    scopeInputDigest: bundle.scopeInputDigest, sourceSnapshotDigest: bundle.sourceSnapshotDigest, assessmentDigest: bundle.assessmentDigest, dispositionDigest: bundle.dispositionDigest };
  const original = { bundle, confirmation }, plan = await planCandidateBundle(bundle, confirmation);
  const input = { organizationId: scope.organizationId, productId: scope.productId, repository: scope.repository, branch: scope.branch,
    draftId: confirmation.draftId, draftRevision: 1, operationId: bundle.operationId, inputDigest: plan.inputDigest };
  const provider = { fetch: git.transport, appJwt: async () => 'synthetic-app-jwt', now: () => now, authorizeRead: async () => {} };
  return { git, original, plan, input, provider,
    make: (loadOriginal: (target: unknown) => Promise<unknown> = async () => original) => createCandidateSaveStatusReader(scope, binding, publication, { ...provider, loadOriginal }) };
}

test('HTTP and MCP inspect one original-bound native Git save receipt and derive the exact reopen reference, without writes', async t => {
  const f = await setup(t), revision = f.git.add(f.plan.files.map(file => ({ path: file.path, content: file.content })));
  f.git.add([{ path: 'later.md', content: '# Later unrelated update' }]);
  const service = f.make(target => { assert.deepEqual(target, { organizationId: f.input.organizationId, operationId: f.input.operationId, inputDigest: f.input.inputDigest }); return Promise.resolve(f.original); });
  const dependencies = { authenticate: async () => actor, now: () => now, services: { candidateSaveStatusReader: service } };
  const api = createApi(dependencies), endpoint = createMcpEndpoint('https://steer.test', dependencies);
  const client = new Client({ name: 'synthetic-status-reader', version: '1' }, { versionNegotiation: { mode: { pin: mcpProtocolVersion } } });
  const transport = new StreamableHTTPClientTransport(new URL('https://steer.test/mcp'), { protocolVersion: mcpProtocolVersion,
    requestInit: { headers: { authorization: 'Bearer synthetic-test' } }, fetch: async (input, init) => endpoint.fetch(new Request(input, init)) });
  try {
    const response = await api.request(path, request(f.input)); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const result = await response.json(); assert.equal(result.outcome, 'committed'); assert.equal(result.saveVerified, true);
    assert.equal(result.reference.revision, revision); assert.equal(result.reference.manifestDigest, f.plan.manifestDigest);
    assert.equal(result.confirmationDigest, f.plan.confirmationDigest); assert.equal(result.retryAuthorized, false); assert.equal(result.gateSigned, false);
    assert.doesNotMatch(JSON.stringify(result), /Saved Brief|NOT RUN|فارسی/);
    await client.connect(transport); const tool = (await client.listTools()).tools.find(tool => tool.name === 'intent.candidate.save.status')!;
    assert.equal(tool.annotations?.readOnlyHint, true); assert.equal(tool.annotations?.idempotentHint, true);
    const mcp = await client.callTool({ name: tool.name, arguments: f.input }); assert.ok(!mcp.isError); assert.deepEqual(mcp.structuredContent, { result });
    assert.equal(f.git.mutations(), 0); assert.equal(f.git.approvals(), 0);
    const inspector = createGitHubCandidateBundleInspector(binding, publication, f.provider);
    assert.deepEqual(Object.keys(inspector), ['inspect', 'close']); inspector.close();
  } finally { service.close(); await client.close(); await endpoint.shutdown(); }
});

test('missing, conflicting and deleted receipts are not a second-submit permission or a reopen link', async t => {
  for (const mode of ['not-found', 'conflict', 'unknown']) {
    const f = await setup(t), service = f.make();
    if (mode !== 'not-found') {
      f.git.add(f.plan.files.map(file => ({ path: file.path, content: file.content })));
      f.git.add([{ path: f.plan.files.at(-1)!.path, content: mode === 'unknown' ? null : 'conflicting receipt' }]);
    }
    try {
      const result = await service.read(f.input, async () => {});
      assert.equal(result.outcome, mode); assert.equal(result.saveVerified, false); assert.equal(result.retryAuthorized, false);
      assert.equal('reference' in result, false); assert.equal(f.git.mutations(), 0); assert.equal(f.git.approvals(), 0);
    } finally { service.close(); }
  }
});

test('status reference, original-owner, revision and permission drift fail before receipt reads and never expose source', async t => {
  const f = await setup(t); let current: unknown = actor, reads = 0;
  const service = f.make(async () => { reads++; current = null; return f.original; });
  const api = createApi({ authenticate: async () => current, now: () => now, services: { candidateSaveStatusReader: service } });
  try {
    const response = await api.request(path, request(f.input)); assert.equal(response.status, 401); assert.equal(reads, 1); assert.equal(f.git.calls.length, 0);
    assert.doesNotMatch(await response.text(), /Saved|فارسی/);
  } finally { service.close(); }
  for (const original of [
    { ...f.original, confirmation: { ...f.original.confirmation, draftRevision: 2 } },
    { ...f.original, bundle: { ...f.original.bundle, originatorSubject: 'foreign' } },
    { ...f.original, bundle: { ...f.original.bundle, documents: { ...f.original.bundle.documents, spec: '# Changed scope' } } },
  ]) { const reader = f.make(async () => original); await assert.rejects(reader.read(f.input, async () => {})); reader.close(); }
  assert.equal(f.git.calls.length, 0);
  const unavailable = createApi({ authenticate: async () => actor, now: () => now });
  assert.equal((await unavailable.request(path, request(f.input))).status, 503);
  assert.equal((await unavailable.request(path, request({ ...f.input, original: f.original }))).status, 422);
  const denied = createApi({ authenticate: async () => ({ ...actor, toolGrants: [] }), now: () => now });
  assert.equal((await denied.request(path, request(f.input))).status, 403);
});

test('status reader closes a stalled original lookup, suppresses late content and does not admit a concurrent lookup', async t => {
  const f = await setup(t); let release!: (value: unknown) => void, lookups = 0;
  const reader = f.make(async () => { lookups++; return new Promise(resolve => { release = resolve; }); });
  const first = assert.rejects(reader.read(f.input, async () => {}));
  while (!release) await new Promise(resolve => setTimeout(resolve, 1));
  await assert.rejects(reader.read(f.input, async () => {})); assert.equal(lookups, 1);
  reader.close(); await first; release(f.original); await Promise.resolve(); assert.equal(f.git.calls.length, 0);
});

test('records or key loss after provider receipt inspection suppresses even a committed-status link', async t => {
  const f = await setup(t); f.git.add(f.plan.files.map(file => ({ path: file.path, content: file.content })));
  let reads = 0;
  const reader = f.make(async () => { if (++reads === 2) throw new Error('PRIVATE key revoked'); return f.original; });
  try {
    const api = createApi({ authenticate: async () => actor, now: () => now, services: { candidateSaveStatusReader: reader } });
    const response = await api.request(path, request(f.input)); assert.equal(response.status, 503);
    assert.equal(reads, 2); assert.ok(f.git.calls.length > 0); assert.equal(f.git.mutations(), 0);
    assert.doesNotMatch(await response.text(), /PRIVATE|reference|committed|Saved Brief/);
  } finally { reader.close(); }
});
