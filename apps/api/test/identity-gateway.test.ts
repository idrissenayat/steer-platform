import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { createIdentityGateway } from '../src/identity-gateway.ts';

const configuration = { publicOrigin: 'https://steer.example', rendererOrigin: 'http://127.0.0.1:49001', issuer: 'https://identity.example/realms/steer' };
const identity = { fetch: async () => new Response('identity') };
const page = () => new Response('<h1>STEER</h1>', { headers: { 'content-type': 'text/html; charset=utf-8' } });
const request = (path = '/', init?: RequestInit) => new Request(`${configuration.publicOrigin}${path}`, init);

test('gateway validates fixed HTTPS public/issuer and explicit loopback-only renderer origins', () => {
  for (const publicOrigin of ['http://steer.example', 'https://steer.example/', 'https://user:pass@steer.example', 'https://steer.example?x=1'])
    assert.throws(() => createIdentityGateway({ ...configuration, publicOrigin }, { identity }));
  for (const rendererOrigin of ['http://localhost:3000', 'https://127.0.0.1:3000', 'http://127.0.0.1', 'http://127.0.0.1:3000/path', 'http://remote.example:3000'])
    assert.throws(() => createIdentityGateway({ ...configuration, rendererOrigin }, { identity }));
  for (const issuer of ['http://identity.example', 'https://user:pass@identity.example', 'https://identity.example?a=1', 'https://identity.example/#x'])
    assert.throws(() => createIdentityGateway({ ...configuration, issuer }, { identity }));
  for (const repository of ['', 'a/b', 'https://github.com/a/b', 'github:' + '1'.repeat(161), 'github:1\n'])
    assert.throws(() => createIdentityGateway({ ...configuration, workspace: { organizationId: 'org', repository } }, { identity }));
});

test('fixed repository display is session-org-bound, copied at construction and never taken from browser headers', async () => {
  const workspace = { organizationId: 'synthetic-org', repository: 'github:1' };
  const view = { subject: 'account', organizationId: 'synthetic-org', hats: [], expiresAt: new Date(Date.now() + 60000).toISOString() };
  let received: string | null = null; let valid = true;
  const gateway = createIdentityGateway({ ...configuration, workspace }, { identity: { fetch: async () => Response.json(view, { status: valid ? 200 : 401 }) },
    fetch: async (_input, init) => { received = new Headers(init?.headers).get('x-steer-repository-view'); return page(); } });
  workspace.repository = 'github:999';
  const input = () => request('/', { headers: { cookie: '__Host-steer-session=synthetic', 'x-steer-repository-view': 'github:attacker' } });
  await gateway.fetch(input()); assert.equal(received, 'github:1');
  valid = false; await gateway.fetch(input()); assert.equal(received, null);
  valid = true; view.organizationId = 'foreign'; await gateway.fetch(input()); assert.equal(received, null);
  await gateway.fetch(request('/', { headers: { 'x-steer-repository-view': 'github:attacker' } })); assert.equal(received, null);
});

test('renderer sees fixed path and generated CSP, never browser credentials or spoofed security headers', async () => {
  let calls = 0; let policy: string | null = null;
  const gateway = createIdentityGateway(configuration, { identity, fetch: async (input, init) => {
    calls++; assert.equal(input, `${configuration.rendererOrigin}/`);
    const headers = new Headers(init?.headers); policy = headers.get('content-security-policy');
    assert.deepEqual([...headers.keys()], ['accept', 'content-security-policy']);
    assert.match(policy!, /script-src 'nonce-[A-Za-z0-9+/]{32}' 'strict-dynamic'/);
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    assert.equal(init?.method, 'GET'); assert.equal(init?.body, undefined);
    return new Response('<h1>STEER</h1>', { headers: { 'content-type': 'text/html', 'set-cookie': 'renderer=unsafe',
      location: 'https://untrusted.example', 'access-control-allow-origin': '*', 'content-security-policy': "script-src *" } });
  } });
  const response = await gateway.fetch(request('/', { headers: { cookie: 'secret=value', authorization: 'Bearer secret',
    host: 'untrusted.example', 'x-forwarded-host': 'untrusted.example', referer: 'https://steer.example/auth/callback?code=secret',
    'x-nonce': 'attacker', 'content-security-policy': "script-src 'unsafe-inline'" } }));
  assert.equal(response.status, 200); assert.equal(calls, 1); assert.equal(await response.text(), '<h1>STEER</h1>');
  for (const header of ['set-cookie', 'location', 'access-control-allow-origin']) assert.equal(response.headers.get(header), null);
  assert.equal(response.headers.get('referrer-policy'), 'same-origin');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('content-security-policy'), policy);
  assert.ok(!policy!.includes('unsafe-inline')); assert.ok(!policy!.includes('unsafe-eval')); assert.ok(!policy!.includes('attacker'));
});

