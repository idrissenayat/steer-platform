import assert from 'node:assert/strict';
import { test } from 'node:test';
import { briefWriteAuthoritySchema } from '@steer/tool-registry';
import { selectorIdentityFixture, identifySelection } from './gate-selector-identity-fixture.ts';
import { chain } from './gate-policy-chain-fixture.ts';

test('selector identity proof supports explicit humans and agents without becoming live login or gate authority', () => {
  for (const type of ['human', 'agent'] as const) {
    const f = selectorIdentityFixture(type), result = f.evaluate(); assert.ok(result);
    assert.equal(result.claims.type, type); assert.ok(result.claims.authenticationExpiresAt < result.evaluatedAt);
    assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.claims));
    assert.equal(result.trustBootstrapVerificationRequired, true); assert.equal(result.currentSourceVerificationRequired, true);
    assert.equal(result.selectorAuthorizationVerificationRequired, true); assert.equal(result.gateVerified, false);
    assert.equal(result.writeAuthorized, false); assert.equal(briefWriteAuthoritySchema.safeParse(result).success, false);
  }
});

test('identity scope, actor kind, exact session and both independent pins cannot substitute selected claims', () => {
  const f = selectorIdentityFixture();
  for (const change of [{ organizationId: 'foreign' }, { repository: 'github:2' }, { branch: 'foreign' },
    { identityIssuer: 'https://foreign.synthetic.invalid' }, { subject: 'other' }, { type: 'agent' }, { sessionId: 'other' },
    { authenticatedAt: '2026-09-07T12:00:00.100000001Z' }, { trustDigest: 'f'.repeat(64) }, { proofDigest: 'f'.repeat(64) }]) {
    assert.equal(f.evaluate(f.encode(), { ...f.expected(), ...change }), null);
  }
  for (const key of Object.keys(f.expected())) {
    const expected = { ...f.expected() } as Record<string, unknown>; delete expected[key]; assert.equal(f.evaluate(f.encode(), expected), null, key);
  }
});

test('identity signature domain and scoped attestor key remain independent of receipt hashes', () => {
  const f = selectorIdentityFixture();
  for (const proof of [{ ...f.encode(), signatureBase64: Buffer.alloc(64).toString('base64') },
    f.raw(JSON.stringify(f.payload), 'steer-gate-identity-attestation/v1\0'),
    f.raw(JSON.stringify(f.payload), 'steer-gate-selection-attestation/v1\0'),
    { ...f.encode(), payload: f.encode().payload.replace('synthetic-selector', 'tampered-selector') }]) {
    assert.equal(f.evaluate(proof, { ...f.expected(), proofDigest: f.digest(proof) }), null);
  }
  for (const change of [{ attestor: 'https://foreign.synthetic.invalid' }, { keyId: 'foreign' }, { publicKeyHex: 'f'.repeat(64) },
    { branch: 'foreign' }, { identityIssuer: 'https://foreign.synthetic.invalid' }]) {
    const trust = { ...f.trust, ...change }; assert.equal(f.evaluate(f.encode(), { ...f.expected(), trustDigest: f.digest(trust) }, trust), null);
  }
});

test('historical selector session and current trust use exact half-open nanosecond chronology', () => {
  for (const [change, allowed] of [
    [{ authenticationExpiresAt: '2026-09-07T12:00:00.200000001Z' }, true],
    [{ authenticationExpiresAt: '2026-09-07T12:00:00.200000000Z' }, false],
    [{ recordedAt: '2026-09-07T12:00:00.099999999Z' }, false],
    [{ recordedAt: '2026-09-07T12:00:00.250000000Z' }, false],
  ] as const) { const f = selectorIdentityFixture(); Object.assign(f.payload, change); assert.equal(f.evaluate() !== null, allowed); }
  for (const change of [{ selectedAt: '2026-09-07T12:00:00.099999999Z' }, { selectionRecordedAt: '2026-09-07T12:00:00.199999999Z' },
    { selectionRecordedAt: '2026-09-07T12:00:00.400000001Z' }]) {
    const f = selectorIdentityFixture(); assert.equal(f.evaluate(f.encode(), { ...f.expected(), ...change }), null);
  }
  for (const [change, allowed] of [
    [{ notBefore: '2026-09-07T12:00:00.100000000Z' }, true],
    [{ notBefore: '2026-09-07T12:00:00.100000001Z' }, false],
    [{ notAfter: '2026-09-07T12:00:00.400000000Z' }, false],
    [{ notAfter: '2026-09-07T12:00:00.400000001Z' }, true],
    [{ revokedAt: '2026-09-07T12:00:00.400000000Z' }, false],
    [{ revokedAt: '2026-09-07T12:00:00.400000001Z' }, true],
    [{ revokedAt: '2026-09-07T11:59:59Z' }, false],
    [{ revokedAt: '2026-09-07T12:02:00Z' }, false],
  ] as const) {
    const f = selectorIdentityFixture(); Object.assign(f.trust, change); assert.equal(f.evaluate() !== null, allowed);
    if (allowed && 'revokedAt' in change) assert.equal(f.evaluate()!.validBefore, change.revokedAt);
  }
});

