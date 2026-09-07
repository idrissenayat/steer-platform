import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { exportJWK, generateKeyPair, SignJWT, jwtVerify } from 'jose';
import { chain } from '../../../packages/adapters/test/gate-policy-chain-fixture.ts';

/** Test-only source chain with real native Git and synthetic signature/JWKS keys. No network fallback. */
export async function heldRuntimeFixture(t: { after: (cleanup: () => void) => void }, blocked = false,
  human = { organizationId: 'synthetic', issuer: 'https://identity.synthetic.invalid', subject: 'synthetic-runtime-human' }) {
  const f = chain(t, 2, true, human.organizationId), binding = f.reader.binding, issuer = human.issuer;
  if (blocked) f.change(f.config.gates[0]!.critic, value => { value.critic.passed = false; });
  const authorizationPath = 'access/writers.json', epoch = Math.floor(Date.now() / 1000);
  const grant = { issuer, organizationId: binding.organizationId, subject: human.subject, type: 'human', hats: ['product-lead'],
    toolGrants: ['session.context', 'intent.brief.destination', 'intent.brief.preview', 'intent.brief.save', 'intent.brief.save.status'], active: true,
    validAfter: new Date((epoch - 30) * 1000).toISOString(), expiresAt: new Date((epoch + 180) * 1000).toISOString() };
  const publishGrant = (record = grant) => { f.sources.set(authorizationPath, JSON.stringify({ version: 'steer-authorization/v1', organizationId: binding.organizationId, records: [record] })); f.commit(); };
  publishGrant();
  const appKeys = generateKeyPairSync('rsa', { modulusLength: 2048 }), identityKeys = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(identityKeys.publicKey), kid: 'synthetic', alg: 'RS256' };
  const token = await new SignJWT({ typ: 'Bearer', azp: 'steer-web', steer_org: binding.organizationId, steer_kind: 'human', steer_hats: ['product-lead'] })
    .setProtectedHeader({ alg: 'RS256', kid: 'synthetic', typ: 'JWT' }).setSubject(grant.subject).setIssuer(issuer).setAudience('steer-api')
    .setIssuedAt(epoch).setExpirationTime(epoch + 180).sign(identityKeys.privateKey);
  const writer = { organizationId: binding.organizationId, repository: `github:${binding.repositoryId}`, branch: binding.branch,
    paths: ['items/0169-held/BRIEF.md'], platformRevision: f.config.gates[1]!.signerCollection.gateSource.artifactRevision,
    gate2DecisionDigest: f.input().decisionDigest };
  const profile = { version: 'steer-identity-runtime/v1', browser: { issuer, jwksUri: `${issuer}/jwks`, authorizationEndpoint: `${issuer}/auth`, tokenEndpoint: `${issuer}/token`,
    redirectUri: 'https://steer.example/auth/callback', clientId: 'steer-web', audience: 'steer-api' },
    github: { appId: '1', authorizationPath, binding }, database: { host: '127.0.0.1', port: 5432, database: 'unused_synthetic', transport: { kind: 'isolated-loopback-test' } },
    sessionKeyId: 'synthetic', heldBrief: { writer, policy: f.config } };
  const secrets = { browserClientSecret: 'synthetic-secret', databasePassword: 'unused-synthetic', sessionKeys: { synthetic: randomBytes(32) },
    githubPrivateKeyPem: appKeys.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString() };
  const io = { reads: 0, tokens: 0, writes: 0, failRead: false, observerCalls: 0, jwks: 0 };
  const rawGit = (...args: string[]) => execFileSync('git', ['-C', f.directory!, '-c', 'core.hooksPath=/dev/null', ...args]);
  const commit = (revision: string) => {
    assert.match(revision, /^[a-f0-9]{40}$/); const content = rawGit('cat-file', '-p', revision).toString('utf8');
    return { sha: revision, tree: { sha: /^tree ([a-f0-9]{40})$/m.exec(content)![1]! }, parents: [...content.matchAll(/^parent ([a-f0-9]{40})$/gm)].map(value => ({ sha: value[1]! })) };
  };
  const github: typeof fetch = async (input, init) => {
    const url = new URL(String(input)), headers = new Headers(init?.headers); assert.equal(url.origin, 'https://api.github.com');
    assert.equal(init?.redirect, 'error'); assert.equal(init?.cache, 'no-store');
    if (url.pathname === '/app/installations/1/access_tokens') {
      io.tokens++; const body = JSON.parse(String(init?.body)); if (body.permissions.contents !== 'read') io.writes++;
      assert.equal(init?.method, 'POST'); assert.deepEqual(body, { repository_ids: [1], permissions: { contents: 'read' } });
      await jwtVerify(headers.get('authorization')!.replace(/^Bearer /, ''), appKeys.publicKey, { issuer: '1', algorithms: ['RS256'] });
      return Response.json({ token: 'synthetic-read', expires_at: new Date(Date.now() + 3600000).toISOString(), permissions: { contents: 'read', metadata: 'read' }, repositories: [{ id: 1, full_name: 'synthetic/synthetic' }] });
    }
    if (init?.method !== 'GET') io.writes++; assert.equal(init?.method, 'GET'); assert.equal(headers.get('authorization'), 'Bearer synthetic-read'); io.reads++;
    if (io.failRead) return new Response(null, { status: 503 });
    const prefix = '/repos/synthetic/synthetic'; assert.ok(url.pathname.startsWith(prefix + '/')); const route = url.pathname.slice(prefix.length);
    if (route === '/git/ref/heads/synthetic') return Response.json({ ref: 'refs/heads/synthetic', object: { type: 'commit', sha: f.state.head } });
    if (route.startsWith('/git/commits/')) return Response.json(commit(route.slice('/git/commits/'.length)));
    if (route.startsWith('/git/trees/')) {
      const sha = route.slice('/git/trees/'.length); assert.match(sha, /^[a-f0-9]{40}$/);
      const tree = rawGit('ls-tree', '-rtz', sha).toString('utf8').split('\0').filter(Boolean).map(row => {
        const value = /^(\d+) (\w+) ([a-f0-9]{40})\t([\s\S]+)$/.exec(row)!; return { mode: value[1], type: value[2], sha: value[3], path: value[4] };
      }); return Response.json({ sha, truncated: false, tree });
    }
    if (route.startsWith('/git/blobs/')) {
      const sha = route.slice('/git/blobs/'.length); assert.match(sha, /^[a-f0-9]{40}$/); const bytes = rawGit('cat-file', 'blob', sha);
      return Response.json({ sha, encoding: 'base64', content: bytes.toString('base64'), size: bytes.length });
    }
    assert.equal(route, '/commits'); const revision = url.searchParams.get('sha')!, path = url.searchParams.get('path')!;
    assert.match(revision, /^[a-f0-9]{40}$/); assert.equal(url.searchParams.get('per_page'), '2'); assert.match(path, /^\.steer\/authoring\/operations\/[a-f0-9-]+\.json$/);
    const revisions = rawGit('log', '--format=%H', '-2', revision, '--', path).toString('utf8').trim();
    return Response.json(revisions ? revisions.split('\n').map(commit) : []);
  };
  return { ...f, profile, secrets, grant, publishGrant, token, io, ports: { github,
    identity: async (input: Parameters<typeof fetch>[0]) => { assert.equal(String(input), `${issuer}/jwks`); io.jwks++; return Response.json({ keys: [jwk] }); },
    authenticateGateObserver: async () => { io.observerCalls++; return f.state.identity; } } };
}
