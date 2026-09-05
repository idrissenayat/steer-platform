import { createMcpHandler, Server, type Tool } from '@modelcontextprotocol/server';
import { describeTools, invokeTool, principalSchema, ToolError } from '@steer/tool-registry';
import type { ApiDependencies } from './app.ts';
import { createRequestBoundary } from './request-boundary.ts';
import { readRequestBody, RequestBodyError } from './request-body.ts';

export const mcpProtocolVersion = '2026-07-28';
const headers = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'", 'x-content-type-options': 'nosniff' };
const reject = (status: number, code: string) => Response.json({ error: { code, message: 'The MCP request could not be accepted.' } }, {
  status, headers: { ...headers, ...(status === 401 ? { 'www-authenticate': 'Bearer' } : {}), ...(status === 405 ? { allow: 'POST' } : {}) },
});

/** Explicit modern Streamable HTTP, no listener/default activation or ambient cookie authority. */
export function createMcpEndpoint(publicOrigin: string, dependencies: ApiDependencies = {}) {
  const origin = new URL(publicOrigin);
  if (origin.protocol !== 'https:' || origin.origin !== publicOrigin) throw new Error('Invalid MCP origin.');
  const authenticate = dependencies.authenticate ?? (async () => null), clock = dependencies.now ?? (() => new Date());
  let stopping = false, cleanupFailed = false, active = 0, drained: (() => void) | undefined, closing: Promise<void> | undefined;
  const dispatch = async (request: Request): Promise<Response> => {
    if (stopping) return reject(503, 'SERVICE_UNAVAILABLE');
    const url = new URL(request.url);
    if (url.origin !== publicOrigin || url.username || url.password || url.hash || url.search || url.pathname !== '/mcp' ||
      (request.headers.has('host') && request.headers.get('host') !== origin.host)) return reject(403, 'FORBIDDEN');
    if (request.method !== 'POST') return reject(405, 'METHOD_NOT_ALLOWED');
    const suppliedOrigin = request.headers.get('origin'), site = request.headers.get('sec-fetch-site');
    if ((suppliedOrigin !== null && suppliedOrigin !== publicOrigin) || (site !== null && site !== 'same-origin') ||
      request.headers.has('cookie') || request.headers.has('mcp-session-id') || request.headers.has('last-event-id')) return reject(403, 'FORBIDDEN');
    if (!/^Bearer [^\s,]+$/i.test(request.headers.get('authorization') ?? '')) return reject(401, 'UNAUTHENTICATED');
    active++;
    try {
      const initial = principalSchema.safeParse(await authenticate(request));
      const now = clock();
      if (!initial.success || !Number.isFinite(now.getTime()) || Date.parse(initial.data.expiresAt) <= now.getTime()) return reject(401, 'UNAUTHENTICATED');
      if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') return reject(415, 'UNSUPPORTED_MEDIA_TYPE');
      if (request.headers.get('mcp-protocol-version') !== mcpProtocolVersion) return reject(400, 'UNSUPPORTED_PROTOCOL_VERSION');
      let body: unknown;
      try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readRequestBody(request, 16384))); }
      catch (error) { return reject(error instanceof RequestBodyError ? error.reason === 'size' ? 413 : 408 : 400, 'INVALID_REQUEST'); }
      if (!body || typeof body !== 'object' || Array.isArray(body) || !('jsonrpc' in body) || body.jsonrpc !== '2.0' || !('id' in body) ||
        !((typeof body.id === 'string' && body.id.length > 0 && body.id.length <= 100) || (typeof body.id === 'number' && Number.isSafeInteger(body.id))) || !('method' in body) ||
        !['server/discover', 'tools/list', 'tools/call', 'ping'].includes(String(body.method))) return reject(400, 'UNSUPPORTED_METHOD');
      // Low-level SDK binding is intentional: registry owns schemas/dispatch, no second tool implementation.
      const handler = createMcpHandler(() => {
        const server = new Server({ name: 'steer', version: '0.1.0' }, { capabilities: { tools: {} } });
        server.setRequestHandler('tools/list', async () => ({ tools: describeTools().map((tool) => ({
          name: tool.name, description: tool.description, inputSchema: tool.inputSchema as Tool['inputSchema'],
          outputSchema: { type: 'object', properties: { result: tool.outputSchema }, required: ['result'], additionalProperties: false } as Tool['outputSchema'],
          annotations: { readOnlyHint: tool.kind === 'query', destructiveHint: false, idempotentHint: tool.kind === 'query', openWorldHint: false },
        })) }));
        server.setRequestHandler('tools/call', async (call) => {
          try {
            const fresh = principalSchema.safeParse(await authenticate(request)); const current = clock();
            if (!fresh.success || fresh.data.subject !== initial.data.subject || fresh.data.organizationId !== initial.data.organizationId ||
              fresh.data.type !== initial.data.type || current.getTime() < now.getTime() || Date.parse(initial.data.expiresAt) <= current.getTime()) throw new ToolError('UNAUTHENTICATED');
            const result = await invokeTool(call.params.name, call.params.arguments, { principal: fresh.data, now: current, clock,
              revalidate: () => authenticate(request), ...(dependencies.services ? { services: dependencies.services } : {}) });
            return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: { result } };
          } catch (error) {
            const safe = error instanceof ToolError ? error : new ToolError('INTERNAL_ERROR');
            return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify({ error: { code: safe.code, message: safe.message } }) }] };
          }
        });
        return server;
      }, { legacy: 'reject', responseMode: 'auto', maxSubscriptions: 0, keepAliveMs: 0 });
      try {
        const response = await handler.fetch(request, { parsedBody: body });
        if (response.headers.get('content-type')?.split(';')[0] !== 'application/json') {
          void response.body?.cancel().catch(() => {}); return reject(500, 'INTERNAL_ERROR');
        }
        // JSON-only allowlisted methods finish the actual call before releasing its resource lease.
        const result = await response.json();
        if (result?.error) result.error = { code: result.error.code, message: 'The MCP protocol request was rejected.' };
        return Response.json(result, { status: response.status, headers });
      } finally {
        try { await handler.close(); }
        catch { cleanupFailed = true; stopping = true; throw new Error('MCP resource cleanup could not be confirmed.'); }
      }
    } catch { return reject(500, 'INTERNAL_ERROR'); }
    finally { active--; if (!active) drained?.(); }
  };
  return { fetch: createRequestBoundary(dispatch, { maxInFlight: 8 }), status: () => ({ stopping, active, cleanupFailed }),
    shutdown(): Promise<void> {
      if (!closing) { stopping = true;
        const pending = active ? new Promise<void>((resolve) => { drained = resolve; }) : Promise.resolve();
        closing = pending.then(() => { if (cleanupFailed) throw new Error('MCP resource shutdown failed.'); });
      }
      return closing;
    } };
}
