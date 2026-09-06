import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { briefWriteAuthoritySchema } from '@steer/tool-registry';
import { providerProofFixture as fixture } from './gate-proof-fixture.ts';
import { createGitGateObserver } from '../src/code-host/gate-observation.ts';
import type { RepositoryReader } from '../src/code-host/github.ts';

const base = '2026-09-06T12:00:00', at = (fraction: string) => `${base}.${fraction}Z`;
const revision = 'a'.repeat(40), head = 'b'.repeat(40), hash = (value: string) => createHash('sha256').update(value).digest('hex');

test('real Ed25519 verification binds complete provider claims and returns immutable non-authority evidence', () => {
  const f = fixture(), envelope = f.encode(), result = f.evaluate(envelope); assert.ok(result);
  assert.equal(result.payloadDigest, hash(envelope.payload)); assert.equal(result.proofDigest, hash(JSON.stringify(envelope)));
  assert.equal(result.trustDigest, hash(JSON.stringify(f.trust))); assert.deepEqual(result.claims, f.payload);
  assert.equal(result.currentSourceVerificationRequired, true); assert.equal(result.qualificationVerificationRequired, true);
  assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false); assert.equal(briefWriteAuthoritySchema.safeParse(result).success, false);
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.claims));
  assert.throws(() => { (result.claims as { subject: string }).subject = 'another-human'; }, TypeError);
  f.payload.subject = 'changed'; assert.equal(result.claims.subject, 'synthetic-human');
  assert.ok(!JSON.stringify(result).includes('signatureBase64'));
});
test('tampered content, wrong key, wrong domain separator and malformed signatures fail closed', () => {
  const f = fixture(), valid = f.encode();
  assert.equal(f.evaluate({ ...valid, payload: valid.payload.replace('synthetic-human', 'different-human') }), null);
  assert.equal(f.evaluate(fixture().encode(f.payload)), null);
  assert.equal(f.evaluate(f.raw(valid.payload, 'another-protocol\0')), null);
  for (const signatureBase64 of ['', 'A'.repeat(86) + '==', valid.signatureBase64.slice(0, -1), `${valid.signatureBase64}\n`])
    assert.equal(f.evaluate({ ...valid, signatureBase64 }), null);
});
test('every source coordinate, identity, session and linked evidence digest is independently pinned', () => {
  const f = fixture();
  for (const [field, original] of Object.entries(f.expected)) {
    const changed = typeof original === 'number' ? original + 1 : field.endsWith('Digest') ? 'f'.repeat(64)
      : field === 'artifactRevision' ? 'f'.repeat(40) : `${original}-different`;
    assert.equal(f.evaluate(undefined, undefined, { ...f.expected, [field]: changed }), null, field);
    assert.equal(f.evaluate(f.encode({ ...f.payload, [field]: changed })), null, field);
  }
  for (const change of [{ provider: 'other-provider' }, { issuer: 'https://other.synthetic.invalid' }, { keyId: 'other-key' },
    { organizationId: 'foreign' }, { repository: 'github:2' }]) assert.equal(f.evaluate(undefined, { ...f.trust, ...change }), null);
  assert.equal(f.evaluate(f.encode({ ...f.payload, hat: 'product-lead' })), null);
  assert.equal(f.evaluate(f.encode({ ...f.payload, signedAt: at('2') })), null); // Same instant, different source lexeme.
});
test('agent claims, forged qualifications and approval flags cannot become a human provider observation', () => {
  const f = fixture();
  for (const change of [{ type: 'agent' }, { qualifiedDomains: ['privacy'] }, { gateVerified: true }, { writeAuthorized: true },
    { authenticatedAt: null }, { sequence: 0 }]) assert.equal(f.evaluate(f.encode({ ...f.payload, ...change })), null);
  // A genuine provider can attest a send-back. Its signature is not gate approval.
  const expected = { ...f.expected, decision: 'send-back' };
  const result = f.evaluate(f.encode({ ...f.payload, decision: 'send-back' }), undefined, expected); assert.ok(result);
  assert.equal(result.claims.decision, 'send-back'); assert.equal(result.gateVerified, false);
});
test('schema-ordered byte contract rejects duplicate keys, different serialization and all outer extras', () => {
  const f = fixture(), valid = f.encode();
  for (const text of [JSON.stringify(f.payload, null, 2), valid.payload + '\n', '{"subject":"imposter",' + valid.payload.slice(1),
    JSON.stringify(Object.fromEntries(Object.entries(f.payload).reverse())), '\ud800', 'é'.repeat(9000)]) assert.equal(f.evaluate(f.raw(text)), null);
  for (const envelope of [null, {}, { ...valid, algorithm: 'none' }, { ...valid, payload: 42 }]) assert.equal(f.evaluate(envelope), null);
  assert.equal(f.evaluate(undefined, { ...f.trust, skipRevocation: true }), null);
  assert.equal(f.evaluate(undefined, undefined, { ...f.expected, approved: true }), null);
});
test('key activation, expiry and revocation use exact half-open nanosecond intervals', () => {
  const f = fixture();
  assert.ok(f.evaluate(undefined, { ...f.trust, notBefore: at('300000000') }));
  assert.equal(f.evaluate(undefined, { ...f.trust, notBefore: at('300000001') }), null);
  assert.ok(f.evaluate(undefined, { ...f.trust, notAfter: at('400000001') }));
  assert.equal(f.evaluate(undefined, { ...f.trust, notAfter: at('400000000') }), null);
  assert.ok(f.evaluate(undefined, { ...f.trust, revokedAt: at('400000001') }));
  assert.equal(f.evaluate(undefined, { ...f.trust, revokedAt: at('400000000') }), null);
  assert.equal(f.evaluate(undefined, { ...f.trust, revokedAt: at('399999999') }), null);
  for (const change of [{ notBefore: f.trust.notAfter }, { revokedAt: '2026-09-06T11:59:59Z' },
    { revokedAt: '2026-09-06T12:01:01Z' }, { publicKeyHex: 'invalid' }]) assert.equal(f.evaluate(undefined, { ...f.trust, ...change }), null);
});
test('authentication, signing, recording and evaluation cannot be reordered or rounded', () => {
  const f = fixture();
  for (const [change, wanted] of [
    [{ authenticatedAt: at('200000001') }, { ...f.expected, authenticatedAt: at('200000001') }],
    [{ recordedAt: at('199999999') }, f.expected],
    [{ recordedAt: at('400000001') }, f.expected],
  ] as const) assert.equal(f.evaluate(f.encode({ ...f.payload, ...change }), undefined, wanted), null);
  assert.ok(f.evaluate(undefined, undefined, undefined, at('300000000')));
  assert.equal(f.evaluate(undefined, undefined, undefined, at('299999999')), null);
  for (const time of [null, 0, `${base}.1234567890Z`, '2026-02-30T12:00:00Z']) assert.equal(f.evaluate(undefined, undefined, undefined, time), null);
});
test('old provider-recorded metadata is not upgraded to a signed proof and results cannot survive a revoked trust snapshot', () => {
  const f = fixture();
  assert.equal(f.evaluate({ type: 'provider-recorded', provider: 'openai-codex', sessionId: 'synthetic-thread', recordedAt: `${base}Z` }), null);
  assert.ok(f.evaluate()); f.trust.revokedAt = at('399999999'); assert.equal(f.evaluate(), null);
});
test('provider verifier composes with collected Git record bytes and rejects proof replay after a new record digest', async () => {
  let decision = 'approved', currentHead = head;
  const record = () => JSON.stringify({ version: 'steer-gate-signature/v1', organization: 'synthetic', productHome: 'https://github.com/synthetic/synthetic',
    item: 'synthetic-item', gate: 2, artifactRevision: revision, decision, artifacts: [{ path: 'EXAM.md', revision }],
    proof: { providerRecordId: 'synthetic-observation-1' },
    signatures: [{ subject: 'synthetic-human', hat: 'tech-lead', sequence: 1, signedAt: at('200000000') }] });
  const blob = (value: string) => createHash('sha1').update(`blob ${Buffer.byteLength(value)}\0`).update(value).digest('hex');
  const reader: RepositoryReader = {
    binding: { organizationId: 'synthetic', repositoryId: 1, installationId: 1, owner: 'synthetic', repository: 'synthetic', branch: 'synthetic' },
    readHead: async () => currentHead,
    readArtifact: async (path, at) => { const content = path === 'gates/record.json' ? record() : 'synthetic Exam';
      return { organizationId: 'synthetic', repositoryId: 1, path, revision: at, content, contentDigest: hash(content), blobSha: blob(content) }; },
    readInventory: async (_selection, at) => ({ organizationId: 'synthetic', repositoryId: 1, revision: at, treeSha: 'f'.repeat(40),
      entries: [{ path: 'gates/record.json', blobSha: blob(record()) }] }),
  };
  const observer = createGitGateObserver(reader, { scope: { organizationId: 'synthetic', repository: 'github:1', itemId: 'intent/0130' },
    gate: 2, artifactRevision: revision, artifactPaths: ['EXAM.md'], recordPath: 'gates/record.json', recordItem: 'synthetic-item' },
    async () => ({ subject: 'synthetic-observer', organizationId: 'synthetic', type: 'agent', hats: [], toolGrants: ['gate.observe'], expiresAt: new Date(Date.now() + 60000).toISOString() }));
  const bundle = await observer.collect({ sourceRevision: head, decisionDigest: hash(record()) }), f = fixture(bundle.decisionDigest);
  assert.ok(f.evaluate()); assert.equal(bundle.writeAuthorized, false);
  decision = 'send-back'; currentHead = '9'.repeat(40);
  const changed = await observer.collect({ sourceRevision: currentHead, decisionDigest: hash(record()) });
  assert.equal(f.evaluate(undefined, undefined, { ...f.expected, decisionDigest: changed.decisionDigest, decision }), null);
  await observer.shutdown();
});
