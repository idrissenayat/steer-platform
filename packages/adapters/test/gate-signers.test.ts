import assert from 'node:assert/strict';
import { test } from 'node:test';
import { briefWriteAuthoritySchema } from '@steer/tool-registry';
import { parseUtcInstant } from '@steer/tool-registry/gate-policy';
import { fixture, hash } from './gate-signers-fixture.ts';

const failure = /^Error: Gate signer collection could not be verified\.$/;

test('native Git canonical record/artifacts and every signer compose through real identity, provider and qualification verification', async (t) => {
  const f = fixture(t, true), service = f.create(), result = await service.collect(f.input());
  assert.equal(result.record.signatures.length, 2); assert.equal(result.signerObservations.length, 2);
  assert.deepEqual(result.record.signatures.map((entry) => entry.hat), ['tech-lead', 'specialist']);
  assert.deepEqual(result.record.signatures[1]!.qualifiedDomains, ['privacy']); assert.equal(result.bundle.record.content, JSON.stringify(f.record));
  assert.equal(result.currentSignerRevalidationRequired, true); assert.equal(result.policyVerificationRequired, true);
  assert.equal(result.currentEvidenceValidity.evaluatedAt, result.evaluatedAt);
  assert.equal(result.currentEvidenceValidity.sourceRevalidationRequired, true);
  assert.ok(parseUtcInstant(result.currentEvidenceValidity.validBefore)! > parseUtcInstant(result.evaluatedAt)!);
  assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false); assert.equal(briefWriteAuthoritySchema.safeParse(result).success, false);
  for (const value of [result, result.record, result.record.signatures, result.signerObservations, ...result.record.signatures,
    result.currentEvidenceValidity, ...result.signerObservations.map((entry) => entry.currentEvidenceValidity)]) assert.ok(Object.isFrozen(value));
  assert.ok(f.state.authCalls >= 8); await service.shutdown(); await assert.rejects(service.collect(f.input()), failure);
});

test('missing, reordered, duplicate or misbound configured signers cannot create a plausible roster', (t) => {
  const f = fixture(t);
  for (const signers of [[], [...f.config.signers].reverse(), [f.config.signers[0], f.config.signers[0]]]) assert.throws(() => f.create({ ...f.config, signers }));
  for (const change of [{ itemId: 'another' }, { artifactRevision: 'd'.repeat(40) }, { gate: 3 }, { organizationId: 'foreign' }]) {
    const signers = structuredClone(f.config.signers); Object.assign(signers[0]!.proof.expected, change); assert.throws(() => f.create({ ...f.config, signers }));
  }
  const missing = structuredClone(f.config); delete missing.signers[1]!.source.specialistQualification; assert.throws(() => f.create(missing));
  assert.equal(f.state.reads.length, 0); assert.equal(f.state.authCalls, 0);
});

test('canonical roster mismatch rejects before any signer-specific source lookup, even after repinning the exact record', async (t) => {
  for (const mode of ['missing', 'extra', 'order', 'subject', 'time', 'type', 'session']) {
    const f = fixture(t);
    if (mode === 'missing') f.record.signatures.pop();
    if (mode === 'extra') f.record.signatures.push({ ...f.record.signatures[0]! });
    if (mode === 'order') f.record.signatures.reverse();
    if (mode === 'subject') f.record.signatures[0]!.subject = 'other';
    if (mode === 'time') f.record.signatures[0]!.signedAt = new Date(0).toISOString();
    if (mode === 'type') Object.assign(f.record.signatures[0]!, { type: 'agent' });
    if (mode === 'session') Object.assign(f.record.signatures[0]!, { sessionId: 'other-session' });
    f.repin(); await assert.rejects(f.create().collect(f.input()), failure);
    assert.ok(f.state.reads.every((path) => path === 'BRIEF.md' || path === 'gates/record.json'));
  }
});

test('one valid signer never hides a missing or forged second proof or an unsupported qualified-domain claim', async (t) => {
  for (const mode of ['missing', 'forged', 'domains']) {
    const f = fixture(t), second = f.config.signers[1]!;
    if (mode === 'missing') f.sources.delete(second.proof.identityProofPath);
    if (mode === 'forged') { const proof = f.providers[1]!.encode(); proof.signatureBase64 = Buffer.alloc(64).toString('base64');
      f.sources.set(second.proof.proofPath, JSON.stringify(proof)); second.proof.proofDigest = hash(JSON.stringify(proof)); }
    if (mode === 'domains') { Object.assign(f.record.signatures[1]!, { qualifiedDomains: ['money'] }); f.repin(); }
    await assert.rejects(f.create().collect(f.input()), failure);
    assert.ok(f.state.reads.includes(f.config.signers[0]!.proof.identityProofPath));
  }
});