test('closed identity encoding rejects token material, gate claims, duplicates, reordered and oversized bytes', () => {
  const f = selectorIdentityFixture();
  for (const text of [JSON.stringify({ ...f.payload, accessToken: 'not-a-token' }), JSON.stringify({ ...f.payload, gateVerified: true }),
    JSON.stringify(f.payload, null, 2), JSON.stringify(Object.fromEntries(Object.entries(f.payload).reverse())),
    JSON.stringify(f.payload).replace('"type":"human"', '"type":"agent","type":"human"'), '\ud800', 'x'.repeat(16385)]) {
    const proof = f.raw(text); assert.equal(f.evaluate(proof, { ...f.expected(), proofDigest: f.digest(proof) }), null);
  }
  const trust = Object.fromEntries(Object.entries(f.trust).reverse());
  assert.equal(f.evaluate(f.encode(), { ...f.expected(), trustDigest: f.digest(trust) }, trust), null);
  for (const time of [null, 0, '2026-02-30T00:00:00Z', '2026-09-07T12:00:00.1000000001Z']) assert.equal(f.evaluate(f.encode(), f.expected(), f.trust, time), null);
});

test('native Git joins exact selector identity session with independently retained historical/current grants', async t => {
  const f = chain(t, 2, true), selected = identifySelection(f, 'agent'), collector = f.create(selected.configuration); t.after(() => collector.shutdown());
  const result = await collector.collect(f.input()); assert.ok(result.selectorIdentity); assert.ok(result.selectorAuthorization);
  assert.equal(result.selectorIdentity.claims.type, 'agent'); assert.equal(result.selectorIdentity.proofDigest, selected.reference.proof.digest);
  assert.equal(result.selectorIdentity.claims.sessionId, result.selectionAttestation!.claims.selectorSessionId);
  assert.equal(result.selectorAuthorization.historicalSource.revision, selected.authorization.historicalRevision);
  assert.equal(result.governedSelectionVerificationRequired, true); assert.equal(result.writeAuthorized, false);
  selected.identity.trust.revokedAt = new Date(Date.now()).toISOString(); selected.publishIdentity();
  // A new current source and coherently repinned genuine receipts still cannot hide revocation.
  const revoked = f.create(selected.configuration); t.after(() => revoked.shutdown());
  await assert.rejects(revoked.collect(f.input()), /could not be verified/);
});

test('selection receipt signs every identity coordinate atomically and cannot downgrade to grants only', async t => {
  for (const mode of ['session', 'authenticated', 'proof', 'trust', 'downgrade', 'legacy']) {
    const f = chain(t, 2), selected = identifySelection(f), config = structuredClone(selected.configuration);
    if (mode === 'session') config.selection.attestation.authorization.identity.sessionId = 'other';
    if (mode === 'authenticated') config.selection.attestation.authorization.identity.authenticatedAt = new Date(Date.now() - 1000).toISOString();
    if (mode === 'proof') config.selection.attestation.authorization.identity.proof.digest = 'f'.repeat(64);
    if (mode === 'trust') config.selection.attestation.authorization.identity.trust.digest = 'f'.repeat(64);
    if (mode === 'downgrade') Reflect.deleteProperty(config.selection.attestation.authorization, 'identity');
    if (mode === 'legacy') {
      for (const key of ['selectorSessionId', 'selectorAuthenticatedAt', 'selectorIdentityDigest', 'selectorIdentityTrustDigest']) Reflect.deleteProperty(selected.proof.payload, key);
      selected.publish(); config.selection.attestation.proof.digest = selected.attestation.proof.digest;
    }
    const collector = f.create(config); await assert.rejects(collector.collect(f.input()), /could not be verified/); await collector.shutdown(); assert.equal(f.reads.length, 3);
  }
  const f = chain(t, 2), selected = identifySelection(f);
  for (const key of ['selectorSessionId', 'selectorAuthenticatedAt', 'selectorIdentityDigest', 'selectorIdentityTrustDigest']) {
    const expected = { ...selected.proof.expected() } as Record<string, unknown>; delete expected[key];
    assert.equal(selected.proof.evaluate(selected.proof.encode(), expected, selected.proof.trust, new Date().toISOString()), null, key);
  }
});

