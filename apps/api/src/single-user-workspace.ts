import { renderBriefPreview, briefPreviewInputSchema } from '@steer/tool-registry';
import { readRequestBody } from './request-body.ts';
import { createIdentityGateway } from './identity-gateway.ts';
import { startLocalIdentityListener } from './identity-listener.ts';

export const localWorkspace = Object.freeze({ organizationId: 'steer-local-idrissenayat', subject: 'local-owner' });

/** No OIDC, session store, credentials, database or external provider is loaded.
 * The machine's local user is the boundary, not an authenticated account. */
export function createSingleUserApi(publicOrigin: string) {
  const origin = new URL(publicOrigin);
  if (origin.origin !== publicOrigin || origin.protocol !== 'https:' || !['localhost', '127.0.0.1'].includes(origin.hostname)) throw new Error('Local workspace requires loopback HTTPS.');
  const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
  const error = (code: string, message: string, status: number) => json({ error: { code, message } }, status);
  return { async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.origin !== publicOrigin || url.search || url.hash) return error('INVALID_REQUEST', 'Invalid local request.', 400);
    if (request.method === 'GET' && ['/health/live', '/health/ready'].includes(url.pathname))
      return json({ status: 'ok', service: 'steer-api', authentication: 'none', workspace: 'single-user', intentWorkflow: 'not-configured' });
    if (url.pathname.startsWith('/auth/')) return error('NOT_FOUND', 'Authentication is removed from this workspace.', 404);
    if (request.method !== 'POST') return error('NOT_FOUND', 'Route not found.', 404);
    if (request.headers.get('origin') !== publicOrigin || ['cross-site', 'same-site'].includes(request.headers.get('sec-fetch-site') ?? ''))
      return error('INVALID_ORIGIN', 'Use the local workspace directly.', 403);
    if (url.pathname !== '/v1/tools/intent.brief.preview') return error('NOT_CONFIGURED', 'This workflow capability is not connected yet.', 503);
    if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') return error('INVALID_REQUEST', 'JSON is required.', 415);
    try {
      const input = briefPreviewInputSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readRequestBody(request, 16384))));
      if (input.organizationId !== localWorkspace.organizationId) return error('INVALID_SCOPE', 'Use this local workspace.', 403);
      return json(await renderBriefPreview(input, localWorkspace.subject, 'Local workspace user (authentication disabled)'));
    } catch { return error('INVALID_REQUEST', 'The draft could not be read. Check its size and format.', 400); }
  } };
}

export async function startSingleUserWorkspace(tls: { key: string; cert: string }) {
  const publicOrigin = 'https://localhost:8443';
  const api = createSingleUserApi(publicOrigin);
  const gateway = createIdentityGateway({ publicOrigin, rendererOrigin: 'http://127.0.0.1:3100', authentication: 'none' }, { identity: api });
  return startLocalIdentityListener({ publicOrigin, tls }, { fetch: gateway.fetch, shutdown: async () => {} });
}
