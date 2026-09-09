import assert from 'node:assert/strict';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createGitHubReader } from '@steer/adapters/github';
import { createGitAuthorizationResolver } from '@steer/adapters/authorization';
import { createOidcContextAuthenticator } from '@steer/adapters/identity';
import { fixture, binding, now } from '../../../packages/adapters/test/github-brief-fixture.ts';
import { corpusBatchPrototypeFixture } from './corpus-batch-prototype.fixture.ts';
import { collectCorpusBatchPrototype } from './corpus-batch-prototype.ts';

/** TEST ONLY. Real signature verification and Git grant resolver over two owned
 * native object databases; no HTTP app, records implementation or live transport. */
async function authorizedFixture(t: { after(run: () => void): void }) {
  const corpus = await corpusBatchPrototypeFixture(t), grants = fixture(t);
  const issuer = 'https://synthetic.identity.invalid', path = 'access/corpus.json';
  const clock = { date: now }, epoch = now.getTime() / 1000;
  const record = { issuer, subject: 'synthetic-human', organizationId: binding.organizationId,
    type: 'human' as const, hats: ['product-lead'], toolGrants: ['intent.scope.read'], active: true,
    validAfter: new Date(now.getTime() - 60000).toISOString(), expiresAt: new Date(now.getTime() + 3600000).toISOString() };
  const publish = (value = record) => grants.add([{ path, content: JSON.stringify({
    version: 'steer-authorization/v1', organizationId: binding.organizationId, records: [value],
  }) }]);
  publish();
  const wire: Array<{ origin: 'authorization' | 'jwks'; kind: string }> = [];
  const reader = createGitHubReader(binding, { now: () => clock.date, appJwt: async () => 'synthetic-app-jwt',
    fetch: async (input, init) => {
      const url = new URL(String(input));
      const kind = url.pathname.includes('/access_tokens') ? 'token' : url.pathname.includes('/git/ref/') ? 'head'
        : url.pathname.includes('/git/commits/') ? 'commit' : url.pathname.includes('/git/trees/') ? 'tree'
        : url.pathname.includes('/git/blobs/') ? 'blob' : 'unexpected';
      assert.notEqual(kind, 'unexpected'); wire.push({ origin: 'authorization', kind });
      return grants.transport(input, init);
    } });
  const resolve = createGitAuthorizationResolver(reader, path); t.after(resolve.close);
  const keys = await generateKeyPair('RS256'), publicKey = { ...await exportJWK(keys.publicKey), kid: 'synthetic-corpus', alg: 'RS256' };
  const bearer = await new SignJWT({ typ: 'Bearer', azp: 'steer-web', steer_org: record.organizationId,
    steer_kind: record.type, steer_hats: record.hats }).setProtectedHeader({ alg: 'RS256', kid: publicKey.kid, typ: 'JWT' })
    .setSubject(record.subject).setIssuer(issuer).setAudience('steer-api').setIssuedAt(epoch).setExpirationTime(epoch + 180).sign(keys.privateKey);
  const authenticate = createOidcContextAuthenticator({ issuer, jwksUri: `${issuer}/jwks`, audience: 'steer-api', clientIds: ['steer-web'] }, {
    resolveAuthorization: resolve, now: () => clock.date,
    fetch: async input => { assert.equal(String(input), `${issuer}/jwks`); wire.push({ origin: 'jwks', kind: 'jwks' }); return Response.json({ keys: [publicKey] }); },
  });
  const request = new Request('https://synthetic.application.invalid/corpus-experiment', { headers: { authorization: `Bearer ${bearer}` } });
  async function run(phases = 1, between?: () => void) {
    return resolve.withinRequest(async () => {
      let initial: Awaited<ReturnType<typeof authenticate>>;
      const current = async () => {
        const context = await authenticate(request), principal = context?.principal;
        if (!context || !principal || principal.subject !== record.subject || principal.organizationId !== binding.organizationId
          || principal.type !== 'human' || !principal.toolGrants.includes('intent.scope.read')
          || (initial && (context.sessionBinding !== initial.sessionBinding || context.issuer !== initial.issuer))) {
          throw new Error('Synthetic corpus caller denied.');
        }
        initial ??= context;
      };
      const beforeWire = wire.length, beforeRepository = corpus.wire.length;
      await current();
      const bootstrapAttempts = wire.length - beforeWire, snapshots = [];
      for (let phase = 0; phase < phases; phase++) {
        if (phase) between?.();
        const start = wire.length + corpus.wire.length;
        const value = await collectCorpusBatchPrototype(corpus.binding, corpus.evidence.productId, corpus.repository, corpus.authority, current);
        snapshots.push({ revision: value.revision, files: value.files.length, semantic: value.semantic.length,
          attempts: wire.length + corpus.wire.length - start });
      }
      const total = wire.length - beforeWire + corpus.wire.length - beforeRepository;
      return { bootstrapAttempts, snapshots, total,
        identity: wire.slice(beforeWire).reduce((out, item) => ({ ...out, [item.kind]: (out[item.kind] ?? 0) + 1 }), {} as Record<string, number>),
        corpus: corpus.wire.slice(beforeRepository).reduce((out, item) => ({ ...out, [item.kind]: (out[item.kind] ?? 0) + 1 }), {} as Record<string, number>) };
    });
  }
  return { corpus, grants, record, clock, wire, publish, run };
}

