import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import type { BrowserSessionStore } from '@steer/adapters/browser-session';
import type { AuthorizationRecord } from '@steer/adapters/identity';
import { createGitBackedBrowserApi } from '../src/git-browser.ts';
import { createGitAuthorizationHarness } from './git-authorization-harness.ts';

const configuration = { issuer: 'https://id.example/realm', jwksUri: 'https://id.example/jwks',
  authorizationEndpoint: 'https://id.example/auth', tokenEndpoint: 'https://id.example/token',
  redirectUri: 'https://steer.example/auth/callback', clientId: 'steer-web',
  clientSecret: 'synthetic-test-secret-not-a-real-credential', audience: 'steer-api' };
const store: BrowserSessionStore = {
  insertTransaction: async () => { throw new Error('Unexpected session write.'); },
  consumeTransaction: async () => undefined, insertSession: async () => { throw new Error('Unexpected session write.'); },
  readSession: async () => undefined, deleteSession: async () => {},
};

test('Git-backed composition binds bearer authority to current commits and ignores an injected resolver override', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'steer-0020-'));
  try {
    const now = new Date('2026-09-05T05:00:00Z');
    const grant: AuthorizationRecord = { issuer: configuration.issuer, subject: 'synthetic-human', organizationId: 'synthetic-org',
      type: 'human', hats: ['product-lead'], toolGrants: ['session.context'], active: true,
      validAfter: new Date(0).toISOString(), expiresAt: new Date(now.getTime() + 300000).toISOString() };
    const source = await createGitAuthorizationHarness(temporary, grant);
    const keys = await generateKeyPair('RS256');
    const jwk = { ...await exportJWK(keys.publicKey), kid: 'synthetic', alg: 'RS256' };
    let overrideCalls = 0;
    const dependencies = { ...source, store, now: () => now,
      resolveAuthorization: async () => { overrideCalls++; return grant; },
      fetch: async (input: string | URL | Request) => {
        assert.equal(String(input), configuration.jwksUri); return Response.json({ keys: [jwk] });
      } };
    const app = createGitBackedBrowserApi(configuration, dependencies);
    const token = await new SignJWT({ iss: configuration.issuer, sub: grant.subject, aud: configuration.audience,
      azp: configuration.clientId, typ: 'Bearer', steer_org: grant.organizationId, steer_kind: 'human', steer_hats: grant.hats,
      iat: now.getTime() / 1000, exp: now.getTime() / 1000 + 180 }).setProtectedHeader({ alg: 'RS256', kid: 'synthetic' }).sign(keys.privateKey);
    const tool = () => app.request('https://steer.example/v1/tools/session.context', { method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ organizationId: grant.organizationId }) });
    assert.equal((await tool()).status, 200);
    for (const records of [[{ ...grant, active: false }], [], [grant, grant], [{ ...grant, organizationId: 'foreign-org' }]]) {
      await source.publish(records); assert.equal((await tool()).status, 401);
    }
    await source.publish([grant]); assert.equal((await tool()).status, 200);
    for (const fault of ['unavailable', 'moving-head', 'digest'] as const) {
      source.setFault(fault); assert.equal((await tool()).status, 401);
      source.setFault('none'); assert.equal((await tool()).status, 200);
    }
    assert.equal(overrideCalls, 0);
    assert.equal((await app.request('https://steer.example/health/ready')).status, 503);
    for (const authorizationPath of ['', '../members.json', '/members.json', 'a//b', 'a\\b', 'a\u0000b', 'a'.repeat(501)]) {
      assert.throws(() => createGitBackedBrowserApi(configuration, { ...dependencies, authorizationPath }), /Invalid authorization source configuration/);
    }
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
