import { serve } from '@hono/node-server';
import { createApi } from './app.ts';

const port = Number(process.env.STEER_API_PORT ?? '8787');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid STEER_API_PORT.');
const server = serve({ fetch: createApi().fetch, hostname: '127.0.0.1', port }, () => {
  console.log(`STEER API foundation listening on http://127.0.0.1:${port}`);
});
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