test('changed artifact, moved final head and service actor replacement discard the assembled signer set', async (t) => {
  for (const mode of ['artifact', 'head', 'actor']) {
    const f = fixture(t), read = f.reader.readArtifact, finalPath = f.config.signers[1]!.source.specialistQualification!.proofPath;
    f.reader.readArtifact = async (...args) => { const result = await read(...args); if (args[0] === finalPath) {
      if (mode === 'artifact') f.sources.set('BRIEF.md', 'changed');
      if (mode === 'head') f.state.head = 'd'.repeat(40);
      if (mode === 'actor') f.state.identity = { ...(f.state.identity as object), subject: 'replacement-agent' };
    } return result; };
    await assert.rejects(f.create().collect(f.input()), failure);
  }
});

test('send-back evidence is retained as send-back, not silently upgraded to approval', async (t) => {
  const f = fixture(t); f.record.decision = 'send-back';
  for (const provider of f.providers) { provider.expected.decision = 'send-back'; provider.payload.decision = 'send-back'; }
  f.repin(); const result = await f.create().collect(f.input()); assert.equal(result.record.decision, 'send-back'); assert.equal(result.gateVerified, false);
});

test('all signers must still be valid at final collection time, including scheduled revocation and exact expiry', async (t) => {
  const realNow = Date.now;
  try {
    for (const mode of ['provider-expiry', 'provider-revocation', 'identity-expiry', 'identity-revocation', 'hat-expiry',
      'qualification-key-expiry', 'qualification-key-revocation', 'qualification-expiry', 'qualification-revocation']) {
      const f = fixture(t), first = f.config.signers[0]!, second = f.config.signers[1]!, base = realNow(), deadline = new Date(base + 1000).toISOString();
      if (mode.startsWith('provider-') || mode.startsWith('identity-')) {
        const source = mode.startsWith('provider-') ? first.source : first.source.signerIdentity;
        const trust = JSON.parse(f.sources.get(source.trustPath)!);
        trust[mode.endsWith('expiry') ? 'notAfter' : 'revokedAt'] = deadline;
        f.sources.set(source.trustPath, JSON.stringify(trust)); source.trustDigest = hash(JSON.stringify(trust));
      } else if (mode === 'hat-expiry') {
        const path = first.source.signerAuthorization.path, document = JSON.parse(f.sources.get(path)!);
        document.records[0].expiresAt = deadline; f.sources.set(path, JSON.stringify(document));
      } else {
        const selected = second.source.specialistQualification!, qualification = f.qualifications[1]!;
        if (mode.startsWith('qualification-key-')) {
          qualification.trust[mode.endsWith('expiry') ? 'notAfter' : 'revokedAt'] = deadline;
          f.sources.set(selected.trustPath, JSON.stringify(qualification.trust)); selected.trustDigest = hash(JSON.stringify(qualification.trust));
        } else {
          qualification.payload[mode.endsWith('expiry') ? 'validThrough' : 'revokedAt'] = deadline;
          f.sources.set(selected.proofPath, JSON.stringify(qualification.encode())); selected.proofDigest = hash(f.sources.get(selected.proofPath)!);
        }
      }
      let clock = base, recordReads = 0; Date.now = () => clock;
      const read = f.reader.readArtifact;
      f.reader.readArtifact = async (...args) => { const value = await read(...args);
        // Every individual signer has returned successfully before this final recollection.
        if (args[0] === f.config.gateSource.recordPath && ++recordReads === 2) clock = base + 1000;
        return value;
      };
      await assert.rejects(f.create().collect(f.input()), failure, mode);
      assert.equal(recordReads, 2, mode); Date.now = realNow;
    }
  } finally { Date.now = realNow; }
});

test('the shared validity bound retains nanoseconds and excludes the exact endpoint without rounding', async (t) => {
  const realNow = Date.now;
  try {
    for (const difference of [-1, 0, 1]) {
      const f = fixture(t), base = realNow(), final = base + 1000, first = f.config.signers[0]!;
      const deadline = difference === -1 ? new Date(final - 1).toISOString().replace('Z', '999999Z') :
        new Date(final).toISOString().replace('Z', difference === 1 ? '000001Z' : '000000Z');
      const trust = JSON.parse(f.sources.get(first.source.trustPath)!); trust.notAfter = deadline;
      f.sources.set(first.source.trustPath, JSON.stringify(trust)); first.source.trustDigest = hash(JSON.stringify(trust));
      let clock = base, recordReads = 0; Date.now = () => clock; const read = f.reader.readArtifact;
      f.reader.readArtifact = async (...args) => { const result = await read(...args);
        if (args[0] === f.config.gateSource.recordPath && ++recordReads === 2) clock = final;
        return result;
      };
      const pending = f.create().collect(f.input());
      if (difference <= 0) await assert.rejects(pending, failure);
      else {
        const result = await pending; assert.equal(result.currentEvidenceValidity.validBefore, deadline);
        assert.equal(parseUtcInstant(deadline)! - parseUtcInstant(result.evaluatedAt)!, 1n);
        assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
      }
      assert.equal(recordReads, 2); Date.now = realNow;
    }
  } finally { Date.now = realNow; }
});

