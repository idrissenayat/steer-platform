import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createApi } from '../src/app.ts';
import { createMcpEndpoint, mcpProtocolVersion } from '../src/mcp.ts';
import { candidateSavePreviewFixture } from '../../../packages/tool-registry/test/candidate-save-preview.fixture.ts';
import { createRecordedCandidateSavePreviewer } from '../src/runtime.ts';

const tool = 'intent.candidate.save.preview';
test('authenticated HTTP/MCP expose a no-store read-only package preview, not human consent or provider dispatch', async () => {
  const f = await candidateSavePreviewFixture(); let calls = 0;
  const principal = { organizationId: f.scope.organizationId, subject: f.scope.subject, type: 'human', hats: [], toolGrants: [tool], expiresAt: new Date(Date.now() + 300000).toISOString() };
  const service = { scope: f.scope, preview: async () => { calls++; return f.prepared.output; } };
  const dependencies = { authenticate: async () => principal, services: { candidateSavePreviewer: service } };
  const app = createApi(dependencies), post = (input: unknown = f.previewInput) => app.request(`/v1/tools/${tool}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
  const endpoint = createMcpEndpoint('https://steer.test', dependencies), client = new Client({ name: 'synthetic-package-preview', version: '1' },
    { versionNegotiation: { mode: { pin: mcpProtocolVersion } } });
  try {
    const response = await post(); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), f.prepared.output);
    await client.connect(new StreamableHTTPClientTransport(new URL('https://steer.test/mcp'), { protocolVersion: mcpProtocolVersion,
      requestInit: { headers: { authorization: 'Bearer synthetic' } }, fetch: (input, init) => endpoint.fetch(new Request(input, init)) }));
    assert.equal((await client.listTools()).tools.find(t => t.name === tool)!.annotations?.readOnlyHint, true);
    assert.deepEqual((await client.callTool({ name: tool, arguments: f.previewInput })).structuredContent, { result: f.prepared.output });
    const before = calls;
    assert.equal((await post({ ...f.previewInput, documents: f.content.documents })).status, 422);
    principal.type = 'agent'; assert.equal((await post()).status, 403);
    principal.type = 'human'; principal.subject = 'other'; assert.equal((await post()).status, 403);
    principal.subject = f.scope.subject; principal.toolGrants = []; assert.equal((await post()).status, 403);
    assert.equal(calls, before);
  } finally { await client.close(); await endpoint.shutdown(); }
});
test('missing service, late grant loss, changed proposal and private errors never release a package', async () => {
  const f = await candidateSavePreviewFixture();
  for (const mode of ['missing', 'late', 'changed', 'error']) {
    const principal = { organizationId: f.scope.organizationId, subject: f.scope.subject, type: 'human', hats: [], toolGrants: [tool], expiresAt: new Date(Date.now() + 300000).toISOString() };
    const service = { scope: f.scope, preview: async () => {
      if (mode === 'late') principal.toolGrants = [];
      if (mode === 'error') throw new Error('PRIVATE RECORDS');
      return mode === 'changed' ? { ...f.prepared.output, pointerDigest: 'f'.repeat(64) } : f.prepared.output;
    } };
    const app = createApi({ authenticate: async () => principal, services: mode === 'missing' ? {} : { candidateSavePreviewer: service } });
    const response = await app.request(`/v1/tools/${tool}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f.previewInput) });
    assert.equal(response.status, mode === 'late' ? 403 : mode === 'changed' ? 500 : 503);
    assert.doesNotMatch(await response.text(), /PRIVATE|manifestDigest|originatorSubject/);
  }
});
test('stalled server package reads have bounded admission and closing cannot release late data or reach SQL', async () => {
  const f = await candidateSavePreviewFixture(), releases: Array<() => void> = [];
  const deny = async () => { throw new Error('No execution or writes'); };
  const service = createRecordedCandidateSavePreviewer({ drafts: { connect: deny }, execution: { connect: deny } },
    { ...f.scope, recordsPolicyDigest: 'a'.repeat(64), serviceCommitter: 'app:synthetic' }, {
      drafts: { scope: f.scope, create: deny, append: deny, read: async () => { await new Promise<void>(resolve => releases.push(resolve)); return f.draft; } },
      review: { scope: f.scope, review: deny }, history: { scope: f.scope, read: deny }, destination: { scope: f.scope, resolve: deny },
      originals: { authorize: deny, authorizeOperation: deny, authorizeOriginal: deny, authorizeDraft: deny, keyForDraft: deny, authorizeHistoricalRead: deny },
      authorizePreview: async () => {},
    });
  const pending = Array.from({ length: 4 }, () => service.preview(f.previewInput, async () => {}).then(() => assert.fail('Closed'), () => undefined));
  try {
    while (releases.length < 4) await new Promise(resolve => setTimeout(resolve, 2));
    await assert.rejects(service.preview(f.previewInput, async () => {})); service.close(); await Promise.all(pending);
  } finally { service.close(); releases.forEach(release => release()); }
});
