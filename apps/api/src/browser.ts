import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { createBrowserSessionBroker, type BrowserSessionConfiguration, type BrowserSessionStore } from '@steer/adapters/browser-session';
import { createOidcAuthenticator, type IdentityDependencies } from '@steer/adapters/identity';
import { createOpenApiDocument, invokeTool, ToolError, type ToolServices } from '@steer/tool-registry';
import { createApi } from './app.ts';
import { readRequestBody } from './request-body.ts';
import { sessionViewSchema } from './session-view.ts';

const failure = { error: { code: 'SIGN_IN_FAILED', message: 'The sign-in operation could not be completed.' } };
const denied = { error: { code: 'FORBIDDEN', message: 'The request is not allowed.' } };
const clearLogin = '__Host-steer-login=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0';

function sameOriginMutation(request: Request, origin: string): boolean {
  const site = request.headers.get('sec-fetch-site');
  return request.headers.get('origin') === origin && (site === null || site === 'same-origin');
}

/** Extend transport descriptions; tool schemas still come from the one registry. */
export function createBrowserOpenApiDocument() {
  const document = createOpenApiDocument();
  const originParameter = { name: 'Origin', in: 'header', required: true, schema: { type: 'string', format: 'uri' },
    description: 'Exact configured HTTPS application origin. Fetch Metadata must be same-origin when supplied.' };
  const responses = {
    '303': { description: 'Fixed redirect with Secure HttpOnly host-only Set-Cookie headers; no token response body.' },
    '400': { description: 'Generic authentication failure or nonempty request body.' },
    '403': { description: 'Origin, query or credential policy rejected the request.' },
    '405': { description: 'Wrong method; no authentication state changed.' },
  };
  return { ...document, components: { ...document.components, securitySchemes: {
    ...document.components.securitySchemes,
    browserSession: { type: 'apiKey', in: 'cookie', name: '__Host-steer-session' },
    loginBinding: { type: 'apiKey', in: 'cookie', name: '__Host-steer-login' },
  } }, paths: {
    ...Object.fromEntries(Object.entries(document.paths).map(([path, operation]) => [path, { post: {
      ...operation.post, security: [{ bearerAuth: [] }, { browserSession: [] }],
      description: `${operation.post.description} Cookie authentication additionally requires exact Origin and same-origin Fetch Metadata when present. Mixed cookie/bearer credentials are rejected.`,
    } }])),
    '/auth/login': { post: { operationId: 'browser.login', security: [], parameters: [originParameter],
      description: 'Empty-body POST; no query or Authorization header. Redirects to the fixed issuer authorization endpoint.', responses } },
    '/auth/logout': { post: { operationId: 'browser.logout', security: [], parameters: [originParameter],
      description: 'Empty-body POST; no query or Authorization header. Deletes the supplied local session if present, clears cookies and redirects to the fixed app root. Not provider-wide logout.', responses } },
    '/auth/session': { post: { operationId: 'browser.session', security: [{ browserSession: [] }], parameters: [originParameter],
      description: 'Empty-body, same-origin current human-session display query. Revalidates current authority and the session.context tool grant. No caller-selected organization, bearer credentials or tokens in the result.',
      responses: { '200': { description: 'Current subject, organization, hats and session expiry for display only.' },
        '400': responses['400'], '401': { description: 'No current human session.' }, '403': responses['403'], '405': responses['405'] } } },
    '/auth/callback': { get: { operationId: 'browser.callback', security: [{ loginBinding: [] }],
      description: 'One-use browser-bound authorization-code response. Success redirects to the fixed app root. Errors clear only the login cookie and never reflect provider input.',
      parameters: ['code', 'state', 'iss', 'session_state'].map((name) => ({ name, in: 'query', required: name !== 'session_state', schema: { type: 'string' } })), responses } },
  } };
}

/** No user input is accepted by login/logout; bound actual bytes, not Content-Length. */
async function emptyBody(request: Request): Promise<boolean> {
  try { await readRequestBody(request, 0); return true; } catch { return false; }
}

