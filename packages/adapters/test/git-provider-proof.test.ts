import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { briefWriteAuthoritySchema } from '@steer/tool-registry';
import { createGitProviderProofReader } from '../src/identity/git-provider-proof.ts';
import type { ArtifactReader } from '../src/code-host/github.ts';
import { providerProofFixture } from './gate-proof-fixture.ts';

const head = 'b'.repeat(40), hash = (text: string) => createHash('sha256').update(text).digest('hex');
function fixture() {
  const proof = providerProofFixture();
  const sources = new Map([['organization/provider-trust.json', JSON.stringify(proof.trust)], ['evidence/provider-proof.json', JSON.stringify(proof.encode())]]);
  const config = { organizationId: 'synthetic', repository: 'github:1', branch: 'synthetic',
    trustPath: 'organization/provider-trust.json', trustDigest: hash(sources.get('organization/provider-trust.json')!), proofPaths: ['evidence/provider-proof.json'] };
  const input = { sourceRevision: head, proofPath: 'evidence/provider-proof.json', proofDigest: hash(sources.get('evidence/provider-proof.json')!), expected: proof.expected };
  const principal = { organizationId: 'synthetic', subject: 'synthetic-proof-reader', type: 'agent', hats: [], toolGrants: ['gate.observe'], expiresAt: '2026-09-06T12:00:30.000Z' };
  const state: { identity: unknown; afterIdentity?: unknown; authCalls: number; time: number; heads: number; paths: string[]; head: string } =
    { identity: principal, authCalls: 0, time: Date.parse('2026-09-06T12:00:00.400Z'), heads: 0, paths: [], head };
  const reader: ArtifactReader = {
    binding: { organizationId: 'synthetic', repositoryId: 1, installationId: 1, owner: 'synthetic', repository: 'synthetic', branch: 'synthetic' },
    readHead: async () => { state.heads++; return state.head; },
    readArtifact: async (path, revision) => {
      state.paths.push(path); const content = sources.get(path); if (content === undefined) throw new Error('Synthetic private source missing.');
      return { organizationId: 'synthetic', repositoryId: 1, path, revision, content, contentDigest: hash(content),
        blobSha: createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex') };
    },
  };
  const create = (configuration: unknown = config) => createGitProviderProofReader(reader, configuration, {
    authenticate: async () => ++state.authCalls > 1 && 'afterIdentity' in state ? state.afterIdentity : state.identity,
    now: () => new Date(state.time),
  });
  return { proof, sources, config, input, principal, state, reader, create };
}
const failure = /^Error: Provider proof source could not be verified\.$/;

function signerFixture() {
  const f = fixture(), authorizationRevision = 'a'.repeat(40), authorizationPath = 'organization/authorization.json';
  const grant = { organizationId: 'synthetic', subject: f.proof.expected.subject, issuer: 'https://identity.synthetic.invalid',
    type: 'human', hats: ['tech-lead'], toolGrants: [], active: true,
    validAfter: '2026-09-06T12:00:00.100000000Z', expiresAt: '2026-09-06T12:00:30Z' };
  const document = { version: 'steer-authorization/v1', organizationId: 'synthetic', records: [grant] };
  const history = { content: JSON.stringify(document) };
  const pin = () => {
    f.proof.expected.authorizationEvidenceDigest = hash(history.content);
    f.proof.payload.authorizationEvidenceDigest = hash(history.content);
    f.sources.set(f.input.proofPath, JSON.stringify(f.proof.encode()));
    f.input.proofDigest = hash(f.sources.get(f.input.proofPath)!);
  };
  pin(); f.sources.set(authorizationPath, JSON.stringify(document));
  const originalRead = f.reader.readArtifact;
  f.reader.readArtifact = async (path, revision) => {
    const artifact = await originalRead(path, revision);
    if (path !== authorizationPath || revision !== authorizationRevision) return artifact;
    const content = history.content;
    return { ...artifact, content, contentDigest: hash(content),
      blobSha: createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex') };
  };
  const configuration = { ...f.config, signerAuthorization: { path: authorizationPath, issuer: grant.issuer } };
  return { ...f, authorizationRevision, authorizationPath, grant, document, history, pin, configuration,
    signerInput: { ...f.input, authorizationRevision }, signer: () => f.create(configuration) };
}

test('read-through proof composition verifies exact source bytes and the real provider signature without granting authority', async () => {
  const f = fixture(), service = f.create(), result = await service.verify(f.input);
  assert.equal(result.sourceRevision, head); assert.equal(result.trustSource.contentDigest, f.config.trustDigest);
  assert.equal(result.proofSource.contentDigest, f.input.proofDigest); assert.equal(result.attestation.claims.subject, f.proof.expected.subject);
  assert.equal(result.attestation.evaluatedAt, '2026-09-06T12:00:00.400Z');
  assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
  assert.equal(result.attestation.currentSourceVerificationRequired, true); assert.equal(briefWriteAuthoritySchema.safeParse(result).success, false);
  for (const value of [result, result.proofSource, result.trustSource, result.attestation, result.attestation.claims]) assert.ok(Object.isFrozen(value));
  assert.deepEqual(f.state.paths, [f.config.trustPath, f.input.proofPath]); assert.equal(f.state.heads, 2); assert.equal(f.state.authCalls, 2);
  await service.verify(f.input); assert.equal(f.state.paths.length, 4); // No stale source cache.
  await service.shutdown(); await assert.rejects(service.verify(f.input), failure);
});
test('invalid configuration, input, scope or path never expands source access', async () => {
  const f = fixture();
  for (const change of [{ repository: 'github:2' }, { branch: 'other' }, { proofPaths: [] }, { proofPaths: [f.config.trustPath] },
    { proofPaths: [f.input.proofPath, f.input.proofPath] }, { trustPath: '../private' }, { trustDigest: 'invalid' }]) assert.throws(() => f.create({ ...f.config, ...change }));
  const service = f.create();
  for (const input of [null, {}, { ...f.input, sourceRevision: `${head}\n` }, { ...f.input, proofPath: 'private/key.pem' },
    { ...f.input, expected: { ...f.input.expected, organizationId: 'foreign' } }, { ...f.input, trust: f.proof.trust }]) await assert.rejects(service.verify(input), failure);
  assert.equal(f.state.authCalls, 0); assert.equal(f.state.heads, 0); assert.deepEqual(f.state.paths, []);
});
test('initial denial and fresh agent revocation, replacement or expiry discard evidence', async () => {
  for (const identity of [null, { ...fixture().principal, type: 'human' }, { ...fixture().principal, hats: ['tech-lead'] },
    { ...fixture().principal, toolGrants: [] }, { ...fixture().principal, organizationId: 'foreign' }]) {
    const f = fixture(); f.state.identity = identity; await assert.rejects(f.create().verify(f.input), failure); assert.equal(f.state.paths.length, 0);
  }
  for (const change of [null, { ...fixture().principal, subject: 'another-agent' }, { ...fixture().principal, expiresAt: '2026-09-06T12:00:00.400Z' }]) {
    const f = fixture(); f.state.afterIdentity = change; await assert.rejects(f.create().verify(f.input), failure); assert.equal(f.state.paths.length, 2);
  }
});
test('wrong source coordinates, hash corruption and missing files fail closed without exposing source errors', async () => {
  for (const change of [{ organizationId: 'foreign' }, { repositoryId: 2 }, { path: 'another.json' }, { revision: 'c'.repeat(40) },
    { contentDigest: 'f'.repeat(64) }, { blobSha: 'f'.repeat(40) }, { content: 'tampered' }]) {
    const f = fixture(), read = f.reader.readArtifact; f.reader.readArtifact = async (...args) => ({ ...await read(...args), ...change });
    await assert.rejects(f.create().verify(f.input), failure);
  }
  const absent = fixture(); absent.sources.delete(absent.input.proofPath); await assert.rejects(absent.create().verify(absent.input), failure);
});
test('head movement, clock regression, elapsed deadline and expiry during the last read deny', async () => {
  const stale = fixture(); stale.state.head = 'c'.repeat(40); await assert.rejects(stale.create().verify(stale.input), failure); assert.equal(stale.state.paths.length, 0);
  for (const mode of ['head', 'backward', 'partial-regression', 'deadline', 'expiry', 'invalid'] as const) {
    const f = fixture(), read = f.reader.readHead;
    f.reader.readHead = async () => {
      const value = await read();
      if (mode === 'partial-regression' && f.state.heads === 1) f.state.time += 100;
      if (f.state.heads === 2) {
        if (mode === 'head') return 'c'.repeat(40);
        if (mode === 'backward') f.state.time--;
        if (mode === 'partial-regression') f.state.time--;
        if (mode === 'deadline') f.state.time += 15000;
        if (mode === 'expiry') f.state.time = Date.parse(f.principal.expiresAt);
        if (mode === 'invalid') f.state.time = NaN;
      } return value;
    };
    await assert.rejects(f.create().verify(f.input), failure);
  }
});
test('changed trust cannot reuse an old approved pin and even a newly pinned revocation denies the signature', async () => {
  const f = fixture(), service = f.create(); await service.verify(f.input);
  f.proof.trust.revokedAt = '2026-09-06T12:00:00.399999999Z'; f.sources.set(f.config.trustPath, JSON.stringify(f.proof.trust));
  await assert.rejects(service.verify(f.input), failure);
  const revised = f.create({ ...f.config, trustDigest: hash(f.sources.get(f.config.trustPath)!) });
  await assert.rejects(revised.verify(f.input), failure);
  const expired = fixture(); expired.state.time = Date.parse(expired.proof.trust.notAfter);
  expired.state.identity = { ...expired.principal, expiresAt: '2026-09-06T12:02:00Z' };
  await assert.rejects(expired.create().verify(expired.input), failure);
});
test('canonical source encoding, size limits and linked expected facts stay mandatory even with matching source hashes', async () => {
  for (const mode of ['pretty', 'utf8', 'oversize']) {
    const f = fixture(), content = mode === 'pretty' ? JSON.stringify(f.proof.trust, null, 2) : mode === 'utf8' ? '\ud800' : 'x'.repeat(16385);
    f.sources.set(f.config.trustPath, content);
    await assert.rejects(f.create({ ...f.config, trustDigest: hash(content) }).verify(f.input), failure);
  }
  for (const mode of ['pretty', 'oversize', 'metadata']) {
    const f = fixture(), content = mode === 'pretty' ? JSON.stringify(f.proof.encode(), null, 2) : mode === 'oversize' ? 'x'.repeat(65537) : '{"type":"provider-recorded","provider":"openai-codex"}';
    f.sources.set(f.input.proofPath, content);
    await assert.rejects(f.create().verify({ ...f.input, proofDigest: hash(content) }), failure);
  }
  const swapped = fixture(); await assert.rejects(swapped.create().verify({ ...swapped.input, expected: { ...swapped.input.expected, subject: 'different-human' } }), failure);
});
test('real deadline leaves a hung source single-flight until it drains and shutdown waits for owned work', { timeout: 25000 }, async () => {
  const f = fixture(), read = f.reader.readArtifact; let release!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  f.reader.readArtifact = async (...args) => { await wait; return read(...args); };
  const service = f.create(), started = Date.now(), pending = service.verify(f.input);
  await assert.rejects(service.verify(f.input), failure); await assert.rejects(pending, failure);
  assert.ok(Date.now() - started >= 14900); assert.equal(service.status().active, true);
  await assert.rejects(service.verify(f.input), failure);
  let stopped = false; const stopping = service.shutdown().then(() => { stopped = true; });
  await Promise.resolve(); assert.equal(stopped, false); release(); await stopping;
  assert.equal(stopped, true); assert.equal(service.status().active, false);
  assert.deepEqual(f.state.paths, [f.config.trustPath]); // Timed-out work cannot continue to proof reads.
});

test('signer verification binds real signed authorization bytes to historical and current human hats, not a qualified gate', async () => {
  const f = signerFixture(), result = await f.signer().verifySigner(f.signerInput);
  assert.equal(result.signerAuthorization.historicalSource.revision, f.authorizationRevision);
  assert.equal(result.signerAuthorization.historicalSource.contentDigest, f.proof.expected.authorizationEvidenceDigest);
  assert.equal(result.signerAuthorization.currentSource.revision, head);
  assert.equal(result.signerAuthorization.issuer, f.grant.issuer);
  assert.equal(result.signerAuthorization.historicalHatVerified, true);
  assert.equal(result.signerAuthorization.currentHatVerified, true);
  assert.equal(result.signerAuthorization.identityEvidenceVerificationRequired, true);
  assert.equal(result.signerAuthorization.qualificationVerificationRequired, true);
  assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
  assert.equal(briefWriteAuthoritySchema.safeParse(result).success, false);
  for (const value of [result.signerAuthorization, result.signerAuthorization.currentSource, result.signerAuthorization.historicalSource]) assert.ok(Object.isFrozen(value));
  assert.deepEqual(f.state.paths, [f.config.trustPath, f.input.proofPath, f.authorizationPath, f.authorizationPath]);
  // The original method never silently upgrades a plain provider observation.
  const providerOnly = await f.signer().verify(f.input); assert.equal(providerOnly.signerAuthorization, undefined);
});

test('signer mode requires explicit trusted configuration and a historical revision without accepting caller sources', async () => {
  const f = signerFixture();
  await assert.rejects(f.create().verifySigner(f.signerInput), failure);
  for (const input of [f.input, { ...f.signerInput, authorizationRevision: 'main' },
    { ...f.signerInput, authorizationPath: 'private/key.pem' }, { ...f.signerInput, qualifiedDomains: ['security'] }]) {
    await assert.rejects(f.signer().verifySigner(input), failure);
  }
  for (const path of [f.config.trustPath, f.input.proofPath, '../private']) {
    assert.throws(() => f.create({ ...f.configuration, signerAuthorization: { ...f.configuration.signerAuthorization, path } }));
  }
  assert.equal(f.state.authCalls, 0); assert.deepEqual(f.state.paths, []);
});

test('authentic provider assertions cannot grant absent, foreign, agent, inactive or duplicate historical hats', async () => {
  for (const change of [{ type: 'agent' }, { active: false }, { hats: [] }, { hats: ['tech-lead', 'tech-lead'] },
    { issuer: 'https://foreign.synthetic.invalid' }, { subject: 'different-human' }, { organizationId: 'foreign' }]) {
    const f = signerFixture(); f.history.content = JSON.stringify({ ...f.document, records: [{ ...f.grant, ...change }] }); f.pin();
    await assert.rejects(f.signer().verifySigner({ ...f.signerInput, proofDigest: f.input.proofDigest }), failure);
  }
  for (const records of [[], [signerFixture().grant, signerFixture().grant]]) {
    const f = signerFixture(); f.history.content = JSON.stringify({ ...f.document, records }); f.pin();
    await assert.rejects(f.signer().verifySigner({ ...f.signerInput, proofDigest: f.input.proofDigest }), failure);
  }
});

test('grant windows cover authentication through signing exactly, including nanosecond half-open boundaries', async () => {
  for (const [change, allowed] of [
    [{ validAfter: '2026-09-06T12:00:00.100000001Z' }, false],
    [{ expiresAt: '2026-09-06T12:00:00.200000000Z' }, false],
    [{ expiresAt: '2026-09-06T12:00:00.200000001Z' }, true],
    [{ validAfter: '2026-09-06T12:00:00.200000001Z', expiresAt: '2026-09-06T12:00:00.2Z' }, false],
    [{ validAfter: '2026-09-06T12:00:00.1000000001Z' }, false],
  ] as const) {
    const f = signerFixture(); f.history.content = JSON.stringify({ ...f.document, records: [{ ...f.grant, ...change }] }); f.pin();
    const pending = f.signer().verifySigner({ ...f.signerInput, proofDigest: f.input.proofDigest });
    if (allowed) assert.equal((await pending).signerAuthorization.historicalHatVerified, true);
    else await assert.rejects(pending, failure);
  }
});

test('current revocation, missing hats and current expiry deny historical validity without a stale cache', async () => {
  for (const change of [{ active: false }, { type: 'agent' }, { hats: [] },
    { validAfter: '2026-09-06T12:00:00.400000001Z' }, { expiresAt: '2026-09-06T12:00:00.400Z' }]) {
    const f = signerFixture(), service = f.signer(); await service.verifySigner(f.signerInput);
    f.sources.set(f.authorizationPath, JSON.stringify({ ...f.document, records: [{ ...f.grant, ...change }] }));
    await assert.rejects(service.verifySigner(f.signerInput), failure);
  }
  const f = signerFixture(); f.sources.delete(f.authorizationPath); await assert.rejects(f.signer().verifySigner(f.signerInput), failure);
});

test('historical authorization digest, source coordinates, encoding and size remain mandatory despite real signatures', async () => {
  const changed = signerFixture(); changed.history.content += '\n';
  await assert.rejects(changed.signer().verifySigner(changed.signerInput), failure);
  for (const change of [{ revision: head }, { path: 'another.json' }, { contentDigest: 'f'.repeat(64) }, { blobSha: 'f'.repeat(40) }]) {
    const f = signerFixture(), read = f.reader.readArtifact;
    f.reader.readArtifact = async (...args) => {
      const artifact = await read(...args); return args[1] === f.authorizationRevision ? { ...artifact, ...change } : artifact;
    };
    await assert.rejects(f.signer().verifySigner(f.signerInput), failure);
  }
  for (const content of ['\ud800', 'x'.repeat(512 * 1024 + 1), '{"version":"invalid"}']) {
    const f = signerFixture(); f.history.content = content; f.pin();
    await assert.rejects(f.signer().verifySigner({ ...f.signerInput, proofDigest: f.input.proofDigest }), failure);
  }
});

test('signer source reads cannot bypass final head, service identity or clock checks', async () => {
  for (const mode of ['head', 'identity', 'clock'] as const) {
    const f = signerFixture(), read = f.reader.readArtifact;
    f.reader.readArtifact = async (...args) => {
      const artifact = await read(...args);
      if (args[0] === f.authorizationPath && args[1] === head) {
        if (mode === 'head') f.state.head = 'c'.repeat(40);
        if (mode === 'identity') f.state.afterIdentity = null;
        if (mode === 'clock') f.state.time--;
      }
      return artifact;
    };
    await assert.rejects(f.signer().verifySigner(f.signerInput), failure);
  }
});

test('provider-only and signer observations share single-flight ownership and draining shutdown', async () => {
  const f = signerFixture(), read = f.reader.readArtifact; let release!: () => void, entered!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  const entry = new Promise<void>((resolve) => { entered = resolve; });
  f.reader.readArtifact = async (...args) => {
    if (args[0] === f.authorizationPath) { entered(); await wait; }
    return read(...args);
  };
  const service = f.signer(), pending = service.verifySigner(f.signerInput); await entry;
  await assert.rejects(service.verify(f.input), failure); await assert.rejects(service.verifySigner(f.signerInput), failure);
  let stopped = false; const stopping = service.shutdown().then(() => { stopped = true; });
  await Promise.resolve(); assert.equal(stopped, false); release();
  assert.equal((await pending).signerAuthorization.currentHatVerified, true); await stopping;
  await assert.rejects(service.verifySigner(f.signerInput), failure); assert.equal(service.status().active, false);
});

test('native Git history supplies exact old and current grant bytes and a later revocation is observed', async (t) => {
  const f = signerFixture(), directory = mkdtempSync(join(tmpdir(), 'steer-0136-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: directory, encoding: 'utf8', maxBuffer: 1024 * 1024 }).trim();
  const put = (path: string, content: string) => { const file = join(directory, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, content); };
  git('init', '-q', '-b', 'synthetic'); git('config', 'user.name', 'Synthetic Test'); git('config', 'user.email', 'test@synthetic.invalid');
  put(f.authorizationPath, f.history.content); git('add', '.'); git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'Historical role');
  const historicalRevision = git('rev-parse', 'HEAD');
  for (const [path, content] of f.sources) put(path, content);
  put(f.authorizationPath, JSON.stringify({ ...f.document, records: [{ ...f.grant, expiresAt: '2026-09-06T12:01:00Z' }] }));
  git('add', '.'); git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'Current sources');
  const currentRevision = git('rev-parse', 'HEAD');
  f.reader.readHead = async () => git('rev-parse', 'HEAD');
  f.reader.readArtifact = async (path, revision) => {
    const content = execFileSync('git', ['show', `${revision}:${path}`], { cwd: directory, encoding: 'utf8' });
    return { organizationId: 'synthetic', repositoryId: 1, path, revision, content,
      contentDigest: hash(content), blobSha: git('rev-parse', `${revision}:${path}`) };
  };
  const service = f.signer(), input = { ...f.signerInput, sourceRevision: currentRevision, authorizationRevision: historicalRevision };
  const observation = await service.verifySigner(input);
  assert.equal(observation.signerAuthorization.historicalSource.revision, historicalRevision);
  assert.equal(observation.signerAuthorization.currentSource.revision, currentRevision);
  assert.notEqual(observation.signerAuthorization.historicalSource.contentDigest, observation.signerAuthorization.currentSource.contentDigest);
  put(f.authorizationPath, JSON.stringify({ ...f.document, records: [{ ...f.grant, active: false }] }));
  git('add', '.'); git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'Revoke role');
  await assert.rejects(service.verifySigner(input), failure); // Stale current head.
  await assert.rejects(service.verifySigner({ ...input, sourceRevision: git('rev-parse', 'HEAD') }), failure); // Fresh revocation.
  await service.shutdown();
});
