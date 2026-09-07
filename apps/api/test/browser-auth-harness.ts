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
import { createOidcAuthenticator, type AuthorizationRecord } from '@steer/adapters/identity';
import { createGitAuthorizationResolver } from '@steer/adapters/authorization';
import { createIdentityService } from '../src/identity-service.ts';
import { createIdentityGateway } from '../src/identity-gateway.ts';
import { startLocalIdentityListener } from '../src/identity-listener.ts';
import { reserveLocalPort } from './local-tls-harness.ts';
import { createGitAuthorizationHarness } from './git-authorization-harness.ts';
import { createNextWebHarness } from './next-web-harness.ts';
import { runHeldBrowserJourney } from './held-browser-harness.ts';
import { createNativeGitHubReadHarness } from './native-github-read-harness.ts';
import { createNativeGitHubCreateHarness } from './native-github-create-harness.ts';
import { seedBriefMarker } from './brief-marker-harness.ts';
import { createAppJwtSigner, createGitHubReader } from '@steer/adapters/github';
import { createGitHubBriefWriterFactory } from '@steer/adapters/github-brief-writer-factory';
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
      agent: { bearer: string; clientId: string; grant: AuthorizationRecord; issueBearer: () => Promise<string> };
      projector: { subject: string; clientId: string; issueBearer: () => Promise<string> };
      recovery?: { subject: string; clientId: string; issueBearer: () => Promise<string> };
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
        hats: ['product-lead'], toolGrants: ['session.context', 'projection.artifact.read', 'projection.changes.read', 'projection.snapshot.read', 'intent.brief.read', 'intent.brief.catalog', 'intent.brief.decisions', 'intent.brief.decision.evidence', 'intent.brief.preview', 'intent.brief.destination', 'intent.brief.save.status'], active: true,
        validAfter: new Date(0).toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString() };
      const source = await createGitAuthorizationHarness(tls.temporary, grant, 'canonical');
      assert.ok(storage.createProjectionFixture);
      const projection = await storage.createProjectionFixture(source.reader, [source.artifactPath, source.secondArtifactPath]);
      const receiptProjectionEvents: { recordKey: string; sourceRevision: string; contentDigest: string }[] = [];
      assert.equal(projection.input.path, 'items/0125-synthetic-outcome/BRIEF.md');
      await source.publish([grant, deps.agent.grant]);
      assert.ok(storage.shutdown);
      const dependencies = { fetch: deps.fetch, reader: source.reader, authorizationPath: source.authorizationPath, services: projection.services,
        mcp: { clientIds: [deps.agent.clientId] },
        sessions: { store: storage.store, binding: { issuer, clientId: configuration.clientId, redirectUri: configuration.redirectUri }, shutdown: storage.shutdown } };
      api = createIdentityService(configuration, dependencies);
      let injectCspProbe = false;
      const bindGateway = (rendererOrigin: string, identity: { fetch: (request: Request) => Promise<Response> } = { fetch: (request) => api!.fetch(request) }) => createIdentityGateway({ publicOrigin: origin, rendererOrigin, issuer,
        workspace: { organizationId: projection.input.organizationId, repository: projection.input.repository } },
        { identity, fetch: async (input, init) => {
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
          const actual = (result.structuredContent as { result: { content: string; contentDigest: string } }).result;
          assert.equal(actual.content, (await source.reader.readArtifact(projection.input.path, projection.input.revision)).content);
          const catalog = await client.callTool({ name: 'intent.brief.catalog', arguments: { organizationId: projection.input.organizationId, repository: projection.input.repository } });
          assert.ok(!catalog.isError);
          const references = (catalog.structuredContent as { result: { records: { path: string; revision: string; contentDigest: string }[] } }).result.records;
          assert.deepEqual(references, [{ path: projection.input.path, revision: projection.input.revision, contentDigest: actual.contentDigest }]);
          const brief = await client.callTool({ name: 'intent.brief.read', arguments: { organizationId: projection.input.organizationId, repository: projection.input.repository, ...references[0] } });
          assert.ok(!brief.isError);
          const briefResult = (brief.structuredContent as { result: { kind: string; content: string; document: { title: string } } }).result;
          assert.equal(briefResult.kind, 'brief-projection'); assert.equal(briefResult.content, actual.content);
          assert.equal(briefResult.document.title, 'Synthetic scoped outcome');
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
      await check('production authoring previews incomplete facts, corrects exact bytes and keeps source links inert', async () => {
        let authorStage = 'initial answer'; let previewStatus: number | null = null;
        const observePreview = (response: import('playwright').Response) => { if (new URL(response.url()).pathname === '/v1/tools/intent.brief.preview') previewStatus = response.status(); };
        page.on('response', observePreview);
        try {
        const author = page.getByRole('region', { name: 'Start with your intent.' });
        assert.deepEqual(await author.evaluate((element) => {
          const ids = [...element.querySelectorAll('[id]')].map((node) => node.id);
          return ids.filter((id, index) => ids.indexOf(id) !== index);
        }), []);
        await author.getByLabel('Working title', { exact: true }).fill('A clearer intake');
        authorStage = 'keyboard preview';
        await author.getByRole('button', { name: 'Preview Brief', exact: true }).focus(); await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.querySelector('[data-testid="author-status"]')?.textContent?.startsWith('Preview ready.'));
        authorStage = 'preview focus and missing fields';
        assert.equal(await author.getByRole('heading', { name: 'Your draft preview' }).evaluate((element) => element === document.activeElement), true);
        assert.equal(await author.getByRole('heading', { name: 'Still to clarify' }).count(), 1);
        const firstDigest = await author.getByTestId('author-digest').textContent();
        authorStage = 'correction focus';
        await author.getByRole('button', { name: 'Correct the facts' }).click();
        assert.equal(await author.getByLabel('What is happening now?', { exact: true }).evaluate((element) => element === document.activeElement), true);
        await author.getByLabel('What is happening now?', { exact: true }).fill('Requests are duplicated. [Source](https://outside.invalid)');
        assert.equal(await author.getByTestId('author-digest').count(), 0);
        await author.getByRole('button', { name: 'Next question', exact: true }).click();
        await author.getByLabel('What should become true?', { exact: true }).fill('Every request is entered once.');
        await author.getByRole('button', { name: 'Next question', exact: true }).click();
        await author.getByLabel('Who is affected?', { exact: true }).fill('Coordinators');
        await author.getByRole('button', { name: 'Next question', exact: true }).click();
        await author.getByLabel('Which systems are involved?', { exact: true }).fill('Unverified intake system');
        await author.getByRole('button', { name: 'Next question', exact: true }).click();
        await author.getByLabel('How will you know it worked?', { exact: true }).fill('Count duplicates');
        authorStage = 'corrected preview';
        await author.getByRole('button', { name: 'Preview Brief', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-testid="author-status"]')?.textContent?.startsWith('Preview ready.'));
        assert.notEqual(await author.getByTestId('author-digest').textContent(), firstDigest);
        assert.equal(await author.getByRole('heading', { name: 'Still to clarify' }).count(), 0);
        assert.equal(await author.getByRole('link').count(), 0);
        assert.equal(await author.getByText('Server preview · Not saved · Not signed', { exact: true }).count(), 1);
        authorStage = 'screenshots and mobile';
        const directory = process.env.STEER_WORKSPACE_SCREENSHOT_DIR;
        if (directory) await author.screenshot({ path: join(directory, 'author-desktop.png') });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        if (directory) await author.screenshot({ path: join(directory, 'author-mobile.png') });
        await page.setViewportSize({ width: 1440, height: 1000 });
        authorStage = 'accessibility and storage';
        const violations = await page.evaluate(async () => {
          const axe = (window as unknown as { axe: { run: (node: Document, options: unknown) => Promise<{ violations: { id: string }[] }> } }).axe;
          return (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(({ id }) => id);
        });
        assert.deepEqual(violations, []);
        assert.deepEqual(await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) })), { local: [], session: [] });
        } catch {
          console.error(`Author UI check failed at ${authorStage}; preview HTTP status ${previewStatus ?? 'not observed'}. Payloads omitted.`);
          const directory = process.env.STEER_WORKSPACE_SCREENSHOT_DIR;
          if (directory) await page.screenshot({ path: join(directory, 'author-failure.png'), fullPage: true });
          throw new Error('Synthetic author UI check failed.');
        } finally { page.off('response', observePreview); }
      });
      await check('destination UI uses the actual runtime profile, Keycloak session, encrypted PostgreSQL and native Git reader', async () => {
        assert.ok(storage.createDestinationRuntime);
        const provider = createNativeGitHubReadHarness(source, tls.certificate);
        const create = () => storage.createDestinationRuntime!(configuration, source.reader.binding, [source.artifactPath],
          tls.key.toString('utf8'), { identity: deps.fetch, github: provider.transport });
        let runtime = await create();
        const author = page.getByRole('region', { name: 'Start with your intent.' });
        const panel = page.getByRole('region', { name: 'Where this Brief could go' });
        const answers = await author.getByRole('list', { name: 'Your answers so far' }).innerText();
        const digest = await author.getByTestId('author-digest').textContent();
        let stage = 'first observation'; let httpStatus: number | undefined;
        const checkDestination = async (expectedStatus: number) => {
          const response = page.waitForResponse(value => value.url() === `${origin}/v1/tools/intent.brief.destination`);
          await panel.getByRole('button', { name: 'Check destination', exact: true }).click();
          const result = await response; httpStatus = result.status(); assert.equal(httpStatus, expectedStatus);
          if (expectedStatus === 200) {
            const value = await result.json();
            assert.equal(value.observedHead, await source.reader.readHead());
            assert.equal(value.writeAuthorized, false); assert.equal(value.gateVerified, false);
            await panel.locator('.destination-details').waitFor();
            assert.equal(await panel.getByText(value.observedHead, { exact: true }).count(), 1);
            assert.equal(await panel.getByText('github:1', { exact: true }).count(), 1);
            assert.equal(await panel.getByText('synthetic', { exact: true }).count(), 1);
            assert.deepEqual(value.paths, [source.artifactPath]);
            return value.observedHead as string;
          }
          await page.waitForFunction(() => document.querySelector('[data-testid="destination-status"]')?.textContent?.startsWith('Destination unavailable.'));
          assert.equal(await panel.locator('.destination-details').count(), 0);
          return null;
        };
        try {
          gateway = bindGateway(web!.rendererOrigin, runtime);
          assert.equal(runtime.status().database.connections, 0);
          const first = await checkDestination(200);
          stage = 'path disclosure';
          await panel.getByText('Configured Brief paths (1)', { exact: true }).click();
          assert.equal(await panel.locator('.destination-details code').filter({ hasText: source.artifactPath }).isVisible(), true);
          stage = 'local exact-content confirmation';
          const review = panel.getByRole('region', { name: 'Review this exact draft' });
          await review.getByLabel('Brief path to review', { exact: true }).selectOption(source.artifactPath);
          assert.equal(await review.getByTestId('review-selected-path').textContent(), source.artifactPath);
          await review.getByRole('checkbox').focus(); await page.keyboard.press('Space');
          assert.equal(await review.getByRole('checkbox').isChecked(), true);
          assert.ok((await review.getByTestId('brief-review-status').textContent())?.startsWith('Reviewed locally'));
          assert.equal(await review.getByRole('button', { name: 'Save Brief to GitHub — unavailable', exact: true }).isDisabled(), true);
          stage = 'runtime reconstruction';
          await runtime.shutdown(); assert.equal(runtime.status().database.closed, true);
          await source.publish([grant]); runtime = await create(); gateway = bindGateway(web!.rendererOrigin, runtime);
          assert.notEqual(await checkDestination(200), first);
          assert.equal(await review.getByLabel('Brief path to review', { exact: true }).inputValue(), '');
          assert.equal(await review.getByRole('checkbox').count(), 0);
          stage = 'grant denial';
          await source.publish([{ ...grant, toolGrants: grant.toolGrants.filter(name => name !== 'intent.brief.destination') }]);
          await checkDestination(403);
          stage = 'grant restoration';
          await source.publish([grant]); await checkDestination(200);
          stage = 'real held status endpoint';
          await review.getByLabel('Brief path to review', { exact: true }).selectOption(source.artifactPath);
          await review.getByText('Check a previous save operation', { exact: true }).click();
          const operation = '12345678-1234-4123-8123-123456789012';
          await review.getByLabel('Previous operation ID', { exact: true }).fill(operation);
          const statusUrl = `${origin}/v1/tools/intent.brief.save.status`;
          const deniedStatus = page.waitForResponse(value => value.url() === statusUrl);
          await review.getByRole('button', { name: 'Check save status', exact: true }).click();
          assert.equal((await deniedStatus).status(), 503);
          await page.waitForFunction(() => document.querySelector('[data-testid="save-operation-status"]')?.textContent?.startsWith('Save status could not be verified.'));
          assert.equal(await review.getByTestId('save-operation-receipt').count(), 0);
          stage = 'explicit browser-only receipt fixtures';
          // These intercepted replies verify frontend presentation only, not real
          // provider persistence or authority. The actual runtime stays writer-less.
          let outcome = 'unknown', statusReads = 0, saveRequests = 0;
          const observeSave = (request: import('playwright').Request) => { if (request.url() === `${origin}/v1/tools/intent.brief.save`) saveRequests++; };
          page.on('request', observeSave);
          await page.route(statusUrl, async route => {
            statusReads++;
            assert.deepEqual(route.request().postDataJSON(), { organizationId: grant.organizationId, repository: 'github:1', branch: 'synthetic', path: source.artifactPath, idempotencyKey: operation });
            const result = { organizationId: grant.organizationId, repository: 'github:1', branch: 'synthetic', path: source.artifactPath, idempotencyKey: operation, subject: deps.subject, outcome,
              ...(outcome === 'pending' || outcome === 'committed' ? { requestDigest: 'd'.repeat(64) } : {}),
              ...(outcome === 'committed' ? { expectedHead: 'a'.repeat(40), revision: 'b'.repeat(40), blobSha: 'c'.repeat(40), contentDigest: 'e'.repeat(64) } : {}) };
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result, gateSigned: false }) });
          });
          try {
            for (const [next, message] of [['not-found', 'No operation marker found.'], ['unknown', 'Save outcome is unknown.'],
              ['pending', 'An operation is pending.'], ['conflict', 'The operation conflicts'], ['committed', 'A recorded save was found']]) {
              outcome = next!;
              await review.getByRole('button', { name: 'Check save status', exact: true }).click();
              await page.waitForFunction(text => document.querySelector('[data-testid="save-operation-status"]')?.textContent?.startsWith(text!), message);
            }
            assert.equal(statusReads, 5); assert.equal(saveRequests, 0);
            assert.equal(await review.getByTestId('save-operation-receipt').getByText('b'.repeat(40), { exact: true }).count(), 1);
            assert.equal(await review.getByRole('button', { name: 'Save Brief to GitHub — unavailable', exact: true }).isDisabled(), true);
            const directory = process.env.STEER_WORKSPACE_SCREENSHOT_DIR;
            if (directory) await review.screenshot({ path: join(directory, 'review-desktop.png') });
            await page.setViewportSize({ width: 390, height: 844 });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            if (directory) await review.screenshot({ path: join(directory, 'review-mobile.png') });
            await page.setViewportSize({ width: 1440, height: 1000 });
            const violations = await page.evaluate(async () => {
              const axe = (window as unknown as { axe: { run: (node: Document, options: unknown) => Promise<{ violations: { id: string }[] }> } }).axe;
              return (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(({ id }) => id);
            });
            assert.deepEqual(violations, []);
            await review.getByLabel('Previous operation ID', { exact: true }).fill('invalid');
            assert.equal(await review.getByTestId('save-operation-receipt').count(), 0);
            assert.equal(await review.getByRole('button', { name: 'Check save status', exact: true }).isDisabled(), true);
          } finally { await page.unroute(statusUrl); page.off('request', observeSave); }
          stage = 'real display expiry';
          // Use real elapsed time: no browser clock, token or ingress-limit override.
          await panel.locator('.destination-details').waitFor({ state: 'detached', timeout: 20000 });
          assert.ok((await panel.getByTestId('destination-status').textContent())?.startsWith('Destination details cleared.'));
          stage = 'draft and boundary preservation';
          assert.equal(await author.getByRole('list', { name: 'Your answers so far' }).innerText(), answers);
          assert.equal(await author.getByTestId('author-digest').textContent(), digest);
          assert.deepEqual(await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) })), { local: [], session: [] });
          assert.equal((await runtime.fetch(new Request(`${origin}/health/ready`))).status, 503);
          assert.ok(provider.stats().assertions >= 2); assert.ok(provider.stats().reads > 0);
        } catch {
          console.error(`Destination UI check failed at ${stage}; HTTP ${httpStatus ?? 'not observed'}; ${JSON.stringify(provider.stats())}. Payloads omitted.`);
          throw new Error('Synthetic destination UI check failed.');
        } finally {
          gateway = bindGateway(web!.rendererOrigin);
          try { await runtime.shutdown(); } finally { await source.publish([grant, deps.agent.grant]); }
        }
      });
      await check('held saving crosses real browser and Keycloak sessions with exact policy selection but no Git mutation', async () => {
        try { await runHeldBrowserJourney({ browser: browser!, origin, configuration, username: deps.username, password: deps.password,
          subject: deps.subject, identity: deps.fetch, storage, agent: deps.agent, install: (renderer, runtime) => { gateway = bindGateway(renderer, runtime); } }); }
        finally { gateway = bindGateway(web!.rendererOrigin); }
      });
      await check('browser status reads actual native Git operation history through request-owned writers and Keycloak sessions', async () => {
        const seeded = await seedBriefMarker(source, deps.subject);
        const provider = createNativeGitHubReadHarness(source, tls.certificate);
        const appJwt = createAppJwtSigner('1', tls.key.toString('utf8'));
        assert.ok(storage.createReceiptProjection);
        const { subject: _receiptSubject, ...statusInput } = seeded.reference;
        const recordedProjection = await storage.createReceiptProjection(createGitHubReader(source.reader.binding, { fetch: provider.transport, appJwt }), seeded.reference.path, seeded.receipt.revision, async () => {
          // Same authenticated browser-context cookies, actual gateway/service/store;
          // the projector's service identity is never substituted for this human.
          const response = await page.evaluate(async input => {
            const result = await fetch('/v1/tools/intent.brief.save.status', { method: 'POST', credentials: 'same-origin',
              headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
            return { status: result.status, body: await result.json() };
          }, statusInput);
          assert.equal(response.status, 200); const observed = response.body;
          assert.deepEqual(observed, { result: seeded.receipt, gateSigned: false }); return observed;
        });
        const recordedKey = `artifact:${createHash('sha256').update(JSON.stringify([seeded.reference.repository, seeded.reference.path])).digest('hex')}`;
        const factory = createGitHubBriefWriterFactory(source.reader.binding, {
          organizationId: grant.organizationId, repository: 'github:1', branch: 'synthetic', paths: [seeded.reference.path],
          platformRevision: seeded.receipt.expectedHead, gate2DecisionDigest: 'f'.repeat(64),
        }, { issuer, authorizationPath: source.authorizationPath, fetch: provider.transport, appJwt,
          verifyGateAuthority: async () => { throw new Error('Synthetic readback never authorizes saving.'); } });
        let created = 0, closed = 0;
        const compose = () => createIdentityService(configuration, { ...dependencies,
          // These composed services share the existing encrypted store. They own
          // their request writers, not the parent harness's PostgreSQL lifecycle.
          sessions: { ...dependencies.sessions, shutdown: async () => {} },
          services: { ...projection.services, ...recordedProjection.services, briefDestination: { scope: { organizationId: grant.organizationId, repository: 'github:1',
            branch: 'synthetic', paths: [seeded.reference.path] }, readHead: () => source.reader.readHead() } },
          createBriefWriter: authenticate => {
            const writer = factory(authenticate); created++; let stopped = false;
            return { ...writer, compareAndCreate: async () => { throw new Error('Read-only fixture.'); },
              close: () => { if (!stopped) { stopped = true; closed++; } writer.close(); } };
          },
        });
        let service = compose();
        const author = page.getByRole('region', { name: 'Start with your intent.' });
        const panel = page.getByRole('region', { name: 'Where this Brief could go' });
        const review = panel.getByRole('region', { name: 'Review this exact draft' });
        const originalDigest = await author.getByTestId('author-digest').textContent();
        const originalAnswers = await author.getByRole('list', { name: 'Your answers so far' }).innerText();
        let stage = 'first native receipt';
        const destination = async () => {
          await panel.getByRole('button', { name: 'Check destination', exact: true }).click();
          await review.getByLabel('Brief path to review', { exact: true }).selectOption(seeded.reference.path);
          await review.getByText('Check a previous save operation', { exact: true }).click();
        };
        const readStatus = async (operation: string, expectedStatus = 200) => {
          await review.getByLabel('Previous operation ID', { exact: true }).fill(operation);
          const response = page.waitForResponse(value => value.url() === `${origin}/v1/tools/intent.brief.save.status`);
          await review.getByRole('button', { name: 'Check save status', exact: true }).click();
          const result = await response; assert.equal(result.status(), expectedStatus);
          if (expectedStatus !== 200) {
            await page.waitForFunction(() => document.querySelector('[data-testid="save-operation-status"]')?.textContent?.startsWith('Save status could not be verified.'));
            assert.equal(await review.getByTestId('save-operation-receipt').count(), 0); return null;
          }
          const value = await result.json(); assert.equal(value.gateSigned, false); return value.result;
        };
        try {
          gateway = bindGateway(web!.rendererOrigin, service); await destination();
          assert.deepEqual(await readStatus(seeded.reference.idempotencyKey), seeded.receipt);
          await recordedProjection.project();
          receiptProjectionEvents.push({ recordKey: recordedKey, sourceRevision: seeded.receipt.revision, contentDigest: seeded.receipt.contentDigest });
          await review.getByTestId('save-operation-receipt').waitFor();
          assert.equal(await review.getByTestId('save-operation-receipt').getByText(seeded.receipt.revision, { exact: true }).count(), 1);
          assert.notEqual(seeded.receipt.contentDigest, originalDigest);
          assert.ok((await review.getByTestId('save-operation-status').textContent())?.includes('does not confirm the current draft'));
          stage = 'real operation absence';
          assert.equal((await readStatus('15600000-0000-4000-8000-000000000002'))?.outcome, 'not-found');
          stage = 'service reconstruction and later branch head';
          await service.shutdown(); assert.equal(created, closed); await source.publish([grant, deps.agent.grant]);
          service = compose(); gateway = bindGateway(web!.rendererOrigin, service); await destination();
          assert.deepEqual(await readStatus(seeded.reference.idempotencyKey), seeded.receipt);
          stage = 'current status grant denial';
          await source.publish([{ ...grant, toolGrants: grant.toolGrants.filter(value => value !== 'intent.brief.save.status') }, deps.agent.grant]);
          const beforeDenied = provider.stats().reads;
          await readStatus(seeded.reference.idempotencyKey, 403); assert.equal(provider.stats().reads, beforeDenied);
          await assert.rejects(recordedProjection.project()); assert.equal(provider.stats().reads, beforeDenied);
          stage = 'grant restoration';
          await source.publish([grant, deps.agent.grant]); await destination();
          assert.deepEqual(await readStatus(seeded.reference.idempotencyKey), seeded.receipt);
          assert.equal(created, closed); assert.ok(provider.stats().histories >= 4); assert.ok(provider.stats().comparisons >= 3);
          assert.equal(await author.getByTestId('author-digest').textContent(), originalDigest);
          assert.equal(await author.getByRole('list', { name: 'Your answers so far' }).innerText(), originalAnswers);
          assert.equal(await review.getByRole('button', { name: 'Save Brief to GitHub — unavailable', exact: true }).isDisabled(), true);
          assert.deepEqual(await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) })), { local: [], session: [] });
          stage = 'receipt to exact permitted Brief';
          const link = review.getByRole('link', { name: 'Read the recorded Brief', exact: true });
          const fragment = await link.getAttribute('href'); assert.ok(fragment && fragment.startsWith('#brief=v1&'));
          const params = new URLSearchParams(fragment.slice(1));
          assert.equal(params.get('revision'), seeded.receipt.revision); assert.equal(params.get('digest'), seeded.receipt.contentDigest);
          assert.equal(params.get('path'), seeded.reference.path); assert.equal(params.has('subject'), false); assert.equal(params.has('idempotencyKey'), false);
          const readResponse = page.waitForResponse(value => value.url() === `${origin}/v1/tools/intent.brief.read`);
          await link.focus(); await page.keyboard.press('Enter');
          const readValue = await readResponse; assert.equal(readValue.status(), 200);
          const loaded = await readValue.json(); assert.equal(loaded.content, seeded.content); assert.equal(loaded.revision, seeded.receipt.revision);
          const dialog = page.getByRole('dialog', { name: 'Disposable recorded operation', exact: true });
          await dialog.waitFor();
          assert.equal(await dialog.getByRole('button', { name: 'Close Brief', exact: true }).evaluate(element => element === document.activeElement), true);
          await page.keyboard.press('Escape');
          assert.equal(await link.evaluate(element => element === document.activeElement), true);
          stage = 'receipt cannot bypass current read permission';
          await source.publish([{ ...grant, toolGrants: grant.toolGrants.filter(value => value !== 'intent.brief.read') }, deps.agent.grant]);
          await link.click();
          await page.waitForFunction(() => document.querySelector('[data-testid="brief-status"]')?.textContent === 'Brief access could not be verified. Refresh access and try again.');
          assert.equal(await page.getByRole('dialog').count(), 0);
          await source.publish([grant, deps.agent.grant]);
          await page.getByRole('button', { name: 'Refresh Briefs', exact: true }).click(); await dialog.waitFor();
          await page.keyboard.press('Escape');
          stage = 'stale receipt never substitutes the latest projection';
          const advancedRevision = await source.reader.readHead();
          await recordedProjection.advance();
          receiptProjectionEvents.push({ recordKey: recordedKey, sourceRevision: advancedRevision, contentDigest: seeded.receipt.contentDigest });
          // A fresh destination/readback retains the original receipt even though
          // the permitted catalog now selects a later projection revision.
          await destination(); assert.deepEqual(await readStatus(seeded.reference.idempotencyKey), seeded.receipt);
          await review.getByRole('link', { name: 'Read the recorded Brief', exact: true }).click();
          await page.waitForFunction(() => document.querySelector('[data-testid="brief-status"]')?.textContent?.startsWith('This linked revision is not available'));
          assert.equal(await page.getByRole('dialog').count(), 0);
          assert.equal(await author.getByTestId('author-digest').textContent(), originalDigest);
          await page.evaluate(() => { history.replaceState(null, '', '/'); });
        } catch {
          console.error(`Native status UI check failed at ${stage}; ${JSON.stringify(provider.stats())}. Payloads omitted.`);
          throw new Error('Synthetic native status readback failed.');
        } finally { gateway = bindGateway(web!.rendererOrigin); await service.shutdown(); await recordedProjection.close(); await source.publish([grant, deps.agent.grant]); }
      });
      await check('authoring discards drafts after committed grant denial and navigation without automatic submission', async () => {
        const author = page.getByRole('region', { name: 'Start with your intent.' });
        await source.publish([{ ...grant, toolGrants: grant.toolGrants.filter((name) => name !== 'intent.brief.preview') }]);
        await author.getByRole('button', { name: 'Preview Brief', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-testid="author-status"]')?.textContent?.startsWith('Draft preview could not be verified.'));
        assert.equal(await author.getByTestId('author-digest').count(), 0);
        assert.equal(await author.getByLabel('Working title', { exact: true }).inputValue(), '');
        await source.publish([grant]);
        await author.getByLabel('Working title', { exact: true }).fill('Private unsaved draft');
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
        assert.equal(await author.getByLabel('Working title', { exact: true }).inputValue(), '');
        await page.reload();
        assert.equal(await author.getByLabel('Working title', { exact: true }).inputValue(), '');
      });
      await check('Brief library discovers without manual source entry and renders an inert revision-bound keyboard dialog', async () => {
        let briefStage = 'catalog discovery';
        try {
        const library = page.getByRole('region', { name: 'Brief library' });
        await page.waitForFunction(() => document.querySelector('[data-testid="brief-status"]')?.textContent?.startsWith('Choose a Brief'));
        assert.equal(await library.locator('input').count(), 0);
        assert.equal(await library.getByTestId('brief-catalog').locator('li').count(), 1);
        briefStage = 'revision-linked work list';
        const workList = library.getByRole('list', { name: 'Projected Brief work list', exact: true });
        assert.equal(await library.getByTestId('brief-work-count').innerText(), '1 projected Brief · Showing 1–1');
        assert.equal(await workList.locator('.brief-work-path').innerText(), projection.input.path);
        const selectedSource = await source.reader.readArtifact(projection.input.path, projection.input.revision);
        const revisionLink = workList.getByRole('link', { name: 'Open selected revision for Intent 0125-synthetic-outcome', exact: true });
        assert.equal(await revisionLink.innerText(), projection.input.revision);
        const referenceHref = await revisionLink.getAttribute('href'); assert.ok(referenceHref);
        const referenceParams = new URLSearchParams(referenceHref.slice(1));
        assert.equal(referenceParams.get('path'), projection.input.path); assert.equal(referenceParams.get('revision'), projection.input.revision);
        assert.equal(referenceParams.get('digest'), selectedSource.contentDigest); assert.equal(referenceParams.has('subject'), false);
        await workList.getByText('Content fingerprint', { exact: true }).click();
        assert.equal(await workList.locator('.brief-work-fingerprint code').innerText(), selectedSource.contentDigest);
        briefStage = 'exact source preview';
        const previewBrief = workList.getByRole('button', { name: 'Preview Intent 0125-synthetic-outcome', exact: true });
        const previewResponse = page.waitForResponse(value => value.url() === `${origin}/v1/tools/intent.brief.read`);
        await previewBrief.focus(); await page.keyboard.press('Enter');
        const previewRead = await previewResponse; assert.equal(previewRead.status(), 200);
        const previewInput = previewRead.request().postDataJSON();
        assert.equal(previewInput.path, projection.input.path); assert.equal(previewInput.revision, projection.input.revision);
        assert.equal(previewInput.contentDigest, selectedSource.contentDigest);
        const summary = library.getByRole('region', { name: 'Brief source summary' }); await summary.waitFor();
        assert.equal(await summary.getByRole('heading', { name: 'Synthetic scoped outcome', exact: true }).count(), 1);
        assert.ok((await summary.innerText()).includes('Scoped projection test.'));
        assert.equal(await summary.locator('script, img, a[href]').count(), 0);
        assert.equal(await page.getByRole('dialog').count(), 0); assert.equal(new URL(page.url()).hash, '');
        assert.equal(await previewBrief.getAttribute('aria-expanded'), 'true');
        const workDirectory = process.env.STEER_WORKSPACE_SCREENSHOT_DIR;
        if (workDirectory) await library.screenshot({ path: join(workDirectory, 'brief-work-list-desktop.png') });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await library.evaluate(element => element.scrollWidth <= element.clientWidth), true);
        if (workDirectory) await library.screenshot({ path: join(workDirectory, 'brief-work-list-mobile.png') });
        briefStage = 'enlarged work list';
        await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
        assert.equal(await workList.evaluate(element => element.scrollWidth <= element.clientWidth), true);
        await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
        await page.setViewportSize({ width: 1440, height: 1000 });
        briefStage = 'work list accessibility';
        const workAxeSource = await readFile(new URL('../../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
        await page.evaluate(source => { eval(source); }, workAxeSource);
        assert.deepEqual(await page.evaluate(async () => {
          const axe = (window as unknown as { axe: { run: (node: Document, options: unknown) => Promise<{ violations: { id: string; impact: string }[] }> } }).axe;
          return (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(({ id, impact }) => ({ id, impact }));
        }), []);
        briefStage = 'work list native link focus';
        await revisionLink.focus(); await page.keyboard.press('Enter');
        const linkedDetail = page.getByRole('dialog', { name: 'Synthetic scoped outcome' }); await linkedDetail.waitFor();
        assert.equal(await library.getByTestId('brief-source-summary').count(), 0);
        await page.keyboard.press('Escape'); assert.equal(await linkedDetail.count(), 0);
        assert.equal(await revisionLink.evaluate(element => element === document.activeElement), true);
        const button = library.getByRole('button', { name: 'Read Intent 0125-synthetic-outcome', exact: true });
        briefStage = 'selected source rendering';
        await button.focus(); await page.keyboard.press('Enter');
        const detail = page.getByRole('dialog', { name: 'Synthetic scoped outcome' }); await detail.waitFor();
        assert.equal(await detail.getByText('Scoped projection test.', { exact: true }).count(), 1);
        assert.equal(await detail.getByRole('heading', { name: 'Open questions', exact: true }).count(), 1);
        assert.deepEqual(await detail.locator('.brief-markdown h2').allTextContents(), ['Problem', 'Proposed outcome', 'Outcome contract',
          'Constraints', 'Domain tags', 'Affected users and systems', 'Open questions', 'Additional context']);
        assert.match((await detail.locator('.brief-reading-note').textContent())!, /sections arranged for review/);
        assert.equal(await detail.locator('script, img, a[href]').count(), 0);
        assert.equal(await page.evaluate(() => Boolean((window as unknown as { __steerBriefUnsafe?: boolean }).__steerBriefUnsafe)), false);
        briefStage = 'dialog keyboard containment';
        assert.equal(await detail.getByRole('button', { name: 'Close Brief' }).evaluate((element) => element === document.activeElement), true);
        await page.keyboard.press('Shift+Tab');
        assert.equal(await detail.evaluate((element) => element.contains(document.activeElement)), true);
        briefStage = 'source disclosure and responsive layout';
        await page.keyboard.press('Tab');
        assert.equal(await detail.evaluate((element) => element.contains(document.activeElement)), true);
        await detail.getByText('Source revision details', { exact: true }).click();
        assert.ok((await detail.textContent())?.includes(projection.input.revision));
        const directory = process.env.STEER_WORKSPACE_SCREENSHOT_DIR;
        await detail.locator('.brief-detail-body').evaluate((element) => { element.scrollTop = 0; });
        if (directory) await page.screenshot({ path: join(directory, 'brief-detail-desktop.png') });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.equal(await detail.evaluate((element) => element.scrollWidth <= element.clientWidth), true);
        assert.equal(await detail.locator('.brief-detail-body').evaluate((element) => element.scrollWidth <= element.clientWidth), true);
        await detail.locator('.brief-detail-body').evaluate((element) => { element.scrollTop = 0; });
        if (directory) await page.screenshot({ path: join(directory, 'brief-detail-mobile.png') });
        await detail.locator('.brief-detail-body').evaluate((element) => { element.scrollTop = element.scrollHeight; });
        assert.equal(await detail.locator('.brief-source code').last().evaluate((element) => {
          const body = element.closest('.brief-detail-body')!.getBoundingClientRect(); const target = element.getBoundingClientRect();
          return target.top >= body.top && target.bottom <= body.bottom;
        }), true);
        if (directory) await page.screenshot({ path: join(directory, 'brief-source-mobile.png') });
        // Earlier navigation checks replace the document, including injected test tooling.
        const briefAxeSource = await readFile(new URL('../../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
        await page.evaluate((source) => { eval(source); }, briefAxeSource);
        const violations = await page.evaluate(async () => {
          const axe = (window as unknown as { axe: { run: (node: Document, options: unknown) => Promise<{ violations: { id: string; impact: string }[] }> } }).axe;
          return (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(({ id, impact }) => ({ id, impact }));
        });
        assert.deepEqual(violations, []);
        briefStage = 'dialog dismissal and focus return';
        await page.keyboard.press('Escape'); assert.equal(await detail.count(), 0);
        assert.equal(await button.evaluate((element) => element === document.activeElement), true);
        await page.setViewportSize({ width: 1440, height: 1000 });
        await button.click(); await detail.waitFor(); await page.mouse.click(10, 500); assert.equal(await detail.count(), 0);
        } catch {
          console.error(`Brief UI check failed at ${briefStage}; response payloads omitted.`);
          const directory = process.env.STEER_WORKSPACE_SCREENSHOT_DIR;
          if (directory) await page.screenshot({ path: join(directory, 'brief-failure.png'), fullPage: true });
          throw new Error('Synthetic Brief UI check failed.');
        }
      });
      await check('source summaries clear explicitly, on navigation and on current grant denial without automatic reads', async () => {
        const library = page.getByRole('region', { name: 'Brief library' });
        const preview = library.getByRole('button', { name: 'Preview Intent 0125-synthetic-outcome', exact: true });
        const summary = library.getByRole('region', { name: 'Brief source summary' });
        await preview.click(); await summary.waitFor();
        await summary.getByRole('button', { name: 'Clear summary', exact: true }).click();
        assert.equal(await summary.count(), 0); assert.equal(await preview.getAttribute('aria-expanded'), 'false');
        assert.equal(await preview.evaluate(button => button === document.activeElement), true);
        await preview.click(); await summary.waitFor();
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
        assert.equal(await summary.count(), 0); assert.equal(await library.getByTestId('brief-catalog').locator('li').count(), 0);
        await library.getByRole('button', { name: 'Refresh Briefs', exact: true }).click();
        await preview.waitFor(); await preview.click(); await summary.waitFor();
        try {
          await source.publish([{ ...grant, toolGrants: ['session.context'] }]);
          const denied = page.waitForResponse(value => value.url() === `${origin}/v1/tools/intent.brief.read`);
          await preview.click(); assert.equal((await denied).status(), 403);
          await page.waitForFunction(() => document.querySelector('[data-testid="brief-status"]')?.textContent?.startsWith('Brief access could not be verified'));
          assert.equal(await summary.count(), 0); assert.equal(await library.getByTestId('brief-catalog').locator('li').count(), 0);
        } finally { await source.publish([grant]); }
        await library.getByRole('button', { name: 'Refresh Briefs', exact: true }).click(); await preview.waitFor();
        assert.equal(await summary.count(), 0);
      });
      await check('Brief library clears a previously read source on committed permission denial and rechecks after refresh', async () => {
        const library = page.getByRole('region', { name: 'Brief library' });
        await source.publish([{ ...grant, toolGrants: ['session.context'] }]);
        await library.getByRole('button', { name: 'Read Intent 0125-synthetic-outcome', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-testid="brief-status"]')?.textContent?.startsWith('Brief access could not be verified.'));
        assert.equal(await library.getByTestId('brief-catalog').locator('li').count(), 0);
        assert.equal(await page.getByRole('dialog').count(), 0);
        assert.equal(await page.getByText('Scoped projection test.', { exact: true }).count(), 0);
        await source.publish([grant]); await library.getByRole('button', { name: 'Refresh Briefs' }).click();
        await page.waitForFunction(() => document.querySelector('[data-testid="brief-status"]')?.textContent?.startsWith('Choose a Brief'));
        assert.deepEqual(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)]), [[], []]);
      });
      let savedBriefLink = '';
      await check('exact Brief links survive Back, Forward and reload while each restored view rechecks current access', async () => {
        const library = page.getByRole('region', { name: 'Brief library' });
        const detail = page.getByRole('dialog', { name: 'Synthetic scoped outcome' });
        let catalogs = 0; let reads = 0;
        const observe = (request: import('playwright').Request) => {
          const path = new URL(request.url()).pathname;
          if (path === '/v1/tools/intent.brief.catalog') catalogs++;
          if (path === '/v1/tools/intent.brief.read') reads++;
        };
        page.on('request', observe);
        try {
          await library.getByRole('button', { name: 'Read Intent 0125-synthetic-outcome', exact: true }).click(); await detail.waitFor();
          savedBriefLink = page.url(); const location = new URL(savedBriefLink);
          assert.equal(location.search, '');
          const params = new URLSearchParams(location.hash.slice(1));
          assert.deepEqual([...params.keys()], ['brief', 'organization', 'repository', 'path', 'revision', 'digest']);
          assert.equal(params.get('brief'), 'v1'); assert.equal(params.get('organization'), projection.input.organizationId);
          assert.equal(params.get('repository'), projection.input.repository); assert.equal(params.get('path'), projection.input.path);
          assert.equal(params.get('revision'), projection.input.revision); assert.match(params.get('digest')!, /^[a-f0-9]{64}$/);
          await page.goBack();
          await page.waitForFunction(() => document.querySelector('[data-testid="brief-status"]')?.textContent?.startsWith('Choose a Brief'));
          assert.equal(await detail.count(), 0); const before = { catalogs, reads };
          await page.goForward(); await detail.waitFor();
          assert.equal(catalogs - before.catalogs, 1, 'popstate/hashchange must not duplicate discovery');
          assert.equal(reads - before.reads, 1); assert.equal(page.url(), savedBriefLink);
          await page.reload(); await detail.waitFor(); assert.equal(page.url(), savedBriefLink);
          await page.keyboard.press('Escape'); assert.equal(new URL(page.url()).hash, '');
          assert.equal(await library.getByRole('button', { name: 'Read Intent 0125-synthetic-outcome', exact: true }).evaluate((element) => element === document.activeElement), true);
        } finally { page.off('request', observe); }
      });
      await check('foreign, stale and malformed Brief links never substitute content or authorize a source read', async () => {
        let reads = 0;
        const observe = (request: import('playwright').Request) => { if (new URL(request.url()).pathname === '/v1/tools/intent.brief.read') reads++; };
        page.on('request', observe);
        try {
          for (const [field, value] of [['organization', 'foreign-org'], ['repository', 'github:foreign'], ['revision', '0'.repeat(40)], ['digest', '0'.repeat(64)]]) {
            const url = new URL(savedBriefLink); const params = new URLSearchParams(url.hash.slice(1)); params.set(field!, value!);
            await page.goto(`${origin}/#${params.toString()}`);
            await page.waitForFunction(() => document.querySelector('[data-testid="brief-status"]')?.textContent?.startsWith('This linked revision is not available'));
            assert.equal(await page.getByRole('dialog').count(), 0);
          }
          await page.goto(`${savedBriefLink}&path=BRIEF.md`);
          await page.waitForFunction(() => document.querySelector('[data-testid="brief-status"]')?.textContent?.startsWith('This Brief link is invalid'));
          assert.equal(await page.getByRole('dialog').count(), 0); assert.equal(reads, 0);
        } finally { page.off('request', observe); }
      });
      await check('a saved Brief link cannot bypass committed permission revocation', async () => {
        await source.publish([{ ...grant, toolGrants: ['session.context'] }]); await page.goto(savedBriefLink);
        await page.waitForFunction(() => document.querySelector('[data-testid="brief-status"]')?.textContent?.startsWith('Brief access could not be verified.'));
        assert.equal(await page.getByRole('dialog').count(), 0); assert.equal(await page.getByTestId('brief-catalog').locator('li').count(), 0);
        await source.publish([grant]); await page.goto(origin);
        await page.waitForFunction(() => document.querySelector('[data-testid="brief-status"]')?.textContent?.startsWith('Choose a Brief'));
      });
      await check('hydrated reference panel loads real data, clears on committed grant denial, and rejects foreign scope', async () => {
        await page.getByText('Developer diagnostics', { exact: true }).click();
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
        // Navigation tests reload the document; reinstall the test-only audit engine.
        await page.evaluate((source) => { eval(source); }, await readFile(new URL('../../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8'));
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
        // Playwright Page.clock belongs to its BrowserContext. A separate page in
        // the original context leaks simulated time into subsequently loaded pages.
        // Copy only this synthetic session into an independently owned context.
        const expiryContext = await browser!.newContext({ ignoreHTTPSErrors: false, acceptDownloads: false });
        await expiryContext.addCookies(await context.cookies(origin));
        const expiryPage = await expiryContext.newPage();
        try {
          let requests = 0; expiryPage.on('request', (request) => { if (new URL(request.url()).pathname.startsWith('/v1/tools/projection.')) requests++; });
          await expiryPage.clock.install(); await expiryPage.goto(origin);
          await expiryPage.getByLabel('Working title', { exact: true }).fill('Unsaved expiry check');
          await expiryPage.getByText('Developer diagnostics', { exact: true }).click();
          const expiryPanel = expiryPage.getByRole('region', { name: 'Repository references' });
          await expiryPanel.getByLabel('Repository scope ID').fill(projection.input.repository);
          await expiryPanel.getByRole('button', { name: 'Load references', exact: true }).click();
          await expiryPage.waitForFunction(() => document.querySelector('[data-testid="reference-status"]')?.textContent?.startsWith('References loaded.'));
          await expiryPage.getByRole('button', { name: 'Read Intent 0125-synthetic-outcome', exact: true }).click();
          await expiryPage.getByRole('dialog', { name: 'Synthetic scoped outcome' }).waitFor();
          const beforeExpiry = requests;
          await expiryPage.clock.fastForward(310000);
          assert.equal(await expiryPanel.getByTestId('reference-list').count(), 0);
          assert.equal(await expiryPanel.getByRole('button', { name: 'Load references', exact: true }).isDisabled(), true);
          assert.match((await expiryPanel.getByTestId('reference-status').textContent())!, /Session display expired/);
          assert.equal(requests, beforeExpiry, 'Display expiry must not poll or reload references');
          assert.equal(await expiryPage.getByRole('dialog').count(), 0);
          assert.equal(await expiryPage.getByTestId('brief-catalog').locator('li').count(), 0);
          assert.equal(await expiryPage.getByRole('button', { name: 'Refresh Briefs' }).isDisabled(), true);
          assert.equal(await expiryPage.getByLabel('Working title', { exact: true }).inputValue(), '');
          assert.equal(await expiryPage.getByRole('button', { name: 'Preview Brief', exact: true }).isDisabled(), true);
        } finally { await expiryContext.close(); }
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
      await check('browser discovers only curated Brief references and discards catalog access after committed revocation', async () => {
        const input = { organizationId: projection.input.organizationId, repository: projection.input.repository };
        const read = (value = input) => page.evaluate(async (args) => {
          const response = await fetch('/v1/tools/intent.brief.catalog', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args) });
          return { status: response.status, data: await response.json() };
        }, value);
        const result = await read(); assert.equal(result.status, 200); assert.equal(result.data.kind, 'brief-catalog');
        assert.equal(result.data.records.length, 1); assert.equal(result.data.records[0].path, source.artifactPath);
        assert.equal(result.data.records[0].revision, projection.input.revision);
        assert.equal(Object.keys(result.data.records[0]).sort().join(','), 'contentDigest,path,revision');
        assert.equal((await read({ ...input, repository: 'github:foreign' })).status, 403);
        await source.publish([{ ...grant, toolGrants: grant.toolGrants.filter((name) => name !== 'intent.brief.catalog') }]);
        assert.equal((await read()).status, 403);
        await source.publish([grant]); assert.equal((await read()).status, 200);
      });
      await check('browser reads a fingerprint-bound Brief document through real Git/PostgreSQL and current dual grants', async () => {
        const sourceArtifact = await source.reader.readArtifact(source.artifactPath, projection.input.revision);
        const input = { ...projection.input, contentDigest: sourceArtifact.contentDigest };
        const read = (value = input) => page.evaluate(async (args) => {
          const response = await fetch('/v1/tools/intent.brief.read', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args) });
          return { status: response.status, data: await response.json() };
        }, value);
        const result = await read(); assert.equal(result.status, 200);
        assert.equal(result.data.kind, 'brief-projection'); assert.equal(result.data.content, sourceArtifact.content);
        assert.equal(result.data.document.title, 'Synthetic scoped outcome');
        assert.equal((await read({ ...input, contentDigest: '0'.repeat(64) })).data, null);
        for (const missing of ['intent.brief.read', 'projection.artifact.read']) {
          await source.publish([{ ...grant, toolGrants: grant.toolGrants.filter((name) => name !== missing) }]);
          const denied = await read(); assert.equal(denied.status, 403); assert.ok(!JSON.stringify(denied.data).includes(sourceArtifact.content));
        }
        await source.publish([grant]); assert.equal((await read()).status, 200);
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
        const remaining = await read(next); assert.equal(remaining.status, 200); assert.equal(remaining.data.events.length, 5);
        // The original four events remain, plus the two explicitly ingested
        // receipt revisions. Fixture-row cleanup must not erase feed history.
        assert.equal(receiptProjectionEvents.length, 2);
        assert.deepEqual(remaining.data.events.slice(-2).map(({ recordKey, sourceRevision, contentDigest }: { recordKey: string; sourceRevision: string; contentDigest: string }) =>
          ({ recordKey, sourceRevision, contentDigest })), receiptProjectionEvents);
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
        assert.equal(snapshot.data.cursor.position, '6');
        const resumed = await page.evaluate(async (args) => {
          const response = await fetch('/v1/tools/projection.changes.read', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args) });
          return { status: response.status, data: await response.json() };
        }, { ...input, cursor: snapshot.data.cursor, limit: 100 });
        assert.equal(resumed.status, 200); assert.deepEqual(resumed.data.events, []); assert.equal(resumed.data.snapshotRequired, false);
        assert.equal((await read({ ...input, repository: 'foreign' })).status, 403);
        await source.publish([{ ...grant, toolGrants: ['session.context', 'projection.changes.read'] }]); assert.equal((await read()).status, 403);
        await source.publish([grant]); assert.equal((await read()).status, 200);
      });
      await check('actual decision sources link to the selected Brief without claiming verified approval and clear on denial', async () => {
        assert.ok(storage.createDecisionProjection);
        const seeded = await source.publishDecisions(projection.input.revision);
        const decisionServices = await storage.createDecisionProjection(source.reader, seeded.paths, seeded.revision);
        const selectedBrief = await source.reader.readArtifact(projection.input.path, projection.input.revision);
        const unconfigured = await page.evaluate(async input => {
          const response = await fetch('/v1/tools/intent.brief.decisions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
          return { status: response.status, data: await response.json() };
        }, { ...projection.input, contentDigest: selectedBrief.contentDigest });
        assert.equal(unconfigured.status, 200); assert.deepEqual(unconfigured.data.records, [], 'present but unconfigured decision rows stay undisclosed');
        const decisionApi = createIdentityService(configuration, { ...dependencies, services: { ...projection.services, ...decisionServices } });
        services.push(decisionApi); gateway = bindGateway(web!.rendererOrigin, decisionApi);
        let stage = 'open selected Brief';
        let evidenceRequests = 0;
        const observeEvidence = (request: import('playwright').Request) => { if (request.url() === `${origin}/v1/tools/intent.brief.decision.evidence`) evidenceRequests++; };
        page.on('request', observeEvidence);
        try {
          await page.goto(origin);
          await page.waitForFunction(() => {
            const status = document.querySelector('[data-testid="brief-status"]')?.textContent;
            return status && !status.startsWith('Checking current access');
          });
          assert.match((await page.getByTestId('brief-status').textContent())!, /^Choose a Brief/);
          await page.getByRole('button', { name: 'Read Intent 0125-synthetic-outcome', exact: true }).click();
          const detail = page.getByRole('dialog'), section = detail.getByRole('region', { name: 'Recorded decisions' });
          const load = section.getByRole('button', { name: 'Load decision records', exact: true });
          stage = 'read decision response';
          const response = page.waitForResponse(value => value.url() === `${origin}/v1/tools/intent.brief.decisions`);
          await load.click(); const actualResponse = await response; assert.equal(actualResponse.status(), 200);
          const result = await actualResponse.json();
          stage = 'render validated decision response';
          assert.equal(result.records.length, 2); assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
          await section.getByText('Decision sources checked. Recorded claims below remain unverified.', { exact: true }).waitFor();
          const records = section.locator('.decision-record'); assert.equal(await records.count(), 2);
          stage = 'exact source linkage';
          assert.match((await records.nth(0).locator('.decision-linkage').textContent())!, /^References this exact Brief revision/);
          assert.match((await records.nth(1).locator('.decision-linkage').textContent())!, /^Does not reference this exact Brief revision/);
          assert.equal(await records.nth(0).getByRole('link', { name: 'This selected Brief' }).getAttribute('href'), new URL(page.url()).hash);
          assert.equal(await records.nth(1).getByRole('link').count(), 0);
          for (const [index, path] of seeded.paths.entries()) {
            const sourceRecord = await source.reader.readArtifact(path, seeded.revision);
            assert.equal(result.records[index].contentDigest, sourceRecord.contentDigest);
            assert.equal(result.records[index].revision, seeded.revision);
            await records.nth(index).getByText('Decision source and fingerprint', { exact: true }).click();
            assert.equal(await records.nth(index).locator('pre').textContent(), sourceRecord.content);
            await records.nth(index).getByText('Decision source and fingerprint', { exact: true }).click();
          }
          assert.equal(await page.evaluate(() => (window as unknown as { __steerDecisionUnsafe?: boolean }).__steerDecisionUnsafe), undefined);
          const directory = process.env.STEER_WORKSPACE_SCREENSHOT_DIR;
          stage = 'responsive source rendering';
          await section.evaluate(element => element.scrollIntoView({ block: 'start' }));
          if (directory) await page.screenshot({ path: join(directory, 'brief-decisions-desktop.png') });
          await page.setViewportSize({ width: 390, height: 844 });
          assert.equal(await section.evaluate(element => element.scrollWidth <= element.clientWidth), true);
          if (directory) await page.screenshot({ path: join(directory, 'brief-decisions-mobile.png') });
          await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
          await records.nth(0).getByText('Decision source and fingerprint', { exact: true }).click();
          assert.equal(await section.evaluate(element => element.scrollWidth <= element.clientWidth), true);
          await records.nth(0).getByText('Decision source and fingerprint', { exact: true }).click();
          await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
          await page.setViewportSize({ width: 1440, height: 1000 });
          const axe = await readFile(new URL('../../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
          stage = 'automated accessibility';
          await page.evaluate(source => { eval(source); }, axe);
          const violations = await page.evaluate(async () => (await (window as unknown as { axe: { run(context: string, options: unknown): Promise<{ violations: unknown[] }> } }).axe.run('.brief-dialog', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations);
          assert.deepEqual(violations, []);
          stage = 'exact referenced evidence';
          assert.equal(evidenceRequests, 0, 'record text must not automatically fetch evidence');
          const inspect = records.nth(0).getByRole('button', { name: 'Inspect SPEC.md', exact: true });
          const evidencePanel = section.getByRole('region', { name: 'Evidence source: SPEC.md', exact: true });
          const evidenceUrl = `${origin}/v1/tools/intent.brief.decision.evidence`;
          const exactSource = await source.reader.readArtifact('SPEC.md', projection.input.revision);
          const readEvidence = async () => {
            const response = page.waitForResponse(value => value.url() === evidenceUrl);
            await inspect.focus(); await page.keyboard.press('Enter');
            const received = await response; assert.equal(received.status(), 200);
            const value = await received.json();
            assert.equal(value.artifact.content, exactSource.content); assert.equal(value.artifact.contentDigest, exactSource.contentDigest);
            assert.equal(value.artifact.revision, projection.input.revision); assert.equal(value.decision.revision, seeded.revision);
            assert.equal(value.gateVerified, false); assert.equal(value.writeAuthorized, false);
            await evidencePanel.waitFor(); assert.equal(await evidencePanel.locator('pre').textContent(), exactSource.content);
            assert.equal(await evidencePanel.evaluate(element => element === document.activeElement), true);
          };
          await readEvidence();
          assert.equal(await evidencePanel.locator('script, a, img').count(), 0);
          assert.equal(await page.evaluate(() => (window as unknown as { __steerEvidenceUnsafe?: boolean }).__steerEvidenceUnsafe), undefined);
          await evidencePanel.evaluate(element => element.scrollIntoView({ block: 'start' }));
          if (directory) await page.screenshot({ path: join(directory, 'decision-evidence-desktop.png') });
          await page.setViewportSize({ width: 390, height: 844 });
          assert.equal(await evidencePanel.evaluate(element => element.scrollWidth <= element.clientWidth), true);
          if (directory) await page.screenshot({ path: join(directory, 'decision-evidence-mobile.png') });
          await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
          assert.equal(await evidencePanel.evaluate(element => element.scrollWidth <= element.clientWidth), true);
          await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
          await page.setViewportSize({ width: 1440, height: 1000 });
          assert.deepEqual(await page.evaluate(async () => (await (window as unknown as { axe: { run(context: string, options: unknown): Promise<{ violations: unknown[] }> } }).axe.run('.brief-dialog', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations), []);
          await records.nth(0).getByRole('button', { name: 'Close evidence source', exact: true }).click();
          assert.equal(await evidencePanel.count(), 0); assert.equal(await inspect.evaluate(element => element === document.activeElement), true);
          stage = 'cancel pending evidence inspection';
          let releaseEvidence!: () => void, observedEvidence!: () => void, drainedEvidence!: () => void;
          let evidenceRouted = false;
          const heldEvidence = new Promise<void>(resolve => { releaseEvidence = resolve; });
          const observed = new Promise<void>(resolve => { observedEvidence = resolve; });
          const drained = new Promise<void>(resolve => { drainedEvidence = resolve; });
          // Test-only held browser transport, not fabricated evidence or authority.
          await page.route(evidenceUrl, async route => {
            evidenceRouted = true; observedEvidence(); await heldEvidence;
            try { await route.abort(); } catch { /* Browser cancellation may already have closed this request. */ }
            finally { drainedEvidence(); }
          });
          try {
            await inspect.click();
            await Promise.race([observed, delay(10000).then(() => { throw new Error('Synthetic evidence interception did not start.'); })]);
            await records.nth(0).getByRole('button', { name: 'Cancel evidence read', exact: true }).click();
            assert.equal(await evidencePanel.count(), 0); assert.equal(await inspect.evaluate(element => element === document.activeElement), true);
            assert.equal(await records.nth(0).getByTestId('evidence-status').textContent(), 'Evidence source cleared.');
          } finally { releaseEvidence(); if (evidenceRouted) await drained; await page.unroute(evidenceUrl); }
          stage = 'evidence curation and stale references';
          const deniedSource = page.waitForResponse(value => value.url() === evidenceUrl);
          await records.nth(0).getByRole('button', { name: 'Inspect EXAM.md', exact: true }).click();
          assert.equal((await deniedSource).status(), 403);
          await records.nth(0).getByTestId('evidence-status').filter({ hasText: 'Evidence source could not be checked.' }).waitFor();
          assert.equal(await evidencePanel.count(), 0);
          stage = 'reread evidence after curation denial';
          await readEvidence();
          stage = 'stale evidence reference';
          const staleSource = page.waitForResponse(value => value.url() === evidenceUrl);
          await records.nth(1).getByRole('button', { name: 'Inspect SPEC.md', exact: true }).click();
          const stale = await staleSource; assert.equal(stale.status(), 200); assert.equal(await stale.json(), null);
          await records.nth(1).getByTestId('evidence-status').filter({ hasText: 'This exact selection is no longer available.' }).waitFor();
          assert.equal(await section.locator('.decision-evidence').count(), 0, 'switching decisions clears the previous source');
          stage = 'reread evidence after stale reference';
          await readEvidence();
          stage = 'evidence grant revocation';
          await source.publish([{ ...grant, toolGrants: grant.toolGrants.filter(name => name !== 'intent.brief.decision.evidence') }]);
          const deniedGrant = page.waitForResponse(value => value.url() === evidenceUrl); await inspect.click();
          assert.equal((await deniedGrant).status(), 403);
          await records.nth(0).getByTestId('evidence-status').filter({ hasText: 'Evidence source could not be checked.' }).waitFor();
          assert.equal(await evidencePanel.count(), 0);
          stage = 'reread evidence after grant restoration';
          await source.publish([grant]); await readEvidence();
          stage = 'revocation and clearing';
          await source.publish([{ ...grant, toolGrants: grant.toolGrants.filter(name => name !== 'intent.brief.decisions') }]);
          await load.click(); await section.getByText('Decision records could not be checked. Refresh access and try again.', { exact: true }).waitFor();
          assert.equal(await records.count(), 0);
          await source.publish([grant]); await load.click(); await records.nth(1).waitFor();
          await readEvidence();
          await page.getByRole('button', { name: 'Close Brief', exact: true }).click();
          await page.getByRole('button', { name: 'Read Intent 0125-synthetic-outcome', exact: true }).click();
          assert.equal(await section.locator('.decision-record').count(), 0, 'closed decision content is not retained');
          await page.keyboard.press('Escape');
        } catch (error) {
          console.error(`Decision UI check failed at ${stage}; error class ${error instanceof Error ? error.name : 'unknown'}; payloads omitted.`);
          console.error({ briefNotice: await page.getByTestId('brief-status').textContent().catch(() => 'unavailable'),
            decisionNotice: await page.getByTestId('decision-status').textContent({ timeout: 1000 }).catch(() => 'unavailable'),
            hidden: await page.evaluate(() => document.hidden) });
          const directory = process.env.STEER_WORKSPACE_SCREENSHOT_DIR;
          if (directory) await page.screenshot({ path: join(directory, 'brief-decisions-failure.png') });
          throw error;
        } finally { page.off('request', observeEvidence); gateway = bindGateway(web!.rendererOrigin); await source.publish([grant]); await page.goto(origin); }
      });
      await check(`opt-in browser creates a native Brief once and reaches ${deps.recovery ? 'fixed-failed-run recovery' : 'durable projection'}, replay and exact source reads with real Keycloak membership`, async () => {
        const path = 'items/0167-created-fixture/BRIEF.md';
        const provider = createNativeGitHubCreateHarness(source, tls.certificate, path), appJwt = createAppJwtSigner('1', tls.key.toString('utf8'));
        const configured = { organizationId: grant.organizationId, repository: 'github:1', branch: 'synthetic', paths: [path],
          platformRevision: await source.reader.readHead(), gate2DecisionDigest: 'f'.repeat(64) };
        const factory = createGitHubBriefWriterFactory(source.reader.binding, configured, {
          issuer, authorizationPath: source.authorizationPath, fetch: provider.transport, appJwt,
          // Explicit TEST DOUBLE for gate authority only. Actual Keycloak/session/Git membership is independently checked by the factory.
          verifyGateAuthority: async request => ({ kind: 'verified-brief-write-authority', organizationId: request.organizationId, repository: request.repository,
            branch: request.branch, path: request.path, subject: request.subject, idempotencyKey: request.idempotencyKey,
            requestDigest: request.requestDigest, expectedHead: request.expectedHead, authorizationRevision: request.expectedHead,
            platformRevision: configured.platformRevision, gate2DecisionDigest: configured.gate2DecisionDigest,
            evaluatedAt: new Date().toISOString(), validThrough: new Date(Date.now() + 5000).toISOString() }),
        });
        const savingGrant = { ...grant, toolGrants: [...grant.toolGrants, 'intent.brief.save'] };
        let dispatchMode: 'allowed' | 'projection-only' | 'revoked' = 'allowed';
        let recoveryMode: 'allowed' | 'dispatch-only' | 'revoked' = 'allowed';
        let projectorMode: 'allowed' | 'dispatch-only' | 'revoked' | 'invalid-token' | 'dispatcher-token' = 'allowed';
        const publishServiceGrants = () => source.publish([savingGrant, { ...deps.agent.grant,
          active: dispatchMode !== 'revoked', validAfter: new Date(Date.now() - 30000).toISOString(), expiresAt: new Date(Date.now() + 180000).toISOString(),
          toolGrants: dispatchMode === 'projection-only' ? ['projection.ingest'] : ['workflow.recorded-brief.start', 'workflow.recorded-brief.status'],
        }, { ...deps.agent.grant, subject: deps.projector.subject,
          active: projectorMode !== 'revoked', validAfter: new Date(Date.now() - 30000).toISOString(), expiresAt: new Date(Date.now() + 180000).toISOString(),
          toolGrants: projectorMode === 'dispatch-only' ? ['workflow.recorded-brief.start'] : ['projection.ingest'],
        }, ...(deps.recovery ? [{ ...deps.agent.grant, subject: deps.recovery.subject,
          active: recoveryMode !== 'revoked', validAfter: new Date(Date.now() - 30000).toISOString(), expiresAt: new Date(Date.now() + 180000).toISOString(),
          toolGrants: recoveryMode === 'dispatch-only' ? ['workflow.recorded-brief.start', 'workflow.recorded-brief.status']
            : ['workflow.recorded-brief.recover', 'workflow.recorded-brief.recovery.status'],
        }] : [])]);
        const authenticateProjector = createOidcAuthenticator({ issuer, jwksUri: configuration.jwksUri,
          audience: configuration.audience, clientIds: [deps.projector.clientId] }, { fetch: deps.fetch,
          resolveAuthorization: createGitAuthorizationResolver(createGitHubReader(source.reader.binding, { fetch: provider.transport, appJwt }), source.authorizationPath) });
        let projected: Awaited<ReturnType<NonNullable<typeof storage.createReceiptProjection>>> | undefined;
        let created = 0, closed = 0;
        const compose = () => createIdentityService(configuration, { ...dependencies,
          sessions: { ...dependencies.sessions, shutdown: async () => {} },
          services: { ...projection.services, ...(projected?.services ?? {}), briefDestination: { scope: {
            organizationId: grant.organizationId, repository: 'github:1', branch: 'synthetic', paths: [path] }, readHead: () => source.reader.readHead() } },
          createBriefWriter: authenticate => { const writer = factory(authenticate); created++; let stopped = false;
            return { ...writer, close: () => { if (!stopped) { stopped = true; closed++; } writer.close(); } }; },
        });
        const submitWeb = await createNextWebHarness(origin, issuer, true, true);
        let service = compose(), stage = 'authoring', previewStatus: number | null = null;
        const observePreview = (response: import('playwright').Response) => { if (new URL(response.url()).pathname === '/v1/tools/intent.brief.preview') previewStatus = response.status(); };
        page.on('response', observePreview);
        try {
          await source.publish([savingGrant]); gateway = bindGateway(submitWeb.rendererOrigin, service); stage = 'new opt-in page'; await page.goto(origin);
          // This longer scenario needs a fresh actual provider login, not a longer
          // token lifetime or a browser clock override. End only the owned test session.
          stage = 'fresh synthetic login';
          await page.getByRole('button', { name: 'Sign out', exact: true }).click();
          await page.getByRole('button', { name: 'Sign in', exact: true }).click();
          await page.getByRole('heading', { name: 'Your workspace.', exact: true }).waitFor();
          const author = page.getByRole('region', { name: 'Start with your intent.' });
          const answers = ['Browser-created request', 'Requests are entered twice.', 'Each request is entered once.', 'Coordinators', 'Unverified intake system', 'Duplicate entry count', 'No new subscription', 'Confirm the system name'];
          for (let index = 0; index < answers.length; index++) {
            stage = `authoring field ${index + 1}`;
            await author.locator('.author-field input, .author-field textarea').first().fill(answers[index]!);
            if (index < answers.length - 1) await author.getByRole('button', { name: 'Next question', exact: true }).click();
          }
          stage = 'render preview'; await author.getByRole('button', { name: 'Preview Brief', exact: true }).click();
          await page.waitForFunction(() => {
            const text = document.querySelector('[data-testid="author-status"]')?.textContent;
            return text?.startsWith('Preview ready.') || text?.startsWith('Draft preview could not be verified.') || text?.startsWith('Please shorten this draft:');
          });
          await author.getByTestId('author-digest').waitFor({ state: 'attached' }); const digest = await author.getByTestId('author-digest').textContent();
          const panel = page.getByRole('region', { name: 'Where this Brief could go' });
          stage = 'destination'; await panel.getByRole('button', { name: 'Check destination', exact: true }).click();
          const review = page.getByRole('region', { name: 'Review this exact draft' });
          stage = 'path selection'; await review.getByLabel('Brief path to review', { exact: true }).selectOption(path);
          const submit = review.getByRole('button', { name: 'Submit this reviewed Brief', exact: true });
          stage = 'disabled before review'; assert.equal(await submit.isDisabled(), true); assert.equal(provider.mutations(), 0);
          await review.getByLabel('I reviewed the displayed Brief for this destination.', { exact: true }).check();
          stage = 'enabled after review'; assert.equal(await submit.isEnabled(), true); stage = 'single dispatch'; provider.loseAck();
          const response = page.waitForResponse(value => value.url() === `${origin}/v1/tools/intent.brief.save`);
          await submit.click(); const saved = await response; assert.equal(saved.status(), 200);
          assert.equal((await saved.json()).result.outcome, 'unknown'); assert.equal(provider.mutations(), 1);
          const operation = await page.getByTestId('submission-operation').textContent(); assert.ok(operation);
          const request = saved.request().postDataJSON(); assert.equal(request.idempotencyKey, operation); assert.equal(request.confirmation.contentDigest, digest);
          assert.equal(await submit.isDisabled(), true);
          assert.equal(await review.getByTestId('brief-review-status').textContent(), 'Submission attempt locked · See operation status below · Not signed');
          const operationPanel = page.getByRole('region', { name: 'This save operation' });
          stage = 'receipt recovery'; await service.shutdown(); service = compose(); gateway = bindGateway(submitWeb.rendererOrigin, service);
          const statusResponse = page.waitForResponse(value => value.url() === `${origin}/v1/tools/intent.brief.save.status`);
          await operationPanel.getByRole('button', { name: 'Check this operation', exact: true }).click();
          const status = await statusResponse; assert.equal(status.status(), 200); const observation = await status.json();
          assert.equal(observation.result.outcome, 'committed'); assert.equal(observation.result.idempotencyKey, operation);
          assert.equal(observation.result.contentDigest, digest); assert.equal(observation.gateSigned, false);
          await page.getByTestId('submission-receipt').waitFor(); assert.equal(provider.mutations(), 1);
          stage = 'destination expiry and access denial';
          await panel.locator('.destination-details').waitFor({ state: 'detached', timeout: 20000 });
          assert.equal(await page.getByTestId('submission-operation').textContent(), operation);
          await source.publish([{ ...savingGrant, toolGrants: savingGrant.toolGrants.filter(value => value !== 'intent.brief.save.status') }]);
          await operationPanel.getByRole('button', { name: 'Check this operation', exact: true }).click();
          await page.waitForFunction(() => document.querySelector('[data-testid="submission-status"]')?.textContent?.startsWith('Save outcome is unverified.'));
          assert.equal(await page.getByTestId('submission-receipt').count(), 0); assert.equal(provider.mutations(), 1);
          await source.publish([savingGrant]);
          await operationPanel.getByRole('button', { name: 'Check this operation', exact: true }).click(); await page.getByTestId('submission-receipt').waitFor();
          stage = 'responsive and accessibility';
          const directory = process.env.STEER_WORKSPACE_SCREENSHOT_DIR;
          if (directory) await operationPanel.screenshot({ path: join(directory, 'submission-desktop.png') });
          await page.setViewportSize({ width: 390, height: 844 });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          if (directory) await operationPanel.screenshot({ path: join(directory, 'submission-mobile.png') });
          await page.setViewportSize({ width: 1440, height: 1000 });
          await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
          await page.evaluate(source => { eval(source); }, await readFile(new URL('../../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8'));
          assert.deepEqual(await page.evaluate(async () => (await (window as unknown as { axe: { run: (node: Document, options: unknown) => Promise<{ violations: { id: string }[] }> } }).axe.run(document,
            { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(x => x.id)), []);
          stage = 'projected read'; assert.ok(storage.createReceiptProjection);
          projected = await storage.createReceiptProjection(createGitHubReader(source.reader.binding, { fetch: provider.transport, appJwt }), path, observation.result.revision, async () => {
            const value = await page.evaluate(async request => {
              const response = await fetch('/v1/tools/intent.brief.save.status', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) });
              if (response.status !== 200) throw new Error('Synthetic status unavailable'); return response.json();
            }, { organizationId: grant.organizationId, repository: 'github:1', branch: 'synthetic', path, idempotencyKey: operation });
            return value;
          }, { idempotencyKey: operation, subject: deps.subject, dispatch: {
            // Bearer-only service-account runtime. No browser login or token exchange
            // uses this placeholder client secret; issueBearer owns the actual credential.
            configuration: { ...configuration, clientId: deps.agent.clientId, clientSecret: 'synthetic-unused-browser-secret' },
            authorizationPath: source.authorizationPath, privateKeyPem: tls.key.toString('utf8'), subject: deps.agent.grant.subject,
            transports: { identity: deps.fetch, github: provider.transport }, issueBearer: deps.agent.issueBearer,
            publish: async mode => { dispatchMode = mode; await publishServiceGrants(); },
          }, projector: { subject: deps.projector.subject,
            publish: async mode => { projectorMode = mode; await publishServiceGrants(); },
            authenticate: async () => {
              const bearer = projectorMode === 'invalid-token' ? 'invalid'
                : await (projectorMode === 'dispatcher-token' ? deps.agent.issueBearer() : deps.projector.issueBearer());
              const principal = await authenticateProjector(new Request(origin, { headers: { authorization: `Bearer ${bearer}` } }));
              if (principal) { assert.equal(principal.subject, deps.projector.subject); assert.equal(principal.type, 'agent'); assert.deepEqual(principal.hats, []); }
              return principal;
            },
          }, ...(deps.recovery ? { recovery: {
            configuration: { ...configuration, clientId: deps.recovery.clientId, clientSecret: 'synthetic-unused-browser-secret' },
            authorizationPath: source.authorizationPath, privateKeyPem: tls.key.toString('utf8'), subject: deps.recovery.subject,
            transports: { identity: deps.fetch, github: provider.transport }, issueBearer: deps.recovery.issueBearer,
            publish: async (mode: 'allowed' | 'dispatch-only' | 'revoked') => { recoveryMode = mode; await publishServiceGrants(); },
          } } : {}) });
          await projected.project(); await service.shutdown(); service = compose(); gateway = bindGateway(submitWeb.rendererOrigin, service);
          await operationPanel.locator('[data-submission-receipt-link]').click();
          await page.getByRole('dialog', { name: 'Browser-created request' }).waitFor();
          assert.ok((await page.getByRole('dialog', { name: 'Browser-created request' }).innerText()).includes('Browser-created request'));
          assert.equal(provider.mutations(), 1); assert.equal(created, closed);
        } catch (error) {
          const assertion = error as { actual?: unknown; expected?: unknown; name?: string };
          const scalar = (value: unknown) => typeof value === 'boolean' || typeof value === 'number' ? value : 'omitted';
          const notice = await page.getByTestId('author-status').textContent().catch(() => null);
          const safeNotice = notice && /^(Preview ready\.|Draft preview could not be verified\.|Please shorten this draft:|Session display expired)/.test(notice) ? notice : 'omitted';
          console.error(`Isolated browser submission failed at ${stage}; ${assertion.name}; actual=${scalar(assertion.actual)}, expected=${scalar(assertion.expected)}; preview HTTP=${previewStatus}; notice=${safeNotice}; source details omitted.`); throw error;
        }
        finally { page.off('response', observePreview); gateway = bindGateway(web!.rendererOrigin); try { await service.shutdown(); await projected?.close(); }
          finally { await submitWeb.close(); await source.publish([grant]); await page.goto(origin); } }
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
