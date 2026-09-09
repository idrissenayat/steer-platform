import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createApi } from '../src/app.ts';
import { createMcpEndpoint, mcpProtocolVersion } from '../src/mcp.ts';
import { candidateSavePreviewFixture } from '../../../packages/tool-registry/test/candidate-save-preview.fixture.ts';
import { candidateSavePrepareInputSchema, verifyCandidateSavePrepare } from '@steer/tool-registry/candidate-save-prepare-contracts';
import { createCandidateSavePreparer } from '@steer/data/candidate-save-preparer';
import { createRecordedCandidateSavePreparer } from '../src/runtime.ts';

const tool = 'intent.candidate.save.prepare';
async function fixture() {
  const f = await candidateSavePreviewFixture();
  const input = candidateSavePrepareInputSchema.parse({ organizationId: f.scope.organizationId, preview: f.previewInput,
    previewDigest: f.prepared.output.previewDigest, confirmation: f.prepared.output.proposedConfirmation, confirm: true });
  const reference = { organizationId: f.scope.organizationId, productId: f.scope.productId, repository: f.scope.repository, branch: f.scope.branch,
    draftId: input.preview.draftId, draftRevision: 1, operationId: randomUUID(), inputDigest: 'a'.repeat(64) };
  const output = { kind: 'steer-candidate-save-prepare/v1', input, outcome: 'prepared', reference,
    originalPreserved: true, readyToRequestStart: true, savedToGit: false, executionAuthorized: false, gateSigned: false };
  const principal = { organizationId: f.scope.organizationId, subject: f.scope.subject, type: 'human', hats: [],
    toolGrants: [tool], expiresAt: new Date(Date.now() + 300000).toISOString() };
  return { ...f, input, output, principal };
}
test('confirmation is a human-only separately granted HTTP/MCP command, with exact no-store acknowledgement and no source bytes', async () => {
  const f = await fixture(); let calls = 0;
  const service = { scope: f.scope, prepare: async () => { calls++; return f.output; } };
  const deps = { authenticate: async () => f.principal, services: { candidateSavePreparer: service } };
  const app = createApi(deps), post = (input: unknown = f.input) => app.request(`/v1/tools/${tool}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
  const endpoint = createMcpEndpoint('https://steer.test', deps), client = new Client({ name: 'synthetic-confirmation', version: '1' },
    { versionNegotiation: { mode: { pin: mcpProtocolVersion } } });
  try {
    const response = await post(); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(verifyCandidateSavePrepare(f.input, await response.json()), f.output);
    await client.connect(new StreamableHTTPClientTransport(new URL('https://steer.test/mcp'), { protocolVersion: mcpProtocolVersion,
      requestInit: { headers: { authorization: 'Bearer synthetic' } }, fetch: (input, init) => endpoint.fetch(new Request(input, init)) }));
    assert.equal((await client.listTools()).tools.find(t => t.name === tool)!.annotations?.readOnlyHint, false);
    assert.deepEqual((await client.callTool({ name: tool, arguments: f.input })).structuredContent, { result: f.output });
    const before = calls;
    for (const patch of [{ confirm: false }, { operationId: randomUUID() }, { documents: f.content.documents }, { organizationId: 'other' }])
      assert.equal((await post({ ...f.input, ...patch })).status, 422);
    f.principal.type = 'agent'; assert.equal((await post()).status, 403);
    f.principal.type = 'human'; f.principal.subject = 'other'; assert.equal((await post()).status, 403);
    f.principal.subject = f.scope.subject; f.principal.toolGrants = ['intent.candidate.save.preview']; assert.equal((await post()).status, 403);
    assert.equal(calls, before);
  } finally { await client.close(); await endpoint.shutdown(); }
});
test('missing service, revoked grants, private errors and mismatched receipts never acknowledge confirmation', async () => {
  for (const mode of ['missing', 'late', 'error', 'changed', 'saved', 'foreign-reference']) {
    const f = await fixture(), service = { scope: f.scope, prepare: async () => {
      if (mode === 'late') f.principal.toolGrants = [];
      if (mode === 'error') throw new Error('PRIVATE RECORDS');
      return mode === 'changed' ? { ...f.output, input: { ...f.input, previewDigest: 'e'.repeat(64) } }
        : mode === 'saved' ? { ...f.output, savedToGit: true }
          : mode === 'foreign-reference' ? { ...f.output, reference: { ...f.output.reference, draftRevision: 2 } } : f.output;
    } };
    const app = createApi({ authenticate: async () => f.principal, services: mode === 'missing' ? {} : { candidateSavePreparer: service } });
    const response = await app.request(`/v1/tools/${tool}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f.input) });
    assert.equal(response.status, mode === 'late' ? 403 : ['missing', 'error'].includes(mode) ? 503 : 500);
    assert.doesNotMatch(await response.text(), /PRIVATE|previewDigest|operationId/);
  }
});
test('preparation is lazy, rejects stale confirmation before SQL, and requires independent human authority', async () => {
  for (const mode of ['changed', 'consent', 'draft', 'authority']) {
    const f = await fixture(); let sql = 0;
    const deny = async () => { sql++; throw new Error('No synthetic SQL allowed'); };
    const records = { ...f.scope, recordsPolicyDigest: 'b'.repeat(64) };
    const service = createCandidateSavePreparer({ execution: { connect: deny }, drafts: { connect: deny } },
      { records, execution: { ...records, configurationRevision: 'save-r1', action: 'candidate-save', budget: null, expiresAt: new Date(Date.now() + 60000).toISOString() } },
      { publicationDigest: 'c'.repeat(64), serviceCommitter: 'app:synthetic', itemIds: [f.previewInput.itemId] }, {
        drafts: { scope: f.scope, create: deny, append: deny, read: async () => mode === 'draft' ? { ...f.draft, latestRevision: 2 } : f.draft },
        previewer: { scope: f.scope, preview: async () => f.prepared.output },
        authorizeConfirmation: async () => { if (mode === 'authority') throw new Error('No adopted human consent'); },
        authorizeOperation: deny, records: { authorize: deny, lifecycle: deny, keyForDraft: deny },
      });
    try {
      assert.equal(sql, 0);
      const input = mode === 'changed' ? { ...f.input, previewDigest: 'd'.repeat(64) }
        : mode === 'consent' ? { ...f.input, confirmation: { ...f.input.confirmation, expectedHead: 'd'.repeat(40) } } : f.input;
      assert.equal((await service.prepare(input, async () => {})).outcome, mode === 'authority' ? 'unavailable' : 'conflict');
      assert.equal(sql, 0);
    } finally { service.close(); }
  }
});
test('stalled confirmations keep bounded admission and closing prevents every late read from reaching SQL', async () => {
  const f = await fixture(), releases: Array<() => void> = []; let sql = 0;
  const deny = async () => { sql++; throw new Error('No SQL'); };
  const records = { ...f.scope, recordsPolicyDigest: 'b'.repeat(64) };
  const service = createCandidateSavePreparer({ execution: { connect: deny }, drafts: { connect: deny } },
    { records, execution: { ...records, configurationRevision: 'save-r1', action: 'candidate-save', budget: null, expiresAt: new Date(Date.now() + 60000).toISOString() } },
    { publicationDigest: 'c'.repeat(64), serviceCommitter: 'app:synthetic', itemIds: [f.previewInput.itemId] }, {
      drafts: { scope: f.scope, create: deny, append: deny, read: async () => { await new Promise<void>(r => releases.push(r)); return f.draft; } },
      previewer: { scope: f.scope, preview: deny }, authorizeConfirmation: deny, authorizeOperation: deny,
      records: { authorize: deny, lifecycle: deny, keyForDraft: deny },
    });
  const pending = Array.from({ length: 4 }, () => service.prepare(f.input, async () => {}));
  try {
    for (let i = 0; i < 100 && releases.length < 4; i++) await new Promise(r => setTimeout(r, 2));
    assert.equal(releases.length, 4); await assert.rejects(service.prepare(f.input, async () => {}));
    service.close(); releases.forEach(release => release());
    assert.ok((await Promise.all(pending)).every(r => r.outcome === 'unavailable')); assert.equal(sql, 0);
  } finally { service.close(); releases.forEach(release => release()); }
});
test('API composition refuses a publication from another product before any admission or provider service exists', async () => {
  const f = await fixture(); let calls = 0;
  const deny = async () => { calls++; throw new Error('No side effects'); };
  const records = { ...f.scope, recordsPolicyDigest: 'b'.repeat(64) };
  const config = { records, execution: { ...records, action: 'candidate-save', budget: null,
    configurationRevision: 'save-r1', expiresAt: new Date(Date.now() + 60000).toISOString() } };
  const binding = { organizationId: f.scope.organizationId, repositoryId: 52, installationId: 1, owner: 'synthetic', repository: 'fixture', branch: f.scope.branch };
  const publication = { organizationId: f.scope.organizationId, productId: 'other-product', repository: f.scope.repository, branch: f.scope.branch,
    itemIds: [f.previewInput.itemId], serviceCommitter: 'app:synthetic', platformRevision: 'c'.repeat(40), gate2DecisionDigest: 'd'.repeat(64) };
  assert.throws(() => createRecordedCandidateSavePreparer({ drafts: { connect: deny }, execution: { connect: deny } }, binding, config, publication, {
    drafts: { scope: f.scope, create: deny, append: deny, read: deny }, previewer: { scope: f.scope, preview: deny },
    authorizeConfirmation: deny, authorizeOperation: deny, records: { authorize: deny, lifecycle: deny, keyForDraft: deny },
  }), /scope mismatch/);
  assert.equal(calls, 0);
});