test('historical login expiry does not invalidate a properly signed record after the login ended', async (t) => {
  const f = fixture(t);
  for (const [index, identity] of f.identities.entries()) {
    const selected = f.config.signers[index]!, provider = f.providers[index]!;
    identity.payload.authenticationExpiresAt = new Date(Date.parse(selected.proof.expected.signedAt) + 1).toISOString();
    f.sources.set(selected.proof.identityProofPath, JSON.stringify(identity.encode()));
    provider.expected.identityEvidenceDigest = hash(f.sources.get(selected.proof.identityProofPath)!);
    provider.payload.identityEvidenceDigest = provider.expected.identityEvidenceDigest;
  }
  f.repin(); const service = f.create(), result = await service.collect(f.input());
  for (const observation of result.signerObservations) {
    assert.ok(Date.parse(observation.signerIdentity.attestation.claims.authenticationExpiresAt) < Date.parse(result.evaluatedAt));
    assert.ok(parseUtcInstant(observation.currentEvidenceValidity.validBefore)! > parseUtcInstant(result.evaluatedAt)!);
  }
  // A healthy instance re-reads actual current sources; the prior bound is no cached authorization.
  const path = f.config.signers[0]!.source.signerAuthorization.path, document = JSON.parse(f.sources.get(path)!);
  document.records[0].active = false; f.sources.set(path, JSON.stringify(document));
  await assert.rejects(service.collect(f.input()), failure);
  await service.shutdown();
});

test('invalid input, wrong authority or digest fail without expanding source scope', async (t) => {
  const f = fixture(t), service = f.create();
  for (const input of [{}, { ...f.input(), decisionDigest: '0'.repeat(64) }, { ...f.input(), sourceRevision: 'main' }, { ...f.input(), signers: [] }]) await assert.rejects(service.collect(input), failure);
  assert.equal(f.state.reads.length, 0); f.state.identity = null; await assert.rejects(service.collect(f.input()), failure); assert.equal(f.state.reads.length, 0);
});

test('overall clock regression and the original service expiry cannot be refreshed by a later child', async (t) => {
  const realNow = Date.now;
  try {
    for (const mode of ['regression', 'expiry']) {
      const f = fixture(t), read = f.reader.readArtifact, base = realNow(); let clock = base;
      if (mode === 'expiry') f.state.identity = { ...(f.state.identity as object), expiresAt: new Date(base + 1000).toISOString() };
      Date.now = () => clock;
      f.reader.readArtifact = async (...args) => { const result = await read(...args);
        if (args[0] === f.config.signers[0]!.proof.proofPath) {
          clock = mode === 'regression' ? base - 1 : base + 1000;
          f.state.identity = { ...(f.state.identity as object), expiresAt: new Date(base + 120000).toISOString() };
        } return result;
      };
      await assert.rejects(f.create().collect(f.input()), failure);
      Date.now = realNow;
    }
  } finally { Date.now = realNow; }
});

test('a stalled signer hits the overall real deadline, keeps single-flight ownership and drains without further reads', { timeout: 25000 }, async (t) => {
  const f = fixture(t), read = f.reader.readArtifact; let entered!: () => void, release!: () => void;
  const entry = new Promise<void>((resolve) => { entered = resolve; }), wait = new Promise<void>((resolve) => { release = resolve; });
  const path = f.config.signers[0]!.proof.proofPath;
  f.reader.readArtifact = async (...args) => { if (args[0] === path) { entered(); await wait; } return read(...args); };
  const service = f.create(), started = Date.now(), pending = service.collect(f.input()); await entry;
  await assert.rejects(service.collect(f.input()), failure); await assert.rejects(pending, failure); assert.ok(Date.now() - started >= 14900);
  await new Promise((resolve) => setTimeout(resolve, 100)); // Child deadline also expires; actual read is still held.
  assert.equal(service.status().active, true);
  let stopped = false; const stop = service.shutdown().then(() => { stopped = true; }); await Promise.resolve(); assert.equal(stopped, false);
  const before = f.state.reads.length; release(); await stop;
  assert.equal(f.state.reads.length, before + 1); assert.equal(service.status().active, false); await assert.rejects(service.collect(f.input()), failure);
});