/** Explicit composition only. CLI startup never installs these routes by default. */
export function createBrowserApi(configuration: BrowserSessionConfiguration,
  dependencies: IdentityDependencies & { store: BrowserSessionStore; services?: ToolServices }) {
  const broker = createBrowserSessionBroker(configuration, dependencies);
  const callback = new URL(configuration.redirectUri);
  if (callback.pathname !== '/auth/callback') throw new Error('Invalid browser route configuration.');
  const origin = callback.origin;
  const bearer = createOidcAuthenticator({ issuer: configuration.issuer, jwksUri: configuration.jwksUri,
    audience: configuration.audience, clientIds: [configuration.clientId], maxTokenAgeSeconds: 300 }, dependencies);
  const app = new Hono();
  app.use('*', secureHeaders());
  app.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    c.header('Pragma', 'no-cache');
    c.header('Referrer-Policy', 'no-referrer');
    c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const url = new URL(c.req.url);
    // No Host/X-Forwarded-* inference. A trusted ingress must supply the canonical URL.
    if (url.origin !== origin || url.username || url.password || url.hash) return c.json(denied, 403);
    await next();
    c.header('Referrer-Policy', 'no-referrer');
  });
  app.all('/auth/login', async (c) => {
    if (c.req.method !== 'POST') { c.header('Allow', 'POST'); return c.json(denied, 405); }
    if (!sameOriginMutation(c.req.raw, origin) || new URL(c.req.url).search || c.req.header('authorization')) return c.json(denied, 403);
    try {
      if (!await emptyBody(c.req.raw)) return c.json(denied, 400);
      const start = await broker.begin(c.req.header('origin') ?? null);
      c.header('Set-Cookie', start.setCookie, { append: true });
      return c.redirect(start.authorizationUrl, 303);
    } catch { return c.json(failure, 400); }
  });
  app.all('/auth/callback', async (c) => {
    if (c.req.method !== 'GET') { c.header('Allow', 'GET'); return c.json(denied, 405); }
    try {
      const result = await broker.complete(c.req.url, c.req.header('cookie') ?? null);
      for (const value of result.setCookies) c.header('Set-Cookie', value, { append: true });
      // Never propagate query, returnTo, provider tokens or codes into this redirect.
      return c.redirect(`${origin}/`, 303);
    } catch {
      c.header('Set-Cookie', clearLogin, { append: true });
      return c.json(failure, 400);
    }
  });
  app.all('/auth/logout', async (c) => {
    if (c.req.method !== 'POST') { c.header('Allow', 'POST'); return c.json(denied, 405); }
    if (!sameOriginMutation(c.req.raw, origin) || new URL(c.req.url).search || c.req.header('authorization')) return c.json(denied, 403);
    try {
      if (!await emptyBody(c.req.raw)) return c.json(denied, 400);
      const result = await broker.logout(c.req.header('cookie') ?? null, c.req.header('origin') ?? null);
      for (const value of result.setCookies) c.header('Set-Cookie', value, { append: true });
      return c.redirect(`${origin}/`, 303);
    } catch { return c.json(failure, 400); }
  });
  app.all('/auth/session', async (c) => {
    if (c.req.method !== 'POST') { c.header('Allow', 'POST'); return c.json(denied, 405); }
    if (!sameOriginMutation(c.req.raw, origin) || new URL(c.req.url).search || c.req.raw.headers.has('authorization')) return c.json(denied, 403);
    if (!await emptyBody(c.req.raw)) return c.json(denied, 400);
    const principal = await broker.authenticate(c.req.header('cookie') ?? null);
    if (!principal) return c.json({ error: { code: 'UNAUTHENTICATED', message: 'A current authenticated identity is required.' } }, 401);
    try {
      invokeTool('session.context', { organizationId: principal.organizationId }, { principal, now: dependencies.now?.() ?? new Date() });
      return c.json(sessionViewSchema.parse({ subject: principal.subject, organizationId: principal.organizationId,
        hats: principal.hats, expiresAt: principal.expiresAt }));
    } catch (error) { return c.json(denied, error instanceof ToolError && error.code === 'UNAUTHENTICATED' ? 401 : 403); }
  });
  app.get('/openapi.json', (c) => c.json(createBrowserOpenApiDocument()));
  app.route('/', createApi({
    ...(dependencies.services ? { services: dependencies.services } : {}),
    authenticate: async (request) => {
      const cookies = request.headers.get('cookie');
      const hasSession = cookies?.split(';').some((part) => part.trim().startsWith('__Host-steer-session=')) ?? false;
      if (hasSession) {
        // Do not let a bearer header mask a revoked/malformed ambient session.
        if (request.headers.has('authorization') || !sameOriginMutation(request, origin)) return null;
        return broker.authenticate(cookies);
      }
      return bearer(request);
    },
    ...(dependencies.now ? { now: dependencies.now } : {}),
  }));
  app.onError((_cause, c) => c.json({ error: { code: 'INTERNAL_ERROR', message: 'The operation could not be completed.' } }, 500));
  return app;
}
