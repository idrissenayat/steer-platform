import assert from 'node:assert/strict';
import { request as httpsRequest } from 'node:https';
import { join } from 'node:path';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createGitBackedMcpEndpoint } from '../src/identity.ts';
import { createGitAuthorizationHarness } from './git-authorization-harness.ts';
import { createApi } from '../src/app.ts';
import { createOidcAuthenticator, type AuthorizationRecord, type OidcConfiguration } from '@steer/adapters/identity';
import { createGitAuthorizationResolver } from '@steer/adapters/authorization';
import { startLocalIdentityListener } from '../src/identity-listener.ts';
import { reserveLocalPort } from './local-tls-harness.ts';
import { mcpProtocolVersion } from '../src/mcp.ts';

/** Actual SDK client/TLS/Keycloak/Git composition; only generated test identity and owned listener. */
export async function testMcpKeycloak(options: { configuration: OidcConfiguration; bearer: string; grant: AuthorizationRecord;
  providerFetch: typeof fetch; temporary: string; key: string; cert: string;
  check: (name: string, run: () => Promise<void>) => Promise<void> }) {
  await options.check('official MCP v2 client crosses actual HTTPS, Keycloak and current Git grants with HTTP parity and revocation', async () => {
    const source = await createGitAuthorizationHarness(join(options.temporary, 'mcp'), options.grant);
    const origin = `https://localhost:${await reserveLocalPort()}`;
    const endpoint = createGitBackedMcpEndpoint(origin, options.configuration, { reader: source.reader,
      authorizationPath: source.authorizationPath, fetch: options.providerFetch });
    const listener = await startLocalIdentityListener({ publicOrigin: origin, tls: { key: options.key, cert: options.cert } }, endpoint);
    const transportFetch: typeof fetch = async (input, init) => {
      const request = new Request(input, init); const url = new URL(request.url);
      assert.equal(url.origin, origin); assert.equal(url.pathname, '/mcp');
      const body = Buffer.from(await request.arrayBuffer()); assert.ok(body.length <= 16384);
      return new Promise<Response>((resolve, reject) => {
        const outgoing = httpsRequest(url, { family: 4, agent: false, ca: options.cert, rejectUnauthorized: true, servername: 'localhost',
          method: request.method, headers: Object.fromEntries(request.headers), signal: request.signal }, (incoming) => {
          const chunks: Buffer[] = []; let bytes = 0;
          incoming.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > 1024 * 1024) incoming.destroy(); else chunks.push(chunk); });
          incoming.once('error', () => reject(new Error('Synthetic MCP response failed.')));
          incoming.once('end', () => resolve(new Response(Buffer.concat(chunks), { status: incoming.statusCode!,
            headers: Object.fromEntries(Object.entries(incoming.headers).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) })));
        });
        outgoing.setTimeout(12000, () => outgoing.destroy()); outgoing.once('error', () => reject(new Error('Synthetic MCP HTTPS failed.'))); outgoing.end(body);
      });
    };
    const client = new Client({ name: 'steer-isolated-mcp', version: '1.0.0' }, { versionNegotiation: { mode: { pin: mcpProtocolVersion } } });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), { protocolVersion: mcpProtocolVersion,
        requestInit: { headers: { authorization: `Bearer ${options.bearer}` } }, fetch: transportFetch }));
      assert.ok((await client.listTools()).tools.some((tool) => tool.name === 'session.context'));
      const args = { organizationId: options.grant.organizationId };
      const result = await client.callTool({ name: 'session.context', arguments: args }); assert.ok(!result.isError);
      const api = createApi({ authenticate: createOidcAuthenticator(options.configuration, { fetch: options.providerFetch,
        resolveAuthorization: createGitAuthorizationResolver(source.reader, source.authorizationPath) }) });
      const response = await api.request('/v1/tools/session.context', { method: 'POST', headers: {
        authorization: `Bearer ${options.bearer}`, 'content-type': 'application/json' }, body: JSON.stringify(args) });
      assert.equal(response.status, 200); assert.deepEqual((result.structuredContent as { result: unknown })?.result, await response.json());
      assert.equal((await client.callTool({ name: 'session.context', arguments: { organizationId: 'foreign' } })).isError, true);
      await source.publish([{ ...options.grant, active: false }]);
      await assert.rejects(client.callTool({ name: 'session.context', arguments: args }));
      await source.publish([options.grant]); assert.ok(!(await client.callTool({ name: 'session.context', arguments: args })).isError);
    } finally { await client.close(); await listener.shutdown(); }
    assert.equal(endpoint.status().active, 0); assert.equal(endpoint.status().stopping, true);
    await assert.rejects(transportFetch(`${origin}/mcp`, { method: 'POST', body: '{}' }));
  });
}