test('genuine repinned identity claims cannot replace the selection actor, issuer or historical session', async t => {
  for (const change of [{ subject: 'other' }, { type: 'agent' }, { identityIssuer: 'https://other.synthetic.invalid' },
    { sessionId: 'other' }, { authenticatedAt: '2026-09-01T00:00:00Z' }, { authenticationExpiresAt: '2026-09-01T00:00:00Z' }]) {
    const f = chain(t, 2), selected = identifySelection(f); Object.assign(selected.identity.payload, change); selected.publishIdentity();
    const collector = f.create(selected.configuration); await assert.rejects(collector.collect(f.input()), /could not be verified/); await collector.shutdown(); assert.equal(f.reads.length, 7);
  }
});

test('identity source byte corruption, head movement and observer loss deny before policy adoption', async t => {
  for (const mode of ['blob', 'digest', 'revision', 'tenant', 'head', 'observer', 'missing']) {
    const f = chain(t, 2), selected = identifySelection(f), original = f.reader.readArtifact;
    f.reader.readArtifact = async (path, revision) => {
      const value = await original(path, revision); if (path !== selected.reference.proof.path) return value;
      if (mode === 'missing') throw new Error('private source failure');
      if (mode === 'head') f.state.head = 'f'.repeat(40); if (mode === 'observer') f.state.identity = null;
      return { ...value, ...(mode === 'blob' ? { blobSha: 'f'.repeat(40) } : mode === 'digest' ? { contentDigest: 'f'.repeat(64) } :
        mode === 'revision' ? { revision: 'f'.repeat(40) } : mode === 'tenant' ? { organizationId: 'foreign' } : {}) };
    };
    const collector = f.create(selected.configuration); await assert.rejects(collector.collect(f.input()), /could not be verified/); await collector.shutdown(); assert.equal(f.reads.length, 7);
  }
});

test('identity trust expiry and scheduled revocation are rechecked after the last policy read with positive control', async t => {
  for (const mode of ['before', 'expiry', 'revocation']) {
    const f = chain(t, 2), selected = identifySelection(f), realNow = Date.now, base = realNow(); let offset = 0, reached = false;
    Date.now = () => realNow() + offset;
    selected.identity.trust[mode === 'revocation' ? 'revokedAt' : 'notAfter'] = new Date(base + 1000).toISOString(); selected.publishIdentity();
    const original = f.reader.readArtifact, boundary = f.config.gates[1]!.domainAssurance!.reviews.at(-1)!.path;
    f.reader.readArtifact = async (path, revision) => { const value = await original(path, revision); if (path === boundary) {
      reached = true; offset = Math.max(offset, base + (mode === 'before' ? 500 : 1000) - realNow()); } return value; };
    const collector = f.create(selected.configuration);
    try {
      if (mode === 'before') assert.ok((await collector.collect(f.input())).selectorIdentity);
      else await assert.rejects(collector.collect(f.input()), /could not be verified/);
      assert.equal(reached, true);
    } finally { Date.now = realNow; await collector.shutdown(); }
  }
});

test('identity source paths cannot alias grant, selection, trust, proof or policy roles before I/O', t => {
  const f = chain(t, 2), selected = identifySelection(f);
  for (const path of [selected.authorization.path, selected.attestation.trust.path, selected.attestation.proof.path,
    selected.configuration.selection.path, selected.reference.trust.path, f.config.gates[0]!.policy.path]) {
    const config = structuredClone(selected.configuration); config.selection.attestation.authorization.identity.proof.path = path;
    assert.throws(() => f.create(config), /Invalid gate policy selection/);
  }
  assert.equal(f.reads.length, 0);
});
