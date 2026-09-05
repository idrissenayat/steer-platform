import assert from 'node:assert/strict';
import { createHash, X509Certificate } from 'node:crypto';
import { createServer, type Server } from 'node:https';
import { execFile } from 'node:child_process';
import { chmod, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { getRequestListener } from '@hono/node-server';
import { chromium, type Browser } from 'playwright';
import type { AuthorizationRecord } from '@steer/adapters/identity';
import { createIdentityService } from '../src/identity-service.ts';
import { createIdentityGateway } from '../src/identity-gateway.ts';
import { startLocalIdentityListener } from '../src/identity-listener.ts';
import { reserveLocalPort } from './local-tls-harness.ts';
import { createGitAuthorizationHarness } from './git-authorization-harness.ts';
import { createNextWebHarness } from './next-web-harness.ts';
import type { SessionTestHarness } from './session-harness.ts';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpTestFetch } from './mcp-keycloak.integration.ts';
import { mcpProtocolVersion } from '../src/mcp.ts';
import type { ProjectionChangesInput, ProjectionChangesResult, ProjectionSnapshotResult } from '@steer/tool-registry';
import { createProjectionConsumer } from '@steer/tool-registry/projection-consumer';

/** Disposable Chromium/HTTPS fixture. No user's browser profile or OS trust changes. */
export async function createBrowserAuthHarness(tls: { key: Buffer; certificate: Buffer; temporary: string }) {
  const servers: Server[] = []; let browser: Browser | undefined;
  let web: Awaited<ReturnType<typeof createNextWebHarness>> | undefined;
  let api: ReturnType<typeof createIdentityService> | undefined;
  let gateway: ReturnType<typeof createIdentityGateway> | undefined;
  let applicationListener: Awaited<ReturnType<typeof startLocalIdentityListener>> | undefined;
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
    try { if (browser) await browser.close(); if (web) await web.close(); }
    finally {
      try { await applicationListener?.shutdown(); }
      finally {
        await Promise.all(servers.map((server) => new Promise<void>((resolve, reject) => {
          server.closeAllConnections(); server.close((error) => error ? reject(error) : resolve());
        })));
      }
    }
  };
  try {
    const port = await reserveLocalPort(); origin = `https://localhost:${port}`;
    applicationListener = await startLocalIdentityListener({ publicOrigin: origin,
      tls: { key: tls.key.toString('utf8'), cert: tls.certificate.toString('utf8') } }, { fetch: async (request) => {
      const url = new URL(request.url);
      if (url.pathname === '/' && request.method === 'GET') homeHasReferer = request.headers.has('referer');
      if (url.pathname === '/auth/callback') {
        callbackUrl = request.url; callbackCrossSite = request.headers.get('sec-fetch-site') === 'cross-site';
        callbackHasLoginCookie = /(?:^|;\s*)__Host-steer-login=/.test(request.headers.get('cookie') ?? '');
      }
      if (url.pathname === '/auth/logout') logoutObservation = {
        cookie: /(?:^|;\s*)__Host-steer-session=/.test(request.headers.get('cookie') ?? ''),
        crossSite: request.headers.get('sec-fetch-site') === 'cross-site',
      };
      const response = gateway ? await gateway.fetch(request) : new Response('Synthetic service initializing.', { status: 503 });
      if (url.pathname === '/auth/login') { loginStatus = response.status; loginOriginMatches = request.headers.get('origin') === origin; }
      return response;
    }, shutdown: async () => { await api?.shutdown(); } });
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
      agent: { bearer: string; clientId: string; grant: AuthorizationRecord };
      createSessions: (binding: { issuer: string; clientId: string; redirectUri: string }) => Promise<SessionTestHarness>;
      check: (label: string, run: () => Promise<void>) => Promise<void> }) {
      const { issuer, check } = deps;
      issuerOrigin = new URL(issuer).origin;
      web = await createNextWebHarness(origin, issuer);
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
      await check('encrypted secret bundle starts real TLS/storage runtime and remains usable after input-buffer cleanup', async () => {
        assert.ok(storage.verifySecretBootstrap);
        await storage.verifySecretBootstrap(configuration, { key: tls.key.toString('utf8'), cert: tls.certificate.toString('utf8') });
        assert.deepEqual(await storage.counts(), { transactions: 0, sessions: 0 });
      });
      const grant: AuthorizationRecord = { issuer, subject: deps.subject, organizationId: 'synthetic-org', type: 'human',
        hats: ['product-lead'], toolGrants: ['session.context', 'projection.artifact.read', 'projection.changes.read', 'projection.snapshot.read'], active: true,
        validAfter: new Date(0).toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString() };
      const source = await createGitAuthorizationHarness(tls.temporary, grant);
      assert.ok(storage.createProjectionFixture);
      const projection = await storage.createProjectionFixture(source.reader, [source.artifactPath, source.secondArtifactPath]);
      await source.publish([grant, deps.agent.grant]);
      assert.ok(storage.shutdown);
      const dependencies = { fetch: deps.fetch, reader: source.reader, authorizationPath: source.authorizationPath, services: projection.services,
        mcp: { clientIds: [deps.agent.clientId] },
        sessions: { store: storage.store, binding: { issuer, clientId: configuration.clientId, redirectUri: configuration.redirectUri }, shutdown: storage.shutdown } };
      api = createIdentityService(configuration, dependencies);
      let injectCspProbe = false;
      const bindGateway = (rendererOrigin: string) => createIdentityGateway({ publicOrigin: origin, rendererOrigin, issuer },
        { identity: { fetch: (request) => api!.fetch(request) }, fetch: async (input, init) => {
          const response = await fetch(input, init);
          if (!injectCspProbe || new URL(String(input)).pathname !== '/') return response;
          // Test-only parser-inserted probes. Dynamic injection by trusted scripts is
          // deliberately allowed by strict-dynamic and is not an untrusted HTML test.
          const body = (await response.text()).replace('</body>', '<script id="synthetic-csp-script" nonce="forged-nonce">window.__steerUnsafeScript = true</script><button id="synthetic-csp-handler" onclick="window.__steerUnsafeHandler = true">Synthetic CSP probe</button></body>');
          return new Response(body, { status: response.status, headers: response.headers });
        } });
      gateway = bindGateway(web.rendererOrigin);
      const services = [api];
      await check('combined HTTPS gateway serves a real agent PostgreSQL artifact query with current Git authority', async () => {
        const transportFetch = createMcpTestFetch(origin, tls.certificate.toString());
        const client = new Client({ name: 'steer-combined-fixture', version: '1.0.0' }, { versionNegotiation: { mode: { pin: mcpProtocolVersion } } });
        try {
          await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), { protocolVersion: mcpProtocolVersion,
            requestInit: { headers: { authorization: `Bearer ${deps.agent.bearer}` } }, fetch: transportFetch }));
          const read = () => client.callTool({ name: 'projection.artifact.read', arguments: projection.input });
          const result = await read(); assert.ok(!result.isError);
          const actual = (result.structuredContent as { result: { content: string } }).result;
          assert.equal(actual.content, (await source.reader.readArtifact(projection.input.path, projection.input.revision)).content);
          const feed = await client.callTool({ name: 'projection.changes.read', arguments: {
            organizationId: projection.input.organizationId, repository: projection.input.repository, cursor: null, limit: 100,
          } });
          assert.ok(!feed.isError); const changes = (feed.structuredContent as { result: ProjectionChangesResult }).result;
          assert.equal(changes.outcome, 'page'); if (changes.outcome === 'page') { assert.equal(changes.events.length, 4); assert.equal(changes.snapshotRequired, true); }
          const snapshot = await client.callTool({ name: 'projection.snapshot.read', arguments: {
            organizationId: projection.input.organizationId, repository: projection.input.repository,
          } });
          assert.ok(!snapshot.isError); const state = (snapshot.structuredContent as { result: ProjectionSnapshotResult }).result;
          assert.equal(state.outcome, 'snapshot'); assert.equal(state.records.length, 2);
          if (changes.outcome === 'page') assert.deepEqual(state.cursor, changes.cursor);
          const consumeTool = async (name: string, args: Record<string, unknown>) => {
            const result = await client.callTool({ name, arguments: args });
            if (result.isError) throw new Error('Synthetic consumer tool denied.');
            return (result.structuredContent as { result: unknown }).result;
          };
          const consumer = createProjectionConsumer({ organizationId: projection.input.organizationId, repository: projection.input.repository }, {
            snapshot: (args) => consumeTool('projection.snapshot.read', { ...args }),
            changes: (args) => consumeTool('projection.changes.read', { ...args }),
          });
          try {
            const initial = await consumer.sync(); assert.equal(initial.phase, 'ready'); assert.equal(initial.records.length, 2); assert.equal(initial.cursor?.position, '4');
            assert.deepEqual((await consumer.sync()).records, initial.records);
            await source.publish([grant, { ...deps.agent.grant, active: false }]);
            const denied = await consumer.sync(); assert.equal(denied.phase, 'failed'); assert.deepEqual(denied.records, []); assert.equal(denied.cursor, null);
            await source.publish([grant, deps.agent.grant]); assert.equal((await consumer.sync()).phase, 'ready');
          } finally { await consumer.close(); }
          assert.equal(consumer.view().phase, 'closed');
          assert.equal((await client.callTool({ name: 'projection.artifact.read', arguments: { ...projection.input, organizationId: 'foreign' } })).isError, true);
          assert.equal((await transportFetch(`${origin}/mcp`, { method: 'POST', headers: {
            authorization: `Bearer ${deps.agent.bearer}`, cookie: '__Host-steer-session=synthetic',
          } })).status, 403);
          await source.publish([grant, { ...deps.agent.grant, active: false }]); await assert.rejects(read());
          await source.publish([grant, deps.agent.grant]); assert.ok(!(await read()).isError);
        } finally { await client.close(); }
      });
      const spki = createHash('sha256').update(new X509Certificate(tls.certificate).publicKey.export({ type: 'spki', format: 'der' })).digest('base64');
      // Test-only exception for this run's key, not blanket TLS-error suppression.
      browser = await chromium.launch({ headless: true, chromiumSandbox: true,
        args: [`--ignore-certificate-errors-spki-list=${spki}`] });
      const context = await browser.newContext({ ignoreHTTPSErrors: false, acceptDownloads: false });
      const allowed = new Set([origin, new URL(issuer).origin, attackerOrigin, badOrigin]);
      let nextApplicationRequest = Date.now();
      await context.route('**/*', async (route) => {
        const requestOrigin = new URL(route.request().url()).origin;
        if (!allowed.has(requestOrigin)) { await route.abort('blockedbyclient'); return; }
        if (requestOrigin === origin) {
          // Functional navigation tests use the configured sustained ingress rate.
          // Each actual request is sent once; this is not a production-limit override or retry.
          const scheduled = Math.max(Date.now(), nextApplicationRequest); nextApplicationRequest = scheduled + 500;
          if (scheduled > Date.now()) await delay(scheduled - Date.now());
        }
        await route.continue();
      });
      const page = await context.newPage(); page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(20000);
      const readSessionOnce = () => page.evaluate(async () => {
        const response = await fetch('/v1/tools/session.context', { method: 'POST',
          headers: { 'content-type': 'application/json' }, body: JSON.stringify({ organizationId: 'synthetic-org' }) });
        return { status: response.status, retryAfter: response.headers.get('retry-after'), data: await response.json() };
      });
      const tool = async () => {
        let result = await readSessionOnce();
        // Expanded real-script navigation can consume the shared admission burst.
        // Only this read-only assertion may honor Retry-After; auth mutations never retry.
        for (let attempt = 0; result.status === 429 && attempt < 3; attempt++) {
          console.log('Synthetic session assertion: HTTP 429, honoring bounded Retry-After.');
          assert.equal(result.retryAfter, '1'); await delay(1000); result = await readSessionOnce();
        }
        return result;
      };
      await check('Chromium trusts only the generated test key and rejects an unrelated invalid certificate', async () => {
        const badPage = await context.newPage();
        try { await assert.rejects(badPage.goto(badOrigin), /ERR_CERT_/); } finally { await badPage.close(); }
        assert.equal((await page.goto(origin))?.status(), 200);
        assert.equal(await page.title(), 'STEER · Phase 1 foundation');
        assert.equal(await page.getByRole('heading', { name: 'Welcome to STEER.' }).count(), 1);
      });
      await check('actual Next.js scripts use fresh gateway nonces while forged inline scripts and handlers are blocked', async () => {
        const response = await page.goto(origin); assert.ok(response);
        const policy = (await response.allHeaders())['content-security-policy']!;
        const nonce = /'nonce-([A-Za-z0-9+/]{32})'/.exec(policy)?.[1]; assert.ok(nonce);
        assert.ok(!policy.includes('unsafe-inline')); assert.ok(!policy.includes('unsafe-eval'));
        const scripts = await page.locator('script').evaluateAll((elements) => elements.map((element) => (element as HTMLScriptElement).nonce));
        assert.ok(scripts.length > 0); assert.ok(scripts.every((value) => value === nonce));
        await page.waitForFunction(() => Array.isArray((window as unknown as { __next_f?: unknown }).__next_f));
        await page.addInitScript(() => {
          const state = window as unknown as { __steerCspViolations: string[] }; state.__steerCspViolations = [];
          document.addEventListener('securitypolicyviolation', (event) => { state.__steerCspViolations.push(event.effectiveDirective); });
        });
        injectCspProbe = true;
        try {
          await page.reload(); await page.locator('#synthetic-csp-handler').click();
          await page.waitForFunction(() => {
          const events = (window as unknown as { __steerCspViolations: string[] }).__steerCspViolations;
          return events.includes('script-src-elem') && events.includes('script-src-attr');
          });
          assert.deepEqual(await page.evaluate(() => {
          const state = window as unknown as { __steerUnsafeScript?: boolean; __steerUnsafeHandler?: boolean };
          return [Boolean(state.__steerUnsafeScript), Boolean(state.__steerUnsafeHandler)];
          }), [false, false]);
        } finally { injectCspProbe = false; }
        const next = await page.reload(); assert.ok(next);
        assert.notEqual(/'nonce-([A-Za-z0-9+/]{32})'/.exec((await next.allHeaders())['content-security-policy']!)?.[1], nonce);
      });
      await check('actual Next.js native sign-in page preserves responsive layout and keyboard access with nonce-controlled scripts', async () => {
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto(origin);
        const signIn = page.getByRole('button', { name: 'Sign in', exact: true });
        assert.equal(await signIn.isEnabled(), true);
        await page.keyboard.press('Tab'); assert.equal(await signIn.evaluate((element) => element === document.activeElement), true);
        const directory = process.env.STEER_UI_SCREENSHOT_DIR;
        if (directory) { await mkdir(directory, { recursive: true }); await page.screenshot({ path: join(directory, 'sign-in-desktop.png'), fullPage: true }); }
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.equal(await signIn.isVisible(), true);
        if (directory) await page.screenshot({ path: join(directory, 'sign-in-mobile.png'), fullPage: true });
        await page.setViewportSize({ width: 1440, height: 1000 });
      });
      await check('Next.js disables sign-in when public view configuration is absent and passes automated accessibility checks', async () => {
        const enabledWeb = web!;
        const disabledWeb = await createNextWebHarness(origin, issuer, false);
        try {
          web = disabledWeb; gateway = bindGateway(web.rendererOrigin); await page.goto(origin);
          assert.equal(await page.getByRole('button', { name: 'Sign in', exact: true }).isDisabled(), true);
          assert.equal(await page.locator('form').count(), 0);
        } finally { web = enabledWeb; gateway = bindGateway(web.rendererOrigin); await disabledWeb.close(); }
        await page.goto(origin);
        const axeSource = await readFile(new URL('../../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
        await page.evaluate((source) => { eval(source); }, axeSource);
        const violations = await page.evaluate(async () => {
          const axe = (window as unknown as { axe: { run: (node: Document, options: unknown) => Promise<{ violations: { id: string; impact: string }[] }> } }).axe;
          return (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(({ id, impact }) => ({ id, impact }));
        });
        assert.deepEqual(violations, []);
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
      await check('authenticated Next.js workspace shows verified context with responsive, keyboard and accessibility checks', async () => {
        assert.equal(await page.getByRole('heading', { name: 'Your workspace.', exact: true }).count(), 1);
        assert.equal(await page.getByTestId('session-organization').textContent(), 'synthetic-org');
        assert.equal(await page.getByTestId('session-subject').textContent(), deps.subject);
        assert.equal(await page.getByText('Product Lead', { exact: true }).count(), 1);
        assert.equal(await page.getByText('Not connected yet', { exact: true }).count(), 3);
        const session = await storage.firstSession(); assert.ok(session);
        assert.ok(!(await page.content()).includes(session.accessToken));
        await page.keyboard.press('Tab');
        assert.equal(await page.getByRole('button', { name: 'Sign out', exact: true }).evaluate((element) => element === document.activeElement), true);
        const directory = process.env.STEER_WORKSPACE_SCREENSHOT_DIR;
        if (directory) { await mkdir(directory, { recursive: true }); await page.screenshot({ path: join(directory, 'workspace-desktop.png'), fullPage: true }); }
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        if (directory) await page.screenshot({ path: join(directory, 'workspace-mobile.png'), fullPage: true });
        await page.setViewportSize({ width: 1440, height: 1000 });
        const axeSource = await readFile(new URL('../../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
        await page.evaluate((source) => { eval(source); }, axeSource);
        const violations = await page.evaluate(async () => {
          const axe = (window as unknown as { axe: { run: (node: Document, options: unknown) => Promise<{ violations: { id: string; impact: string }[] }> } }).axe;
          return (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(({ id, impact }) => ({ id, impact }));
        });
        assert.deepEqual(violations, []);
      });
      await check('hydrated reference panel loads real data, clears on committed grant denial, and rejects foreign scope', async () => {
        const panel = page.getByRole('region', { name: 'Repository references' });
        const input = panel.getByLabel('Repository scope ID');
        await input.fill(projection.input.repository);
        await page.keyboard.press('Tab');
        assert.equal(await panel.getByRole('button', { name: 'Load references', exact: true }).evaluate((element) => element === document.activeElement), true);
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.querySelector('[data-testid="reference-status"]')?.textContent?.startsWith('References loaded.'));
        assert.equal(await panel.getByTestId('reference-list').locator('li').count(), 2);
        assert.ok((await panel.textContent())?.includes(projection.input.revision));
        await source.publish([{ ...grant, toolGrants: ['session.context'] }]);
        await panel.getByRole('button', { name: 'Refresh references', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-testid="reference-status"]')?.textContent?.startsWith('References could not be verified.'));
        assert.equal(await panel.getByTestId('reference-list').count(), 0);
        await source.publish([grant]);
        await panel.getByRole('button', { name: 'Refresh references', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-testid="reference-status"]')?.textContent?.startsWith('References loaded.'));
        assert.equal(await panel.getByTestId('reference-list').locator('li').count(), 2);
        const directory = process.env.STEER_WORKSPACE_SCREENSHOT_DIR;
        if (directory) await page.screenshot({ path: join(directory, 'references-desktop.png'), fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        if (directory) await page.screenshot({ path: join(directory, 'references-mobile.png'), fullPage: true });
        await page.setViewportSize({ width: 1440, height: 1000 });
        const violations = await page.evaluate(async () => {
          const axe = (window as unknown as { axe: { run: (node: Document, options: unknown) => Promise<{ violations: { id: string; impact: string }[] }> } }).axe;
          return (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(({ id, impact }) => ({ id, impact }));
        });
        assert.deepEqual(violations, []);
        await input.fill('foreign/repository'); assert.equal(await panel.getByTestId('reference-list').count(), 0);
        await panel.getByRole('button', { name: 'Load references', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-testid="reference-status"]')?.textContent?.startsWith('References could not be verified.'));
        assert.equal(await panel.getByTestId('reference-list').count(), 0);
        await panel.getByRole('button', { name: 'Clear references', exact: true }).click();
        assert.equal(await panel.getByRole('button', { name: 'Refresh references', exact: true }).isDisabled(), true);
        assert.deepEqual(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)]), [[], []]);
      });
      await check('reference panel clears on page lifecycle and local session expiry without automatic reload or polling', async () => {
        const panel = page.getByRole('region', { name: 'Repository references' });
        await panel.getByLabel('Repository scope ID').fill(projection.input.repository);
        await panel.getByRole('button', { name: 'Load references', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-testid="reference-status"]')?.textContent?.startsWith('References loaded.'));
        // Explicit lifecycle dispatch covers the cleanup handler, not an assertion of browser BFCache eligibility.
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
        assert.equal(await panel.getByTestId('reference-list').count(), 0);
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
        assert.equal(await panel.getByRole('button', { name: 'Refresh references', exact: true }).isDisabled(), true);
        // Keep browser-only clock manipulation isolated from later authentication cases.
        const expiryPage = await context.newPage();
        try {
          let requests = 0; expiryPage.on('request', (request) => { if (new URL(request.url()).pathname.startsWith('/v1/tools/projection.')) requests++; });
          await expiryPage.clock.install(); await expiryPage.goto(origin);
          const expiryPanel = expiryPage.getByRole('region', { name: 'Repository references' });
          await expiryPanel.getByLabel('Repository scope ID').fill(projection.input.repository);
          await expiryPanel.getByRole('button', { name: 'Load references', exact: true }).click();
          await expiryPage.waitForFunction(() => document.querySelector('[data-testid="reference-status"]')?.textContent?.startsWith('References loaded.'));
          const beforeExpiry = requests;
          await expiryPage.clock.fastForward(310000);
          assert.equal(await expiryPanel.getByTestId('reference-list').count(), 0);
          assert.equal(await expiryPanel.getByRole('button', { name: 'Load references', exact: true }).isDisabled(), true);
          assert.match((await expiryPanel.getByTestId('reference-status').textContent())!, /Session display expired/);
          assert.equal(requests, beforeExpiry, 'Display expiry must not poll or reload references');
        } finally { await expiryPage.close(); }
      });
      await check('browser reads only its granted exact-revision projection ingested from actual synthetic Git through PostgreSQL', async () => {
        const read = (input: typeof projection.input) => page.evaluate(async (value) => {
          const response = await fetch('/v1/tools/projection.artifact.read', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
          return { status: response.status, data: await response.json() };
        }, input);
        const result = await read(projection.input); assert.equal(result.status, 200); assert.equal(result.data.kind, 'projection');
        assert.equal(result.data.content, (await source.reader.readArtifact(source.artifactPath, projection.input.revision)).content);
        assert.equal((await read({ ...projection.input, organizationId: 'foreign-org' })).status, 403);
        assert.equal((await read({ ...projection.input, path: source.authorizationPath })).status, 403);
        assert.equal((await read({ ...projection.input, revision: '0'.repeat(40) })).data, null);
        await source.publish([{ ...grant, toolGrants: ['session.context'] }]); assert.equal((await read(projection.input)).status, 403);
        await source.publish([grant]); assert.equal((await read(projection.input)).status, 200);
      });
      await check('authenticated browser resumes actual projection changes and observes scope, reset and current Git grant denial', async () => {
        const input: ProjectionChangesInput = { organizationId: projection.input.organizationId, repository: projection.input.repository, cursor: null, limit: 1 };
        const read = (value: ProjectionChangesInput) => page.evaluate(async (args) => {
          const response = await fetch('/v1/tools/projection.changes.read', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args) });
          return { status: response.status, data: await response.json() };
        }, value);
        const first = await read(input); assert.equal(first.status, 200); assert.equal(first.data.outcome, 'page');
        assert.equal(first.data.events.length, 1); assert.equal(first.data.snapshotRequired, true); assert.equal(first.data.hasMore, true);
        const next = { ...input, cursor: first.data.cursor, limit: 100 };
        const remaining = await read(next); assert.equal(remaining.status, 200); assert.equal(remaining.data.events.length, 3);
        assert.equal(remaining.data.snapshotRequired, false); assert.equal(remaining.data.hasMore, false);
        assert.deepEqual((await read({ ...next, cursor: remaining.data.cursor })).data.events, []);
        assert.equal((await read({ ...next, organizationId: 'foreign' })).status, 403);
        assert.equal((await read({ ...next, cursor: { ...next.cursor, repository: 'foreign' } })).status, 403);
        const reset = await read({ ...next, cursor: { ...next.cursor, generation: '00000000-0000-4000-8000-000000000000' } });
        assert.equal(reset.status, 200); assert.equal(reset.data.outcome, 'reset-required'); assert.equal('events' in reset.data, false);
        await source.publish([{ ...grant, toolGrants: ['session.context'] }]); assert.equal((await read(next)).status, 403);
        await source.publish([grant]); assert.equal((await read(next)).status, 200);
      });
      await check('browser obtains coherent snapshot and resumes its cursor without replaying historical projection repairs', async () => {
        const input = { organizationId: projection.input.organizationId, repository: projection.input.repository };
        const read = (value = input) => page.evaluate(async (args) => {
          const response = await fetch('/v1/tools/projection.snapshot.read', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args) });
          return { status: response.status, data: await response.json() };
        }, value);
        const snapshot = await read(); assert.equal(snapshot.status, 200); assert.equal(snapshot.data.records.length, 2);
        assert.equal(snapshot.data.cursor.position, '4');
        const resumed = await page.evaluate(async (args) => {
          const response = await fetch('/v1/tools/projection.changes.read', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args) });
          return { status: response.status, data: await response.json() };
        }, { ...input, cursor: snapshot.data.cursor, limit: 100 });
        assert.equal(resumed.status, 200); assert.deepEqual(resumed.data.events, []); assert.equal(resumed.data.snapshotRequired, false);
        assert.equal((await read({ ...input, repository: 'foreign' })).status, 403);
        await source.publish([{ ...grant, toolGrants: ['session.context', 'projection.changes.read'] }]); assert.equal((await read()).status, 403);
        await source.publish([grant]); assert.equal((await read()).status, 200);
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
        await page.reload(); assert.equal(await page.getByRole('heading', { name: 'Welcome to STEER.' }).count(), 1);
        assert.equal(await page.getByTestId('session-subject').count(), 0);
        await source.publish([grant]); assert.equal((await tool()).status, 200);
        await page.reload(); assert.equal(await page.getByTestId('session-subject').textContent(), deps.subject);
      });
      await check('Git source outage, moving head and digest failure deny existing browser sessions without stale fallback', async () => {
        for (const fault of ['unavailable', 'moving-head', 'digest'] as const) {
          source.setFault(fault); assert.equal((await tool()).status, 401);
          await page.reload(); assert.equal(await page.getByTestId('session-subject').count(), 0);
          source.setFault('none'); assert.equal((await tool()).status, 200);
          await page.reload(); assert.equal(await page.getByTestId('session-subject').textContent(), deps.subject);
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
        await page.waitForURL(`${origin}/`, { waitUntil: 'load' });
        const afterLogout = await tool();
        assert.equal(afterLogout.status, 401);
        assert.equal((await storage.counts()).sessions, 0);
        assert.equal((await context.cookies(origin)).filter((cookie) => cookie.name.startsWith('__Host-steer-')).length, 0);
      });
      await check('composed identity services stop admission and confirm request/resource shutdown in the actual browser', async () => {
        await Promise.all(services.map((service) => service.shutdown()));
        for (const service of services) assert.deepEqual(service.status(), { state: 'stopped', activeRequests: 0,
          mcp: { stopping: true, active: 0, cleanupFailed: false } });
        assert.equal((await tool()).status, 503);
        assert.throws(() => storage.freshStore(), /Synthetic runtime resources are closed/);
        assert.deepEqual(await storage.counts(), { transactions: 0, sessions: 0 });
      });
      await check('production-source HTTPS listener completes owned shutdown and rejects new browser connections', async () => {
        assert.equal(applicationListener!.status().state, 'running');
        const stopped = applicationListener!.shutdown(); assert.equal(applicationListener!.shutdown(), stopped);
        await stopped;
        assert.deepEqual(applicationListener!.status(), { state: 'stopped', activeRequests: 0, forcedConnections: false, listening: false });
        await assert.rejects(page.goto(origin), /ERR_CONNECTION_REFUSED/);
      });
      console.log(`Browser authentication engine: Chromium ${browser.version()}; isolated profile, synthetic identities only.`);
      await context.close();
    } };
  } catch { await close(); throw new Error('Browser authentication fixture initialization failed; details omitted.'); }
}
