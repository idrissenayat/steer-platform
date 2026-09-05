import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { createOpenApiDocument, invokeTool, ToolError, type ToolServices } from '@steer/tool-registry';
import { readRequestBody, RequestBodyError } from './request-body.ts';

export interface ApiDependencies {
  /** Must verify the identity independently (issuer, audience, signature, expiry and grants). */
  authenticate?: (request: Request) => Promise<unknown>;
  now?: () => Date;
  services?: ToolServices;
}
const maxBodyBytes = 16 * 1024;
const error = (code: string, message: string) => ({ error: { code, message } });

/** Read the stream with an actual byte bound, even if Content-Length is absent or false. */
async function readBody(request: Request): Promise<string | null> {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(await readRequestBody(request, maxBodyBytes));
  } catch (cause) { if (cause instanceof RequestBodyError && cause.reason === 'size') return null; throw cause; }
}

export function createApi(dependencies: ApiDependencies = {}) {
  const app = new Hono();
  const authenticate = dependencies.authenticate ?? (async () => null);
  const now = dependencies.now ?? (() => new Date());
  app.use('*', secureHeaders());
  app.use('*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });
  app.get('/health/live', (c) => c.json({ status: 'ok', service: 'steer-api' }));
  app.get('/health/ready', (c) => c.json({
    status: 'not-ready', stage: 'api-foundation', missing: ['oidc', 'projections'],
  }, 503));
  app.get('/openapi.json', (c) => c.json(createOpenApiDocument()));
  app.post('/v1/tools/:name', async (c) => {
    // Authentication occurs before any body is read. Role/tenant headers are never identity.
    const principal = await authenticate(c.req.raw);
    if (!principal) throw new ToolError('UNAUTHENTICATED');
    const contentType = c.req.header('content-type')?.split(';')[0]?.trim().toLowerCase();
    if (contentType !== 'application/json') {
      return c.json(error('UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.'), 415);
    }
    let body: string | null;
    let input: unknown;
    try {
      body = await readBody(c.req.raw);
      if (body === null) return c.json(error('PAYLOAD_TOO_LARGE', 'Request body exceeds 16 KiB.'), 413);
      input = JSON.parse(body);
    } catch (cause) {
      if (cause instanceof RequestBodyError) return c.json(error('REQUEST_TIMEOUT', 'Request body was not completed.'), 408);
      return c.json(error('INVALID_JSON', 'A valid UTF-8 JSON body is required.'), 400);
    }
    return c.json(await invokeTool(c.req.param('name'), input, { principal, now: now(), clock: now,
      revalidate: () => authenticate(c.req.raw), ...(dependencies.services ? { services: dependencies.services } : {}) }));
  });
  app.notFound((c) => c.json(error('NOT_FOUND', 'Route not found.'), 404));
  app.onError((cause, c) => {
    if (cause instanceof ToolError) return c.json(error(cause.code, cause.message), cause.status);
    return c.json(error('INTERNAL_ERROR', 'The operation could not be completed.'), 500);
  });
  return app;
}
