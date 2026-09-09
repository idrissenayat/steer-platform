import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createApi } from '../src/app.ts';
import { createMcpEndpoint, mcpProtocolVersion } from '../src/mcp.ts';
import { verifyCandidateSaveStart } from '@steer/tool-registry/candidate-save-start-contracts';
import { createCandidateSaveStarter } from '@steer/data/candidate-save-starter';
import { createRecordedCandidateSaveStarter } from '../src/runtime.ts';

const tool = 'intent.candidate.save.start';
function fixture() {
  const scope = { organizationId: 'org', subject: 'human', productId: 'product', repository: 'github:52', branch: 'codex/synthetic' };
  const input = { organizationId: scope.organizationId, productId: scope.productId, repository: scope.repository, branch: scope.branch,
    draftId: randomUUID(), draftRevision: 1, operationId: randomUUID(), inputDigest: 'a'.repeat(64), save: true as const };
  const output = { ...input, kind: 'steer-candidate-save-start/v1', receipt: { outcome: 'acknowledged',
    workflowId: `steer-candidate-save/v1/org/${input.operationId}`, runId: randomUUID(), state: 'COMPLETED' },
    savedToGit: false, executionAuthorized: false, retryAuthorized: false, gateSigned: false };
  const principal = { organizationId: scope.organizationId, subject: scope.subject, type: 'human', hats: [],
    toolGrants: [tool], expiresAt: new Date(Date.now() + 300000).toISOString() };
  return { scope, input, output, principal };
}
test('candidate start is an exact separately granted human HTTP/MCP command; completed scheduling never asserts a save', async () => {
  const f = fixture(); let calls = 0;
  const service = { scope: f.scope, start: async () => { calls++; return f.output; } };
  const deps = { authenticate: async () => f.principal, services: { candidateSaveStarter: service } };
  const app = createApi(deps), post = (input: unknown = f.input) => app.request(`/v1/tools/${tool}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
  const endpoint = createMcpEndpoint('https://steer.test', deps), client = new Client({ name: 'synthetic-save-start', version: '1' },
    { versionNegotiation: { mode: { pin: mcpProtocolVersion } } });
  try {
    const response = await post(); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(verifyCandidateSaveStart(f.input, await response.json()), f.output);
    await client.connect(new StreamableHTTPClientTransport(new URL('https://steer.test/mcp'), { protocolVersion: mcpProtocolVersion,
      requestInit: { headers: { authorization: 'Bearer synthetic' } }, fetch: (input, init) => endpoint.fetch(new Request(input, init)) }));
    assert.equal((await client.listTools()).tools.find(t => t.name === tool)!.annotations?.readOnlyHint, false);
    assert.deepEqual((await client.callTool({ name: tool, arguments: f.input })).structuredContent, { result: f.output });
    const before = calls;
    for (const patch of [{ save: false }, { taskQueue: 'caller-choice' }, { documents: {} }, { expiresAt: new Date().toISOString() }])
      assert.equal((await post({ ...f.input, ...patch })).status, 422);
    for (const key of ['organizationId', 'productId', 'repository', 'branch']) assert.equal((await post({ ...f.input, [key]: 'other' })).status, 403);
    f.principal.type = 'agent'; assert.equal((await post()).status, 403);
    f.principal.type = 'human'; f.principal.subject = 'other'; assert.equal((await post()).status, 403);
    f.principal.subject = f.scope.subject; f.principal.toolGrants = ['intent.candidate.save.prepare', 'intent.candidate.save.status']; assert.equal((await post()).status, 403);
    assert.equal(calls, before);
  } finally { await client.close(); await endpoint.shutdown(); }
});
test('missing or late authority, private failures and forged start acknowledgements are withheld', async () => {
  for (const mode of ['missing', 'late', 'error', 'changed', 'saved', 'foreign-workflow']) {
    const f = fixture(), service = { scope: f.scope, start: async () => {
      if (mode === 'late') f.principal.toolGrants = [];
      if (mode === 'error') throw new Error('PRIVATE source authority');
      return mode === 'changed' ? { ...f.output, draftRevision: 2 } : mode === 'saved' ? { ...f.output, savedToGit: true }
        : mode === 'foreign-workflow' ? { ...f.output, receipt: { ...f.output.receipt, workflowId: 'foreign' } } : f.output;
    } };
    const app = createApi({ authenticate: async () => f.principal, services: mode === 'missing' ? {} : { candidateSaveStarter: service } });
    const response = await app.request(`/v1/tools/${tool}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f.input) });
    assert.equal(response.status, mode === 'late' ? 403 : ['missing', 'error'].includes(mode) ? 503 : 500);
    assert.doesNotMatch(await response.text(), /PRIVATE|workflowId|operationId/);
  }
});
test('candidate start is lazy, scoped and bounded; timeout and close cannot schedule late work or allocate originals', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(); let calls = 0, release!: () => void;
  const deny = async () => { calls++; throw new Error('No side effects'); }, pool = { connect: deny }, held = new Promise<void>(r => { release = r; });
  const records = { ...f.scope, configurationRevision: 'records-r1', recordsPolicyDigest: 'b'.repeat(64) };
  const config = { records, execution: { ...records, configurationRevision: 'save-r1', action: 'candidate-save', budget: null, expiresAt: new Date(Date.now() + 3600000).toISOString() } };
  const deps = { drafts: { scope: f.scope, create: deny, append: deny, read: deny }, scheduler: { start: deny }, authorizeStart: deny,
    authorizeOperation: deny, records: { authorize: deny, lifecycle: deny, keyForDraft: deny } };
  const options = { publicationDigest: 'c'.repeat(64), serviceCommitter: 'app:synthetic', itemIds: ['0262-synthetic'] };
  const service = createCandidateSaveStarter({ execution: pool, drafts: pool }, config, options, deps);
  for (const key of ['organizationId', 'productId', 'repository', 'branch']) await assert.rejects(service.start({ ...f.input, [key]: 'other' }, async () => {}));
  const pending = Array.from({ length: 4 }, () => assert.rejects(service.start(f.input, () => held)));
  await Promise.resolve(); await Promise.resolve(); t.mock.timers.tick(90001); await Promise.all(pending);
  await assert.rejects(service.start(f.input, async () => {})); service.close(); release();
  await new Promise(r => setImmediate(r)); assert.equal(calls, 0);
  assert.throws(() => createCandidateSaveStarter({ execution: pool, drafts: pool }, config, options, { ...deps, authorizeStart: undefined } as never));
  assert.throws(() => createRecordedCandidateSaveStarter({ execution: pool, drafts: pool }, {
    organizationId: f.scope.organizationId, repositoryId: 52, installationId: 1, owner: 'synthetic', repository: 'fixture', branch: f.scope.branch }, config,
  { organizationId: f.scope.organizationId, repository: f.scope.repository, branch: f.scope.branch, productId: 'other', itemIds: options.itemIds, serviceCommitter: options.serviceCommitter,
    platformRevision: 'c'.repeat(40), gate2DecisionDigest: 'd'.repeat(64) }, deps), /scope mismatch/);
  assert.equal(calls, 0);
});