test('every rendered page gets a distinct unpredictable nonce and static/error responses keep script denial', async () => {
  const gateway = createIdentityGateway(configuration, { identity, fetch: async (input, init) => {
    const headers = new Headers(init?.headers);
    if (String(input).endsWith('.js')) { assert.equal(headers.get('content-security-policy'), null); return new Response('void 0', { headers: { 'content-type': 'application/javascript' } }); }
    return page();
  } });
  const policies = await Promise.all(Array.from({ length: 32 }, async () => (await gateway.fetch(request())).headers.get('content-security-policy')!));
  const nonces = policies.map((policy) => /'nonce-([A-Za-z0-9+/]{32})'/.exec(policy)?.[1]);
  assert.ok(nonces.every(Boolean)); assert.equal(new Set(nonces).size, 32);
  const asset = await gateway.fetch(request('/_next/static/chunks/synthetic.js'));
  assert.equal(asset.status, 200); assert.ok(!asset.headers.get('content-security-policy')!.includes('nonce-'));
  const denied = await gateway.fetch(request('/invalid'));
  assert.equal(denied.status, 404); assert.equal(denied.headers.get('content-security-policy'), "default-src 'none'; frame-ancestors 'none'");
});

test('canonical origin, query, path and method rejection makes no renderer or identity calls', async () => {
  const unexpected = async () => { assert.fail('Rejected request reached a dependency'); };
  const gateway = createIdentityGateway(configuration, { identity: { fetch: unexpected }, fetch: unexpected });
  assert.equal((await gateway.fetch(new Request('https://untrusted.example/auth/login', { method: 'POST' }))).status, 400);
  for (const path of ['/?code=secret', '/_next/static/chunks/app.css?token=secret']) assert.equal((await gateway.fetch(request(path))).status, 400);
  for (const path of ['/private', '/_next/image', '/_next/static/%2e%2e/secret.css', '/_next/static/chunks/a%2fb.css', '/_next/static/a.html', '/_next/static/.hidden.css'])
    assert.equal((await gateway.fetch(request(path))).status, 404);
  for (const method of ['HEAD', 'POST', 'PUT', 'OPTIONS']) assert.equal((await gateway.fetch(request('/', { method }))).status, 405);
});

test('auth/API requests and response cookies remain solely with the identity service', async () => {
  const input = request('/auth/callback?code=synthetic&state=synthetic', { headers: { cookie: 'opaque=synthetic' } });
  const output = new Response(null, { status: 303, headers: { location: '/', 'set-cookie': 'opaque=next', 'referrer-policy': 'no-referrer' } });
  let seen: Request | undefined;
  const gateway = createIdentityGateway(configuration, { identity: { fetch: async (value) => { seen = value; return output; } },
    fetch: async () => { assert.fail('Identity traffic reached renderer'); } });
  assert.equal(await gateway.fetch(input), output); assert.equal(seen, input);
  for (const path of ['/v1/tools/session.context', '/health/ready', '/openapi.json', '/auth/logout', '/mcp']) {
    const original = request(path); assert.equal(await gateway.fetch(original), output); assert.equal(seen, original);
  }
});

test('static assets require matching content type and receive fixed security policy', async () => {
  const gateway = createIdentityGateway(configuration, { identity, fetch: async (input) => {
    assert.equal(input, `${configuration.rendererOrigin}/_next/static/chunks/abc-def.css`);
    return new Response('body{}', { headers: { 'content-type': 'text/css; charset=UTF-8' } });
  } });
  const response = await gateway.fetch(request('/_next/static/chunks/abc-def.css'));
  assert.equal(response.status, 200); assert.equal(await response.text(), 'body{}');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});

test('renderer errors, redirects, MIME mismatch and oversized responses fail closed without payload leakage', async () => {
  for (const response of [new Response('private renderer error', { status: 500 }),
    new Response(null, { status: 302, headers: { location: 'https://outside.example' } }),
    new Response('private', { headers: { 'content-type': 'application/json' } }),
    new Response(new Uint8Array(1024 * 1024 + 1), { headers: { 'content-type': 'text/html' } })]) {
    const gateway = createIdentityGateway(configuration, { identity, fetch: async () => response });
    const result = await gateway.fetch(request()); assert.equal(result.status, 502);
    assert.equal(await result.text(), 'The request could not be served.');
  }
  const gateway = createIdentityGateway(configuration, { identity, fetch: async () => { throw new Error('private secret'); } });
  assert.equal((await gateway.fetch(request())).status, 502);
});

