import assert from 'node:assert/strict';
import { createHash, X509Certificate } from 'node:crypto';
import { createServer, type Server } from 'node:https';
import { execFile } from 'node:child_process';
import { chmod, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { getRequestListener } from '@hono/node-server';
import { chromium, type Browser } from 'playwright';
import type { AuthorizationRecord } from '@steer/adapters/identity';
import { createIdentityService } from '../src/identity-service.ts';
import { createGitAuthorizationHarness } from './git-authorization-harness.ts';
import type { SessionTestHarness } from './session-harness.ts';

/** Disposable Chromium/HTTPS fixture. No user's browser profile or OS trust changes. */
export async function createBrowserAuthHarness(tls: { key: Buffer; certificate: Buffer; temporary: string }) {
  const servers: Server[] = []; let browser: Browser | undefined;
  let api: ReturnType<typeof createIdentityService> | undefined;
  let origin = ''; let issuerOrigin = ''; let callbackUrl = ''; let callbackCrossSite = false; let callbackHasLoginCookie = false;
  let loginStatus = 0; let loginOriginMatches = false;
  let homeHasReferer = false;
  let logoutObservation = { cookie: false, crossSite: false };
  const pageHtml = '<!doctype html><html lang="en"><meta charset="utf-8"><title>STEER isolated authentication test</title><h1>Authentication test</h1><form method="post" action="/auth/login"><button>Sign in</button></form><form method="post" action="/auth/logout"><button>Sign out</button></form></html>';
  const html = (body: string, crossSiteForm = false) => new Response(body, { headers: {
    'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
    'content-security-policy': `default-src 'none'; connect-src 'self'; form-action ${crossSiteForm ? origin : `'self' ${issuerOrigin}`}; base-uri 'none'; frame-ancestors 'none'`,
  } });
  const startServer = async (key: Buffer, certificate: Buffer, handler: (request: Request) => Promise<Response> | Response) => {
    const server = createServer({ key, cert: certificate }, getRequestListener(handler, {
      errorHandler: () => new Response('Synthetic test request failed.', { status: 500 }),
    }));
    server.requestTimeout = 15000; server.headersTimeout = 10000; servers.push(server);
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const address = server.address(); assert.ok(address && typeof address !== 'string'); return address.port;
  };
  const close = async () => {
    try { if (browser) await browser.close(); }
    finally {
      await Promise.all(servers.map((server) => new Promise<void>((resolve, reject) => {
        server.closeAllConnections(); server.close((error) => error ? reject(error) : resolve());
      })));
    }
  };
  try {
    const port = await startServer(tls.key, tls.certificate, async (request) => {
      const url = new URL(request.url);
      if (url.pathname === '/' && request.method === 'GET') { homeHasReferer = request.headers.has('referer'); return html(pageHtml); }
      if (url.pathname === '/auth/callback') {
        callbackUrl = request.url; callbackCrossSite = request.headers.get('sec-fetch-site') === 'cross-site';
        callbackHasLoginCookie = /(?:^|;\s*)__Host-steer-login=/.test(request.headers.get('cookie') ?? '');
      }
      if (url.pathname === '/auth/logout') logoutObservation = {
        cookie: /(?:^|;\s*)__Host-steer-session=/.test(request.headers.get('cookie') ?? ''),
        crossSite: request.headers.get('sec-fetch-site') === 'cross-site',
      };
      const response = api ? await api.fetch(request) : new Response('Synthetic service initializing.', { status: 503 });
      if (url.pathname === '/auth/login') { loginStatus = response.status; loginOriginMatches = request.headers.get('origin') === origin; }
      return response;
    });
    origin = `https://localhost:${port}`;
    const attackerPort = await startServer(tls.key, tls.certificate, () => html(
      `<form method="post" action="${origin}/auth/logout"><button>Cross-site sign out</button></form>`, true));
    const attackerOrigin = `https://127.0.0.1:${attackerPort}`;
    const exec = promisify(execFile);
    const badKeyPath = join(tls.temporary, 'untrusted-tls.key'); const badCertPath = join(tls.temporary, 'untrusted-tls.crt');
    await exec('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-noenc', '-days', '1', '-subj', '/CN=localhost',
      '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1', '-keyout', badKeyPath, '-out', badCertPath], { timeout: 30000 });
    await chmod(badKeyPath, 0o600);
    const badPort = await startServer(await readFile(badKeyPath), await readFile(badCertPath), () => html(pageHtml));
    const badOrigin = `https://localhost:${badPort}`;
    return { origin, close, async run(deps: { issuer: string; clientSecret: string; subject: string;
      username: string; password: string; fetch: typeof fetch;
      createSessions: (binding: { issuer: string; clientId: string; redirectUri: string }) => Promise<SessionTestHarness>;
      check: (label: string, run: () => Promise<void>) => Promise<void> }) {
      const { issuer, check } = deps;
      issuerOrigin = new URL(issuer).origin;
      const configuration = { issuer, jwksUri: `${issuer}/protocol/openid-connect/certs`,
        authorizationEndpoint: `${issuer}/protocol/openid-connect/auth`, tokenEndpoint: `${issuer}/protocol/openid-connect/token`,
        redirectUri: `${origin}/auth/callback`, clientId: 'steer-test-web', clientSecret: deps.clientSecret, audience: 'steer-api' };
      const storage = await deps.createSessions({ issuer, clientId: configuration.clientId, redirectUri: configuration.redirectUri });
      assert.equal(storage.kind, 'postgres');
      await check('explicit runtime bootstrap composes real encrypted storage without implicit provider access', async () => {
        assert.ok(storage.verifyRuntimeBootstrap);
        await storage.verifyRuntimeBootstrap(configuration, tls.key.toString('utf8'));
        assert.deepEqual(await storage.counts(), { transactions: 0, sessions: 0 });
      });
      const grant: AuthorizationRecord = { issuer, subject: deps.subject, organizationId: 'synthetic-org', type: 'human',
        hats: ['product-lead'], toolGrants: ['session.context'], active: true,
        validAfter: new Date(0).toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString() };
      const source = await createGitAuthorizationHarness(tls.temporary, grant);
      assert.ok(storage.shutdown);
      const dependencies = { fetch: deps.fetch, reader: source.reader, authorizationPath: source.authorizationPath,
        sessions: { store: storage.store, binding: { issuer, clientId: configuration.clientId, redirectUri: configuration.redirectUri }, shutdown: storage.shutdown } };
      api = createIdentityService(configuration, dependencies);
      const services = [api];
      const spki = createHash('sha256').update(new X509Certificate(tls.certificate).publicKey.export({ type: 'spki', format: 'der' })).digest('base64');
      // Test-only exception for this run's key, not blanket TLS-error suppression.
      browser = await chromium.launch({ headless: true, chromiumSandbox: true,
        args: [`--ignore-certificate-errors-spki-list=${spki}`] });
      const context = await browser.newContext({ ignoreHTTPSErrors: false, acceptDownloads: false });
      const allowed = new Set([origin, new URL(issuer).origin, attackerOrigin, badOrigin]);
      await context.route('**/*', async (route) => {
        if (allowed.has(new URL(route.request().url()).origin)) await route.continue(); else await route.abort('blockedbyclient');
      });
      const page = await context.newPage(); page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(20000);
      const tool = () => page.evaluate(async () => {
        const response = await fetch('/v1/tools/session.context', { method: 'POST',
          headers: { 'content-type': 'application/json' }, body: JSON.stringify({ organizationId: 'synthetic-org' }) });
        return { status: response.status, data: await response.json() };
      });
      await check('Chromium trusts only the generated test key and rejects an unrelated invalid certificate', async () => {
        const badPage = await context.newPage();
        try { await assert.rejects(badPage.goto(badOrigin), /ERR_CERT_/); } finally { await badPage.close(); }
        assert.equal((await page.goto(origin))?.status(), 200);
        assert.equal(await page.title(), 'STEER isolated authentication test');
      });
      await check('native browser form and cross-site Keycloak navigation complete the real encrypted-session login', async () => {
        let step = 'login-redirect';
        try {
          await Promise.all([page.waitForURL((url) => url.origin === issuerOrigin), page.getByRole('button', { name: 'Sign in', exact: true }).click()]);
          step = 'provider-form';
          await page.locator('#username').fill(deps.username); await page.locator('#password').fill(deps.password);
          step = 'callback-navigation';
          await Promise.all([page.waitForURL(`${origin}/`), page.locator('#kc-login').click()]);
        } catch {
          console.log('Browser login flags (no credentials):', JSON.stringify({ step, loginStatus, loginOriginMatches,
            onIssuer: new URL(page.url()).origin === issuerOrigin, onApplication: new URL(page.url()).origin === origin }));
          throw new Error('Synthetic browser login failed; payloads omitted.');
        }
        assert.equal(callbackCrossSite, true); assert.equal(callbackHasLoginCookie, true);
        assert.equal(homeHasReferer, false, 'The callback query must not become a root-page referrer');
        assert.deepEqual(await storage.counts(), { transactions: 0, sessions: 1 });
        const current = await tool(); assert.equal(current.status, 200); assert.equal(current.data.subject, deps.subject);
        assert.deepEqual(current.data.hats, ['product-lead']);
      });
      await check('browser stores only opaque Secure HttpOnly host-only Lax session cookie, not tokens in web storage', async () => {
        const cookies = (await context.cookies(origin)).filter((cookie) => cookie.name.startsWith('__Host-steer-'));
        assert.equal(cookies.length, 1); const cookie = cookies[0]!;
        assert.equal(cookie.name, '__Host-steer-session'); assert.match(cookie.value, /^[A-Za-z0-9_-]{43}$/);
        assert.equal(cookie.domain, 'localhost'); assert.equal(cookie.path, '/'); assert.equal(cookie.httpOnly, true);
        assert.equal(cookie.secure, true); assert.equal(cookie.sameSite, 'Lax');
        assert.ok(cookie.expires > Date.now() / 1000 && cookie.expires <= Date.now() / 1000 + 300);
        const visible = await page.evaluate(() => ({ cookie: document.cookie, local: Object.keys(localStorage), session: Object.keys(sessionStorage) }));
        assert.ok(!visible.cookie.includes('__Host-steer-')); assert.deepEqual(visible.local, []); assert.deepEqual(visible.session, []);
        assert.ok(storage.verifyCiphertext); await storage.verifyCiphertext();
      });
      await check('browser cross-site logout omits the Lax cookie and the API rejects the foreign Origin', async () => {
        await page.goto(attackerOrigin);
        const response = page.waitForResponse((value) => value.url() === `${origin}/auth/logout`);
        await page.getByRole('button', { name: 'Cross-site sign out', exact: true }).click();
        assert.equal((await response).status(), 403);
        assert.deepEqual(logoutObservation, { cookie: false, crossSite: true });
        assert.equal((await storage.counts()).sessions, 1);
        await page.goto(origin); assert.equal((await tool()).status, 200);
      });
      await check('browser session recovers after reconstruction and observes Git-committed membership revocation', async () => {
        api = createIdentityService(configuration, { ...dependencies, sessions: { ...dependencies.sessions, store: storage.freshStore() } });
        services.push(api);
        await page.reload(); assert.equal((await tool()).status, 200);
        await source.publish([{ ...grant, active: false }]); assert.equal((await tool()).status, 401);
        await source.publish([grant]); assert.equal((await tool()).status, 200);
      });
      await check('Git source outage, moving head and digest failure deny existing browser sessions without stale fallback', async () => {
        for (const fault of ['unavailable', 'moving-head', 'digest'] as const) {
          source.setFault(fault); assert.equal((await tool()).status, 401);
          source.setFault('none'); assert.equal((await tool()).status, 200);
        }
      });
      await check('Git-committed missing, duplicate and cross-organization memberships fail closed', async () => {
        for (const records of [[], [grant, grant], [{ ...grant, organizationId: 'foreign-org' }]]) {
          await source.publish(records); assert.equal((await tool()).status, 401);
        }
        await source.publish([grant], 'foreign-org'); assert.equal((await tool()).status, 401);
        await source.publish([grant]); assert.equal((await tool()).status, 200);
      });
      await check('browser callback replay fails safely and does not destroy the valid session', async () => {
        const replay = callbackUrl;
        const response = await page.goto(replay); assert.equal(response?.status(), 400);
        assert.equal((await storage.counts()).sessions, 1);
        assert.ok(!(await page.textContent('body'))?.includes(deps.password));
        await page.goto(origin); assert.equal((await tool()).status, 200);
      });
      await check('native same-origin logout clears browser cookies and durable authentication', async () => {
        const response = page.waitForResponse((value) => value.url() === `${origin}/auth/logout`);
        await page.getByRole('button', { name: 'Sign out', exact: true }).click();
        assert.equal((await response).status(), 303);
        await page.waitForURL(`${origin}/`, { waitUntil: 'load' }); assert.equal((await tool()).status, 401);
        assert.equal((await storage.counts()).sessions, 0);
        assert.equal((await context.cookies(origin)).filter((cookie) => cookie.name.startsWith('__Host-steer-')).length, 0);
      });
      await check('composed identity services stop admission and confirm request/resource shutdown in the actual browser', async () => {
        await Promise.all(services.map((service) => service.shutdown()));
        for (const service of services) assert.deepEqual(service.status(), { state: 'stopped', activeRequests: 0 });
        assert.equal((await tool()).status, 503);
        assert.throws(() => storage.freshStore(), /Synthetic runtime resources are closed/);
        assert.deepEqual(await storage.counts(), { transactions: 0, sessions: 0 });
      });
      console.log(`Browser authentication engine: Chromium ${browser.version()}; isolated profile, synthetic identities only.`);
      await context.close();
    } };
  } catch { await close(); throw new Error('Browser authentication fixture initialization failed; details omitted.'); }
}
