import { createServer } from 'node:https';
import { getRequestListener } from '@hono/node-server';

export interface LocalIdentityApplication {
  fetch(request: Request): Promise<Response>;
  shutdown(): Promise<void>;
}

/** Owned loopback HTTPS transport. No secret loading, public ingress or process signal ownership. */
export async function startLocalIdentityListener(configuration: { publicOrigin: string; tls: { key: string; cert: string } },
  application: LocalIdentityApplication) {
  let state: 'starting' | 'running' | 'draining' | 'stopped' | 'failed' = 'starting';
  let activeRequests = 0; let forcedConnections = false; let transportFailed = false;
  let finishRequests: (() => void) | undefined; let shutdown: Promise<void> | undefined;
  let server: ReturnType<typeof createServer> | undefined;
  const stopApplication = application.shutdown.bind(application);
  const fetchApplication = application.fetch.bind(application);
  const unavailable = () => new Response('The local service is unavailable.', { status: 503, headers: {
    'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  } });
  const stop = (): Promise<void> => {
    if (shutdown) return shutdown;
    state = 'draining';
    const requests = activeRequests ? new Promise<void>((resolve) => { finishRequests = resolve; }) : Promise.resolve();
    const resources = Promise.resolve().then(stopApplication);
    const transport = !server?.listening ? Promise.resolve() : new Promise<void>((resolve, reject) => {
      server!.close((error) => error ? reject(error) : resolve());
    });
    const timer = setTimeout(() => { forcedConnections = true; server?.closeAllConnections(); }, 5000);
    timer.unref();
    shutdown = Promise.allSettled([requests, resources, transport]).then((results) => {
      clearTimeout(timer); finishRequests = undefined;
      if (transportFailed || results.some((result) => result.status === 'rejected')) {
        state = 'failed'; throw new Error('Local identity listener shutdown could not be confirmed.');
      }
      state = 'stopped';
    });
    return shutdown;
  };
  try {
    const origin = new URL(configuration.publicOrigin);
    if (origin.origin !== configuration.publicOrigin || origin.protocol !== 'https:' || !origin.port ||
        !['localhost', '127.0.0.1'].includes(origin.hostname) ||
        typeof configuration.tls.key !== 'string' || typeof configuration.tls.cert !== 'string') throw new Error();
    server = createServer({ key: configuration.tls.key, cert: configuration.tls.cert, minVersion: 'TLSv1.2', handshakeTimeout: 5000,
      maxHeaderSize: 16384, headersTimeout: 5000, requestTimeout: 10000, keepAliveTimeout: 5000,
      connectionsCheckingInterval: 1000 }, getRequestListener(async (request) => {
      if (state !== 'running') return unavailable();
      // Actual HTTPS URL only; neither Host aliases nor forwarding headers select an identity origin.
      if (new URL(request.url).origin !== origin.origin) return new Response('Invalid local origin.', { status: 400,
        headers: unavailable().headers });
      activeRequests++;
      try { return await fetchApplication(request); }
      catch { return unavailable(); }
      finally { activeRequests--; if (!activeRequests) finishRequests?.(); }
    }, { errorHandler: unavailable }));
    server.maxHeadersCount = 0; server.maxRequestsPerSocket = 100; server.maxConnections = 128;
    server.on('error', () => {
      if (state !== 'starting') { transportFailed = true; void stop().catch(() => {}); }
    });
    await new Promise<void>((resolve, reject) => {
      const failed = () => reject(new Error('Local identity listener startup failed.'));
      server!.once('error', failed);
      server!.listen(Number(origin.port), '127.0.0.1', () => { server!.removeListener('error', failed); resolve(); });
    });
    state = 'running';
    return { shutdown: stop, status: () => ({ state, activeRequests, forcedConnections, listening: server!.listening }) };
  } catch {
    try { await stop(); }
    catch { throw new Error('Local identity listener startup cleanup could not be confirmed.'); }
    throw new Error('Local identity listener could not be initialized.');
  }
}