test('real OIDC and Git grants resolver expose cold bootstrap separately from each independent corpus phase', async t => {
  const f = await authorizedFixture(t);
  const cold = await f.run(), nextRequest = await f.run();
  const separated = await f.run(2, () => f.corpus.native.git.add([{ path: 'synthetic-control-phase.md', content: 'second independent source phase\n' }]));
  assert.equal(cold.bootstrapAttempts, 7); assert.equal(cold.snapshots[0]!.attempts, 26); assert.equal(cold.total, 33);
  assert.equal(nextRequest.bootstrapAttempts, 5); assert.equal(nextRequest.total, 31);
  assert.equal(separated.bootstrapAttempts, 5); assert.equal(separated.total, 57);
  assert.deepEqual(separated.snapshots.map(s => s.attempts), [26, 26]);
  assert.notEqual(separated.snapshots[0]!.revision, separated.snapshots[1]!.revision);
  for (const result of [cold, nextRequest, separated]) {
    assert.equal(result.identity.blob, 1); // Immutable grant bytes are NOT retained across requests.
    for (const snapshot of result.snapshots) { assert.equal(snapshot.files, 42); assert.equal(snapshot.semantic, 34); }
  }
  assert.equal(f.grants.mutations(), 0); assert.equal(f.corpus.native.git.mutations(), 0);
  console.log('Synthetic corpus authorization feasibility: ' + JSON.stringify({ cold, nextRequest, separated,
    signedJwtVerified: true, gitAuthorizationResolverUsed: true, sourceMetadataAuthoritySynthetic: true,
    httpRegistryAndRecordsIntegrated: false, wholeJourneyPerformanceAccepted: false, productionInstalled: false }));
});

test('current native Git revocation and removed tool grant prevent release after a batch', async t => {
  const f = await authorizedFixture(t);
  for (const mode of ['inactive', 'tool-grant', 'foreign-subject'] as const) {
    f.publish(); const before = f.corpus.queries.length; let changed = false;
    f.corpus.afterQuery(() => {
      if (changed) return; changed = true;
      f.publish({ ...f.record, ...(mode === 'inactive' ? { active: false } : mode === 'tool-grant' ? { toolGrants: [] } : { subject: 'foreign-human' }) });
    });
    await assert.rejects(f.run()); assert.equal(f.corpus.queries.length, before + 1);
  }
});

test('token expiry during a query and initial inactive membership deny without later source dispatch', async t => {
  const f = await authorizedFixture(t);
  f.publish({ ...f.record, active: false }); await assert.rejects(f.run()); assert.equal(f.corpus.queries.length, 0);
  f.publish(); f.corpus.afterQuery(() => { f.clock.date = new Date(now.getTime() + 181000); });
  await assert.rejects(f.run()); assert.equal(f.corpus.queries.length, 1);
});
