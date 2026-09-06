import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import type { BrowserSessionStore } from '@steer/adapters/browser-session';
import type { AuthorizationRecord } from '@steer/adapters/identity';
import { createGitBackedBrowserApi } from '../src/git-browser.ts';
import { createGitAuthorizationHarness } from './git-authorization-harness.ts';
import { createGitBackedMcpEndpoint } from '../src/identity.ts';
import { mcpProtocolVersion } from '../src/mcp.ts';
import type { SessionBriefWriterFactory } from '../src/request-writer.ts';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const configuration = { issuer: 'https://id.example/realm', jwksUri: 'https://id.example/jwks',
  authorizationEndpoint: 'https://id.example/auth', tokenEndpoint: 'https://id.example/token',
  redirectUri: 'https://steer.example/auth/callback', clientId: 'steer-web',
  clientSecret: 'synthetic-test-secret-not-a-real-credential', audience: 'steer-api' };
const store: BrowserSessionStore = {
  insertTransaction: async () => { throw new Error('Unexpected session write.'); },
  consumeTransaction: async () => undefined, insertSession: async () => { throw new Error('Unexpected session write.'); },
  readSession: async () => undefined, deleteSession: async () => {},
};

test('Git-backed composition binds bearer authority to current commits and ignores an injected resolver override', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'steer-0020-'));
  try {
    const now = new Date('2026-09-05T05:00:00Z');
    const grant: AuthorizationRecord = { issuer: configuration.issuer, subject: 'synthetic-human', organizationId: 'synthetic-org',
      type: 'human', hats: ['product-lead'], toolGrants: ['session.context'], active: true,
      validAfter: new Date(0).toISOString(), expiresAt: new Date(now.getTime() + 300000).toISOString() };
    const source = await createGitAuthorizationHarness(temporary, grant);
    const keys = await generateKeyPair('RS256');
    const jwk = { ...await exportJWK(keys.publicKey), kid: 'synthetic', alg: 'RS256' };
    let overrideCalls = 0;
    const dependencies = { ...source, store, now: () => now,
      resolveAuthorization: async () => { overrideCalls++; return grant; },
      fetch: async (input: string | URL | Request) => {
        assert.equal(String(input), configuration.jwksUri); return Response.json({ keys: [jwk] });
      } };
    const app = createGitBackedBrowserApi(configuration, dependencies);
    const token = await new SignJWT({ iss: configuration.issuer, sub: grant.subject, aud: configuration.audience,
      azp: configuration.clientId, typ: 'Bearer', steer_org: grant.organizationId, steer_kind: 'human', steer_hats: grant.hats,
      iat: now.getTime() / 1000, exp: now.getTime() / 1000 + 180 }).setProtectedHeader({ alg: 'RS256', kid: 'synthetic' }).sign(keys.privateKey);
    const tool = () => app.request('https://steer.example/v1/tools/session.context', { method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ organizationId: grant.organizationId }) });
    assert.equal((await tool()).status, 200);
    for (const records of [[{ ...grant, active: false }], [], [grant, grant], [{ ...grant, organizationId: 'foreign-org' }]]) {
      await source.publish(records); assert.equal((await tool()).status, 401);
    }
    await source.publish([grant]); assert.equal((await tool()).status, 200);
    for (const fault of ['unavailable', 'moving-head', 'digest'] as const) {
      source.setFault(fault); assert.equal((await tool()).status, 401);
      source.setFault('none'); assert.equal((await tool()).status, 200);
    }
    assert.equal(overrideCalls, 0);
    assert.equal((await app.request('https://steer.example/health/ready')).status, 503);
    for (const authorizationPath of ['', '../members.json', '/members.json', 'a//b', 'a\\b', 'a\u0000b', 'a'.repeat(501)]) {
      assert.throws(() => createGitBackedBrowserApi(configuration, { ...dependencies, authorizationPath }), /Invalid authorization source configuration/);
    }
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('Git-backed HTTP and MCP writer factories receive verified bearer context and recheck actual grant commits', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'steer-0134-'));
  let endpoint: ReturnType<typeof createGitBackedMcpEndpoint> | undefined;
  let client: Client | undefined;
  try {
    const now = new Date('2026-09-06T18:00:00.000Z');
    const grant: AuthorizationRecord = { issuer: configuration.issuer, subject: 'synthetic-human', organizationId: 'synthetic-org',
      type: 'human', hats: ['product-lead'], toolGrants: ['intent.brief.save.status'], active: true,
      validAfter: new Date(0).toISOString(), expiresAt: new Date(now.getTime() + 300000).toISOString() };
    const source = await createGitAuthorizationHarness(temporary, grant), keys = await generateKeyPair('RS256');
    const jwk = { ...await exportJWK(keys.publicKey), kid: 'synthetic', alg: 'RS256' };
    const reference = { organizationId: grant.organizationId, repository: `github:${source.reader.binding.repositoryId}`,
      branch: source.reader.binding.branch, path: 'items/0001-demo/BRIEF.md', idempotencyKey: '00000000-0000-4000-8000-000000000134' };
    let opened = 0, closed = 0; const bindings: string[] = [];
    const createBriefWriter: SessionBriefWriterFactory = (authenticate) => { opened++; return {
      configuration: { organizationId: reference.organizationId, repository: reference.repository, branch: reference.branch,
        paths: [reference.path], platformRevision: 'a'.repeat(40), gate2DecisionDigest: 'b'.repeat(64) },
      inspect: async (ref) => { const context = await authenticate(); assert.ok(context);
        assert.equal(context.issuer, configuration.issuer); assert.equal(context.principal.subject, grant.subject);
        assert.equal(context.establishedAt, now.toISOString()); bindings.push(context.sessionBinding);
        return { ...ref, outcome: 'not-found' }; },
      verifyWriteAuthority: async () => { assert.fail(); }, compareAndCreate: async () => { assert.fail(); }, close: () => { closed++; },
    }; };
    const dependencies = { ...source, store, createBriefWriter, now: () => now,
      fetch: async () => Response.json({ keys: [jwk] }) };
    const app = createGitBackedBrowserApi(configuration, dependencies);
    endpoint = createGitBackedMcpEndpoint('https://steer.example', { issuer: configuration.issuer, jwksUri: configuration.jwksUri,
      audience: configuration.audience, clientIds: [configuration.clientId] }, dependencies);
    const token = await new SignJWT({ iss: configuration.issuer, sub: grant.subject, aud: configuration.audience,
      azp: configuration.clientId, typ: 'Bearer', steer_org: grant.organizationId, steer_kind: 'human', steer_hats: grant.hats,
      iat: now.getTime() / 1000, exp: now.getTime() / 1000 + 180 }).setProtectedHeader({ alg: 'RS256', kid: 'synthetic' }).sign(keys.privateKey);
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': mcpProtocolVersion };
    const http = () => app.request('https://steer.example/v1/tools/intent.brief.save.status', { method: 'POST', headers, body: JSON.stringify(reference) });
    const mcp = () => endpoint!.fetch(new Request('https://steer.example/mcp', { method: 'POST', headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'intent.brief.save.status', arguments: reference } }) }));
    const first = await http(); assert.equal(first.status, 200);
    client = new Client({ name: 'steer-0134-synthetic', version: '1.0.0' }, { versionNegotiation: { mode: { pin: mcpProtocolVersion } } });
    await client.connect(new StreamableHTTPClientTransport(new URL('https://steer.example/mcp'), {
      protocolVersion: mcpProtocolVersion, requestInit: { headers: { authorization: `Bearer ${token}` } },
      fetch: async (input, init) => endpoint!.fetch(new Request(input, init)),
    }));
    const result = await client.callTool({ name: 'intent.brief.save.status', arguments: reference }); assert.ok(!result.isError);
    assert.deepEqual((result.structuredContent as { result: unknown }).result, await first.json());
    assert.equal(opened, 2); assert.equal(closed, 2); assert.equal(bindings[0], bindings[1]); assert.match(bindings[0]!, /^[a-f0-9]{64}$/);
    await source.publish([{ ...grant, active: false }]);
    assert.equal((await http()).status, 401); assert.equal((await mcp()).status, 401); assert.equal(opened, 2);
  } finally { await client?.close(); await endpoint?.shutdown(); await rm(temporary, { recursive: true, force: true }); }
});
