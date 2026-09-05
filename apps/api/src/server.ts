import { serve } from '@hono/node-server';
import { createApi } from './app.ts';
import { createRequestBoundary } from './request-boundary.ts';

const port = Number(process.env.STEER_API_PORT ?? '8787');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid STEER_API_PORT.');
const app = createApi();
const server = serve({ fetch: createRequestBoundary((request) => app.fetch(request)), hostname: '127.0.0.1', port,
  serverOptions: { maxHeaderSize: 16384, headersTimeout: 5000, requestTimeout: 10000,
    keepAliveTimeout: 5000, connectionsCheckingInterval: 1000 } }, () => {
  console.log(`STEER API foundation listening on http://127.0.0.1:${port}`);
});
if ('maxHeadersCount' in server && 'maxRequestsPerSocket' in server) {
  // The parser byte cap bounds headers. Do not silently truncate duplicate credentials.
  server.maxHeadersCount = 0;
  server.maxRequestsPerSocket = 100;
} else { server.close(); throw new Error('Unsupported API server transport.'); }
server.maxConnections = 128;
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    const deadline = setTimeout(() => {
      if ('closeAllConnections' in server) server.closeAllConnections();
      process.exit(1);
    }, 5000);
    deadline.unref();
    server.close((failure) => { clearTimeout(deadline); process.exit(failure ? 1 : 0); });
  });
}
