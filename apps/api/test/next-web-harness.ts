import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

/** Serve the actual prebuilt Next.js app on an owned loopback port, without any secret inputs. */
export async function createNextWebHarness(origin: string, issuer: string, enabled = true) {
  const reservation = createServer();
  await new Promise<void>((resolve) => reservation.listen(0, '127.0.0.1', resolve));
  const address = reservation.address();
  if (!address || typeof address === 'string') throw new Error('Synthetic web port unavailable.');
  const port = address.port;
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  const root = fileURLToPath(new URL('../../web/', import.meta.url));
  const child = spawn(process.execPath, [fileURLToPath(new URL('../../web/node_modules/next/dist/bin/next', import.meta.url)), 'start', '-H', '127.0.0.1', '-p', String(port)], {
    cwd: root, env: { PATH: process.env.PATH ?? '', NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
      STEER_WEB_AUTH: enabled ? 'enabled' : 'disabled', STEER_WEB_AUTH_ORIGIN: origin, STEER_WEB_IDENTITY_ISSUER: issuer },
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  let exited = false; let startedError = false;
  const exit = new Promise<void>((resolve) => {
    child.once('exit', () => { exited = true; resolve(); });
    child.once('error', () => { startedError = true; exited = true; resolve(); });
  });
  const close = async () => { if (!exited) child.kill('SIGTERM'); await exit; };
  const base = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100 && !exited; attempt++) {
      try { if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
      await delay(100);
    }
    if (!ready || startedError) throw new Error('Synthetic Next.js startup failed. Build the web app first.');
    return { close, async page(request: Request): Promise<Response> {
      const path = new URL(request.url).pathname;
      if (request.method !== 'GET' || (path !== '/' && !path.startsWith('/_next/static/'))) return new Response('Not found', { status: 404 });
      // No cookies, auth, host or callback query is forwarded to the separate renderer.
      const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(5000), redirect: 'error' });
      return new Response(response.body, { status: response.status, headers: {
        'content-type': response.headers.get('content-type') ?? 'application/octet-stream', 'cache-control': 'no-store',
        'referrer-policy': 'same-origin', 'x-content-type-options': 'nosniff',
        // Native-form SSR proof: intentionally disable scripts, permit only same-origin CSS and the fixed IdP form destination.
        'content-security-policy': `default-src 'none'; style-src 'self'; connect-src 'self'; form-action 'self' ${new URL(issuer).origin}; base-uri 'none'; frame-ancestors 'none'`,
      } });
    } };
  } catch { await close(); throw new Error('Synthetic Next.js fixture initialization failed.'); }
}