test('actual renderer transport aborts slow headers/body, refuses redirects and omits sensitive request headers', async () => {
  let leaked = false; let redirected = false;
  const server = createServer((req, res) => {
    leaked ||= Boolean(req.headers.cookie || req.headers.authorization || req.headers['x-forwarded-host']);
    if (req.url === '/') { res.setHeader('content-type', 'text/html'); res.end('public'); }
    else if (req.url === '/_next/static/redirect.css') { res.writeHead(302, { location: '/redirect-target' }); res.end(); }
    else if (req.url === '/redirect-target') { redirected = true; res.end(); }
    else if (req.url === '/_next/static/body.css') { res.writeHead(200, { 'content-type': 'text/css' }); res.write('body{'); }
    // Any other path deliberately leaves headers pending until the gateway deadline.
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  try {
    const gateway = createIdentityGateway({ ...configuration, rendererOrigin: `http://127.0.0.1:${address.port}` }, { identity });
    const result = await gateway.fetch(request('/', { headers: { cookie: 'secret=synthetic', authorization: 'Bearer synthetic', 'x-forwarded-host': 'outside.example' } }));
    assert.equal(result.status, 200); assert.equal(leaked, false);
    assert.equal((await gateway.fetch(request('/_next/static/redirect.css'))).status, 502); assert.equal(redirected, false);
    const start = performance.now();
    const results = await Promise.all(['/headers.css', '/body.css'].map((path) => gateway.fetch(request(`/_next/static${path}`))));
    assert.deepEqual(results.map((value) => value.status), [502, 502]);
    assert.ok(performance.now() - start >= 4900); assert.ok(performance.now() - start < 9000);
    const controller = new AbortController();
    const pending = gateway.fetch(request('/_next/static/body.css', { signal: controller.signal }));
    setTimeout(() => controller.abort(), 25); assert.equal((await pending).status, 408);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});

test('renderer admission shares bounded request leases and recovers after completion', async () => {
  let release!: () => void; const blocked = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  const gateway = createIdentityGateway(configuration, { identity, fetch: async () => { calls++; await blocked; return page(); } });
  const pending = Array.from({ length: 32 }, () => gateway.fetch(request()));
  assert.equal((await gateway.fetch(request())).status, 503); assert.equal(calls, 32);
  release(); assert.ok((await Promise.all(pending)).every((response) => response.status === 200));
  assert.equal((await gateway.fetch(request())).status, 200);
});

test('gateway projects only current verified display fields and strips spoofed browser view headers', async () => {
  const view = { subject: 'synthetic-account', organizationId: 'synthetic-org', hats: ['product-lead'], expiresAt: new Date(Date.now() + 60000).toISOString() };
  let calls = 0; let received: string | null = null; let result = Response.json(view);
  const gateway = createIdentityGateway(configuration, { identity: { fetch: async (input) => {
    calls++; assert.equal(input.url, `${configuration.publicOrigin}/auth/session`); assert.equal(input.method, 'POST');
    assert.equal(input.headers.get('origin'), configuration.publicOrigin); assert.equal(input.headers.get('sec-fetch-site'), 'same-origin');
    assert.equal(input.headers.get('cookie'), '__Host-steer-session=synthetic');
    assert.equal(input.headers.get('x-steer-session-view'), null); assert.equal(input.body, null); return result;
  } }, fetch: async (_input, init) => {
    const headers = new Headers(init?.headers); received = headers.get('x-steer-session-view');
    assert.equal(headers.get('cookie'), null); assert.equal(headers.get('authorization'), null); return page();
  } });
  const input = () => request('/', { headers: { cookie: '__Host-steer-session=synthetic', 'x-steer-session-view': 'spoofed-value' } });
  assert.equal((await gateway.fetch(input())).status, 200);
  assert.deepEqual(JSON.parse(decodeURIComponent(received!)), view); assert.equal(calls, 1);
  for (const failure of [Response.json(view, { status: 401 }), Response.json({ ...view, accessToken: 'must-not-project' }),
    Response.json({ ...view, expiresAt: '2000-01-01T00:00:00Z' }), new Response('malformed')]) {
    result = failure; assert.equal((await gateway.fetch(input())).status, 200); assert.equal(received, null);
  }
  const before = calls;
  await gateway.fetch(request('/', { headers: { 'x-steer-session-view': 'spoofed-value' } })); assert.equal(received, null); assert.equal(calls, before);
  await gateway.fetch(request('/', { headers: { cookie: '__Host-steer-session=synthetic', authorization: 'Bearer synthetic' } }));
  assert.equal(received, null); assert.equal(calls, before);
});
