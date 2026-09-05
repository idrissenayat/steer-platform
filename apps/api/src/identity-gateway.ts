import { createRequestBoundary } from './request-boundary.ts';
import { sessionViewSchema } from './session-view.ts';

const MAX_RENDER_BYTES = 1024 * 1024;
const RENDER_TIMEOUT_MS = 5000;
const staticPath = /^\/_next\/static\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(css|js|woff2?|png|jpg|jpeg|webp|svg|ico)$/;
const types: Record<string, string> = { css: 'text/css', js: 'application/javascript', woff: 'font/woff',
  woff2: 'font/woff2', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon' };

/** Native SSR gateway. The renderer receives fixed paths and verified display data, never credentials. */
export function createIdentityGateway(configuration: { publicOrigin: string; rendererOrigin: string; issuer: string },
  dependencies: { identity: { fetch(request: Request): Promise<Response> }; fetch?: typeof fetch }) {
  let publicOrigin: string; let rendererOrigin: string; let issuerOrigin: string;
  try {
    const publicUrl = new URL(configuration.publicOrigin); const renderer = new URL(configuration.rendererOrigin);
    const issuer = new URL(configuration.issuer);
    if (publicUrl.protocol !== 'https:' || publicUrl.origin !== configuration.publicOrigin ||
        renderer.protocol !== 'http:' || renderer.hostname !== '127.0.0.1' || !renderer.port ||
        renderer.origin !== configuration.rendererOrigin || issuer.protocol !== 'https:' ||
        issuer.username || issuer.password || issuer.search || issuer.hash ||
        typeof dependencies.identity.fetch !== 'function') throw new Error();
    publicOrigin = publicUrl.origin; rendererOrigin = renderer.origin; issuerOrigin = issuer.origin;
  } catch { throw new Error('Invalid identity gateway configuration.'); }
  const transport = dependencies.fetch ?? globalThis.fetch;
  const identityFetch = dependencies.identity.fetch.bind(dependencies.identity);
  const fail = (status: number) => new Response('The request could not be served.', { status, headers: {
    'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  } });
  const dispatch = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (url.origin !== publicOrigin || url.username || url.password || url.hash) return fail(400);
    const path = url.pathname;
    if (path.startsWith('/auth/') || path.startsWith('/v1/') || path.startsWith('/health/') || path === '/openapi.json') {
      // Auth, cookies, callback query and method checks remain exclusively in the identity service.
      return identityFetch(request);
    }
    const match = staticPath.exec(path);
    if (path !== '/' && !match) return fail(404);
    if (request.method !== 'GET') return fail(405);
    if (url.search || request.body !== null) return fail(400);
    let viewHeader: string | undefined; let viewExpiry = 0;
    if (path === '/' && !request.headers.has('authorization') &&
        request.headers.get('cookie')?.split(';').some((part) => part.trim().startsWith('__Host-steer-session='))) {
      try {
        // Internal fixed-path query. Browser-supplied view/tenant/hat headers are never consumed.
        const response = await identityFetch(new Request(`${publicOrigin}/auth/session`, { method: 'POST', signal: request.signal,
          headers: { origin: publicOrigin, 'sec-fetch-site': 'same-origin', cookie: request.headers.get('cookie')! } }));
        // This is the in-process identity handler's bounded JSON output, not a remote fetch.
        const parsed = response.status === 200 ? sessionViewSchema.safeParse(await response.json()) : undefined;
        if (parsed?.success) {
          const encoded = encodeURIComponent(JSON.stringify(parsed.data)); const expiry = Date.parse(parsed.data.expiresAt);
          if (encoded.length <= 8192 && expiry > Date.now()) { viewHeader = encoded; viewExpiry = expiry; }
        }
      } catch { /* Unverified, revoked or unavailable context renders the signed-out view, never a cached identity. */ }
    }
    const controller = new AbortController();
    const abort = () => controller.abort(); request.signal.addEventListener('abort', abort, { once: true });
    if (request.signal.aborted) abort();
    const timer = setTimeout(abort, RENDER_TIMEOUT_MS);
    const deadline = performance.now() + RENDER_TIMEOUT_MS;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      // No spreading Request/headers: fixed authority, no query, cookies, bearer, Host or forwarded headers.
      const response = await transport(`${rendererOrigin}${path}`, { method: 'GET', credentials: 'omit',
        redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal,
        headers: { accept: path === '/' ? 'text/html' : types[match![1]!]!, ...(viewHeader ? { 'x-steer-session-view': viewHeader } : {}) } });
      const expectedType = path === '/' ? 'text/html' : types[match![1]!]!;
      const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
      if (response.status !== 200 || response.redirected || contentType !== expectedType || !response.body) {
        void response.body?.cancel().catch(() => {}); return fail(502);
      }
      reader = response.body.getReader();
      const chunks: Uint8Array[] = []; let size = 0; let count = 0;
      // Buffer before responding: an over-limit or incomplete renderer result never reaches the browser.
      while (true) {
        if (controller.signal.aborted || performance.now() >= deadline) throw new Error();
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (++count > 16384 || size > MAX_RENDER_BYTES) throw new Error();
        if (value.byteLength) chunks.push(value);
      }
      if (controller.signal.aborted || performance.now() >= deadline) throw new Error();
      if (viewHeader && viewExpiry <= Date.now()) throw new Error();
      const body = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
      return new Response(body, { headers: { 'content-type': expectedType + (path === '/' || match?.[1] === 'css' || match?.[1] === 'js' ? '; charset=utf-8' : ''),
        'cache-control': 'no-store', 'referrer-policy': 'same-origin', 'x-content-type-options': 'nosniff',
        'content-security-policy': `default-src 'none'; style-src 'self'; connect-src 'self'; form-action 'self' ${issuerOrigin}; base-uri 'none'; frame-ancestors 'none'`,
      } });
    } catch { return fail(request.signal.aborted ? 408 : 502); }
    finally {
      controller.abort(); clearTimeout(timer); request.signal.removeEventListener('abort', abort);
      if (reader) { void reader.cancel().catch(() => {}); reader.releaseLock(); }
    }
  };
  // Includes renderer traffic; admission is not limited to authenticated API paths.
  return { fetch: createRequestBoundary(dispatch) };
}
