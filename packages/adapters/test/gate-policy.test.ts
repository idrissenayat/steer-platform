import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { briefWriteAuthoritySchema, principalSchema } from '@steer/tool-registry';
import { createGitGatePolicyCollector } from '../src/code-host/gate-policy.ts';
import { fixture, hash } from './gate-signers-fixture.ts';
import type { RepositoryReader } from '../src/code-host/github.ts';
import { nativeDomainReviewFixture } from './native-domain-review-fixture.ts';
import { nativeDomainExceptionFixture } from './native-domain-exception-fixture.ts';
import { nativeCriticFixture, criticSource } from './native-critic-fixture.ts';
import { reviewRunnerFixture } from './gate-review-fixture.ts';
import { criticRunnerFixture } from './gate-critic-proof-fixture.ts';

const failure = /^Error: Gate policy source collection could not be verified\.$/;
const blob = (text: string) => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
function chain(t: TestContext, count: 1 | 2 | 3 = 3, native = false) {
  const base = Date.now(), parts = Array.from({ length: count }, (_, i) => fixture(t, false, (i + 1) as 1 | 2 | 3, base - (3 - i) * 10000));
  const original = new Map<string, string>(), sources = new Map<string, string>(), reads: string[] = [];
  const directory = native ? mkdtempSync(join(tmpdir(), 'steer-0141-')) : undefined;
  if (directory) t.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
  const put = (path: string, text: string) => { const file = join(directory!, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text); };
  for (const [index, part] of parts.entries()) for (const [path, content] of part.original) original.set(`gate-${index + 1}/${path}`, content);
  if (native) {
    git('init', '-q', '-b', 'synthetic'); git('config', 'user.name', 'Synthetic Test'); git('config', 'user.email', 'test@synthetic.invalid');
    for (const [path, content] of original) put(path, content);
    git('add', '.'); git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'Original artifacts and grants');
  }
  const revision = native ? git('rev-parse', 'HEAD') : 'a'.repeat(40);
  const gates = parts.map((part, index) => {
    const prefix = `gate-${index + 1}/`, source = part.config.gateSource;
    for (const [path, content] of part.sources) sources.set(prefix + path, content);
    source.recordPath = prefix + source.recordPath; source.artifactRevision = revision; source.artifactPaths = source.artifactPaths.map(path => prefix + path);
    part.record.artifactRevision = revision; part.record.artifacts = part.record.artifacts.map(entry => ({ path: prefix + entry.path, revision }));
    sources.set(source.recordPath, JSON.stringify(part.record));
    for (const [i, signer] of part.config.signers.entries()) {
      signer.source.trustPath = prefix + signer.source.trustPath; signer.source.proofPaths = signer.source.proofPaths.map(path => prefix + path);
      signer.source.signerAuthorization.path = prefix + signer.source.signerAuthorization.path;
      signer.source.signerIdentity.trustPath = prefix + signer.source.signerIdentity.trustPath;
      signer.source.signerIdentity.proofPaths = signer.source.signerIdentity.proofPaths.map(path => prefix + path);
      const qualification = signer.source.specialistQualification;
      if (qualification) { qualification.trustPath = prefix + qualification.trustPath; qualification.proofPath = prefix + qualification.proofPath; }
      signer.proof.proofPath = prefix + signer.proof.proofPath; signer.proof.identityProofPath = prefix + signer.proof.identityProofPath;
      signer.proof.authorizationRevision = revision;
      Object.assign(signer.proof.expected, { artifactRevision: revision, decisionDigest: hash(sources.get(source.recordPath)!) });
      Object.assign(part.providers[i]!.payload, signer.proof.expected);
      sources.set(signer.proof.proofPath, JSON.stringify(part.providers[i]!.encode())); signer.proof.proofDigest = hash(sources.get(signer.proof.proofPath)!);
    }
    const target = { ...source.scope, gate: source.gate, artifactRevision: revision };
    const doc = (name: string, facts: object) => { const path = prefix + name, content = JSON.stringify({ ...facts, target }); sources.set(path, content); return { path, digest: hash(content) }; };
    const policy = doc('policy.json', { version: 'steer-gate-policy-context/v1', policy: { profile: 'commercial', defaultClosed: true,
      userFacing: false, activatedDomains: ['privacy'], humanSpecialistDomains: ['privacy'] } });
    const critic = doc('critic.json', { version: 'steer-gate-critic-facts/v1', critic: { artifactRevision: revision,
      reportedAt: new Date(Date.parse(part.config.signers[0]!.proof.expected.authenticatedAt) - 100).toISOString(), passed: true, freshContext: true, unresolvedFindings: 0 } });
    const buildEvidence = index === 2 ? doc('build.json', { version: 'steer-gate-build-facts/v1', buildEvidence: {
      artifactRevision: revision, examPassed: true, planConformant: true } }) : null;
    const review = doc('privacy.json', { version: 'steer-gate-domain-facts/v1', review: { domain: 'privacy', artifactRevision: revision,
      reviewerSubject: 'synthetic-reviewer', freshContext: true, passed: true, confidence: 'high', unresolvedFindings: 0, humanRequired: true } });
    const exceptionBrief = doc('exception.json', { version: 'steer-gate-exception-facts/v1', builderSubject: 'synthetic-builder',
      exceptionBrief: { artifactRevision: revision, reviewDigests: [review.digest] } });
    return { signerCollection: part.config, policy, critic, buildEvidence, domainAssurance: { reviews: [review], exceptionBrief } };
  });
  const state = { head: 'b'.repeat(40), identity: parts[0]!.state.identity, authCalls: 0 };
  const commit = () => { for (const [path, content] of sources) put(path, content); git('add', '.'); git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'Current gate and policy sources'); state.head = git('rev-parse', 'HEAD'); };
  if (native) commit();
  const contentAt = (path: string, atRevision: string) => native ? execFileSync('git', ['show', `${atRevision}:${path}`], { cwd: directory, encoding: 'utf8' }) : (atRevision === revision ? original : sources).get(path)!;
  const reader: RepositoryReader = { binding: parts[0]!.reader.binding, readHead: async () => state.head,
    readArtifact: async (path, atRevision) => { reads.push(path); const content = contentAt(path, atRevision); if (content === undefined) throw new Error('Synthetic missing file.');
      return { organizationId: reader.binding.organizationId, repositoryId: reader.binding.repositoryId, path, revision: atRevision,
        content, contentDigest: hash(content), blobSha: native ? git('rev-parse', `${atRevision}:${path}`) : blob(content) }; },
    readInventory: async (selection, atRevision) => ({ organizationId: reader.binding.organizationId, repositoryId: reader.binding.repositoryId,
      revision: atRevision, treeSha: native ? git('rev-parse', `${atRevision}^{tree}`) : 'c'.repeat(40),
      entries: gates.filter(gate => gate.signerCollection.gateSource.recordPath.startsWith(selection.roots[0]! + '/')).map(gate => ({
        path: gate.signerCollection.gateSource.recordPath, blobSha: blob(contentAt(gate.signerCollection.gateSource.recordPath, atRevision)) })) }),
  };
  const config = { gates }, input = () => ({ sourceRevision: state.head, decisionDigest: gates.at(-1)!.signerCollection.signers[0]!.proof.expected.decisionDigest });
  if (native) reader.readCommit = async revision => ({ organizationId: reader.binding.organizationId,
    repositoryId: reader.binding.repositoryId, revision,
    parents: [...git('cat-file', '-p', revision).matchAll(/^parent ([a-f0-9]{40})$/gm)].map(value => value[1]!) });
  const change = (reference: { path: string; digest: string }, edit: (value: any) => void, repin = true) => {
    const value = JSON.parse(sources.get(reference.path)!); edit(value); sources.set(reference.path, JSON.stringify(value)); if (repin) reference.digest = hash(sources.get(reference.path)!);
  };
  return { config, sources, state, reader, input, reads, change, commit, parts, git,
    create: (configuration: unknown = config) => createGitGatePolicyCollector(reader, configuration, async () => { state.authCalls++; return state.identity; }) };
}

test('native Git and actual signer crypto feed all three gate policy evaluations without claiming review authenticity or authority', async (t) => {
  const f = chain(t, 3, true), service = f.create(), result = await service.collect(f.input());
  assert.equal(result.policyOutcome, 'policy-satisfied'); assert.equal(result.gates.length, 3);
  assert.equal(result.gates[0]!.input.prerequisite, null);
  for (const [index, gate] of result.gates.entries()) {
    assert.equal(gate.input.policy.digest, f.config.gates[index]!.policy.digest);
    assert.equal(gate.evaluation.outcome, 'policy-satisfied'); assert.equal(gate.evaluation.sourceVerificationRequired, true);
    assert.equal(gate.input.evaluatedAt, result.evaluatedAt);
    for (const source of gate.sources) assert.equal(source.contentDigest, hash(source.content));
    if (index > 0) assert.equal(gate.input.prerequisite!.decisionDigest, result.gates[index - 1]!.input.record.decisionDigest);
  }
  assert.equal(result.reviewAuthenticityVerificationRequired, true); assert.equal(result.governedSelectionVerificationRequired, true);
  assert.equal(result.currentSourceVerificationRequired, true); assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
  assert.equal(briefWriteAuthoritySchema.safeParse(result).success, false);
  assert.ok(Object.isFrozen(result.gates[2]!.input.domainAssurance!.reviews[0])); assert.ok(Object.isFrozen(result.gates[0]!.sources));
  await service.shutdown(); await assert.rejects(service.collect(f.input()), failure);
});

test('a satisfied target never conceals a blocked prerequisite policy', async (t) => {
  const f = chain(t, 2); f.change(f.config.gates[0]!.critic, value => { value.critic.passed = false; });
  const result = await f.create().collect(f.input());
  assert.equal(result.gates[0]!.evaluation.outcome, 'blocked'); assert.equal(result.gates[1]!.evaluation.outcome, 'policy-satisfied');
  assert.equal(result.policyOutcome, 'blocked'); assert.equal(result.gateVerified, false);
});

test('real policy evaluation preserves missing, stale, inconclusive and incomplete evidence denials even with matching source pins', async (t) => {
  for (const mode of ['critic', 'findings', 'domain', 'exception', 'qualification', 'build', 'target-revision']) {
    const f = chain(t), entry = f.config.gates[2]!;
    if (mode === 'critic') f.change(entry.critic, value => { value.critic.freshContext = false; });
    if (mode === 'findings') f.change(entry.critic, value => { value.critic.unresolvedFindings = 1; });
    if (mode === 'domain') f.change(entry.domainAssurance.reviews[0]!, value => { value.review.confidence = 'low'; });
    if (mode === 'exception') f.change(entry.domainAssurance.exceptionBrief, value => { value.exceptionBrief.reviewDigests = []; });
    if (mode === 'qualification') f.change(entry.policy, value => { value.policy.humanSpecialistDomains.push('security'); });
    if (mode === 'build') f.change(entry.buildEvidence!, value => { value.buildEvidence.planConformant = false; });
    if (mode === 'target-revision') f.change(entry.critic, value => { value.critic.artifactRevision = 'd'.repeat(40); });
    assert.equal((await f.create().collect(f.input())).policyOutcome, 'blocked', mode);
  }
});

test('source content, pins, encoding, coordinates, strict profile and target identity cannot be replaced by plausible facts', async (t) => {
  for (const mode of ['digest', 'bytes', 'blob', 'path', 'revision', 'org', 'missing', 'oversize', 'utf8', 'profile', 'extra', 'target', 'duplicate', 'whitespace']) {
    const f = chain(t, 1), entry = f.config.gates[0]!, read = f.reader.readArtifact;
    if (mode === 'digest') f.change(entry.policy, value => { value.policy.defaultClosed = false; }, false);
    if (mode === 'missing') f.sources.delete(entry.policy.path);
    if (mode === 'profile') f.change(entry.policy, value => { value.version = 'unknown'; });
    if (mode === 'extra') f.change(entry.policy, value => { value.writeAuthorized = true; });
    if (mode === 'target') f.change(entry.policy, value => { value.target.itemId = 'foreign'; });
    if (mode === 'oversize' || mode === 'utf8') {
      const text = mode === 'oversize' ? ' '.repeat(65537) : '\ud800'; f.sources.set(entry.policy.path, text); entry.policy.digest = hash(text);
    }
    if (mode === 'duplicate' || mode === 'whitespace') {
      const original = f.sources.get(entry.policy.path)!, text = mode === 'whitespace' ? original + '\n' :
        original.replace('"defaultClosed":true', '"defaultClosed":false,"defaultClosed":true');
      f.sources.set(entry.policy.path, text); entry.policy.digest = hash(text);
    }
    f.reader.readArtifact = async (...args) => { const result = await read(...args); if (args[0] === entry.policy.path) {
      if (mode === 'bytes') result.content += ' ';
      if (mode === 'blob') result.blobSha = '0'.repeat(40);
      if (mode === 'path') result.path = 'foreign.json';
      if (mode === 'revision') result.revision = 'd'.repeat(40);
      if (mode === 'org') result.organizationId = 'foreign';
    } return result; };
    await assert.rejects(f.create().collect(f.input()), failure, mode);
  }
});

test('send-back and declined prerequisites cannot be normalized into approved gates', async (t) => {
  for (const decision of ['send-back', 'declined'] as const) {
    const f = chain(t, 2), first = f.config.gates[0]!, part = f.parts[0]!;
    part.record.decision = decision; f.sources.set(first.signerCollection.gateSource.recordPath, JSON.stringify(part.record));
    const digest = hash(JSON.stringify(part.record));
    for (const [index, signer] of first.signerCollection.signers.entries()) {
      const provider = part.providers[index]!; Object.assign(provider.expected, { decision, decisionDigest: digest });
      Object.assign(provider.payload, provider.expected); f.sources.set(signer.proof.proofPath, JSON.stringify(provider.encode()));
      signer.proof.proofDigest = hash(f.sources.get(signer.proof.proofPath)!);
    }
    const result = await f.create().collect(f.input()); assert.equal(result.policyOutcome, 'blocked');
    assert.equal(result.gates[0]!.input.record.decision, decision); assert.equal(result.gates[1]!.input.prerequisite, null);
    assert.ok(result.gates[1]!.evaluation.reasons.includes('PREREQUISITE_REQUIRED'));
  }
});

test('absent build or domain evidence remains blocked rather than being filled from request defaults', async (t) => {
  for (const missing of ['buildEvidence', 'domainAssurance'] as const) {
    const f = chain(t), gates = f.config.gates.map((entry, index) => index === 2 ? { ...entry, [missing]: null } : entry);
    const result = await f.create({ gates }).collect(f.input()); assert.equal(result.policyOutcome, 'blocked');
    assert.ok(result.gates[2]!.evaluation.reasons.includes(missing === 'buildEvidence' ? 'BUILD_EVIDENCE_REQUIRED' : 'DOMAIN_ASSURANCE_REQUIRED'));
  }
});

test('configuration requires the complete ordered same-item gate chain and input cannot install source facts', async (t) => {
  const f = chain(t);
  for (const gates of [[], [f.config.gates[1]], [f.config.gates[0], f.config.gates[2]], [...f.config.gates].reverse()]) assert.throws(() => f.create({ gates }));
  for (const field of ['scope', 'recordItem', 'recordPath']) {
    const config = structuredClone(f.config), source = config.gates[1]!.signerCollection.gateSource;
    if (field === 'scope') source.scope.itemId = 'foreign';
    if (field === 'recordItem') source.recordItem = 'foreign';
    if (field === 'recordPath') source.recordPath = config.gates[0]!.signerCollection.gateSource.recordPath;
    assert.throws(() => f.create(config));
  }
  const duplicate = structuredClone(f.config); duplicate.gates[0]!.critic.path = duplicate.gates[0]!.policy.path; assert.throws(() => f.create(duplicate));
  const service = f.create();
  for (const input of [{}, { ...f.input(), decisionDigest: '0'.repeat(64) }, { ...f.input(), policy: {} }, { ...f.input(), sourceRevision: 'main' }]) await assert.rejects(service.collect(input), failure);
  assert.equal(f.reads.length, 0); assert.equal(f.state.authCalls, 0);
});

test('final moved head, revoked collector or earlier signer expiry discards all assembled policy facts', async (t) => {
  const realNow = Date.now;
  try {
    for (const mode of ['head', 'actor', 'expiry', 'regression']) {
      const f = chain(t, 1), entry = f.config.gates[0]!, read = f.reader.readArtifact, base = realNow(); let clock = base;
      if (mode === 'expiry') {
        const signer = entry.signerCollection.signers[0]!, reference = { path: signer.source.trustPath, digest: signer.source.trustDigest };
        f.change(reference, value => { value.notAfter = new Date(base + 1000).toISOString(); }); signer.source.trustDigest = reference.digest;
      }
      Date.now = () => clock;
      f.reader.readArtifact = async (...args) => { const result = await read(...args); if (args[0] === entry.domainAssurance.exceptionBrief.path) {
        if (mode === 'head') f.state.head = 'd'.repeat(40);
        if (mode === 'actor') f.state.identity = { ...(f.state.identity as object), toolGrants: [] };
        if (mode === 'expiry') clock = base + 1000;
        if (mode === 'regression') clock = base - 1;
      } return result; };
      await assert.rejects(f.create().collect(f.input()), failure, mode); Date.now = realNow;
    }
  } finally { Date.now = realNow; }
});

test('real stalled policy read retains ownership and shutdown drains without late report reads', { timeout: 25000 }, async (t) => {
  const f = chain(t, 1), read = f.reader.readArtifact; let enter!: () => void, release!: () => void;
  const entered = new Promise<void>(resolve => { enter = resolve; }), held = new Promise<void>(resolve => { release = resolve; });
  f.reader.readArtifact = async (...args) => { if (args[0] === f.config.gates[0]!.policy.path) { enter(); await held; } return read(...args); };
  const service = f.create(), started = Date.now(), pending = service.collect(f.input()); await entered;
  await assert.rejects(service.collect(f.input()), failure); await assert.rejects(pending, failure); assert.ok(Date.now() - started >= 14900);
  assert.equal(service.status().active, true); let stopped = false; const stop = service.shutdown().then(() => { stopped = true; });
  await Promise.resolve(); assert.equal(stopped, false); const count = f.reads.length; release(); await stop;
  assert.equal(f.reads.length, count + 1); assert.equal(service.status().active, false); await assert.rejects(service.collect(f.input()), failure);
});

function nativeDomain(t: TestContext, native = false) {
  const f = chain(t, 2, native), entry = f.config.gates[1]!, ref = entry.domainAssurance.reviews[0]!, source = entry.signerCollection;
  const record = nativeDomainReviewFixture(), examPath = source.gateSource.artifactPaths[0]!, evidencePath = source.signers[0]!.source.signerAuthorization.path;
  record.target = { organization: source.gateSource.scope.organizationId, item: source.gateSource.recordItem,
    revision: source.gateSource.artifactRevision, exam: { path: examPath, sha256: hash(f.sources.get(examPath)!) } };
  record.evidence = [record.target.exam]; record.findings[0]!.evidence = [{ path: evidencePath, sha256: hash(f.sources.get(evidencePath)!) }];
  record.reviewedAt = new Date(Date.parse(source.signers[0]!.proof.expected.authenticatedAt) - 1000).toISOString();
  const selected = { ...ref, format: 'steer-domain-review-record/v1', domain: 'privacy', examPath,
    evidence: [record.target.exam, ...record.findings[0]!.evidence].map(value => ({ path: value.path, digest: value.sha256 })) };
  const repin = () => { f.sources.set(ref.path, JSON.stringify(record, null, 2) + '\n'); selected.digest = hash(f.sources.get(ref.path)!);
    f.change(entry.domainAssurance.exceptionBrief, value => { value.exceptionBrief.reviewDigests = [selected.digest]; }); };
  repin(); const configuration = () => ({ gates: [f.config.gates[0], { ...entry, domainAssurance: { ...entry.domainAssurance, reviews: [selected] } }] });
  if (native) f.commit();
  return { ...f, record, selected, repin, configuration };
}

test('native Git domain records retain original bytes and every pinned original-revision evidence reference through the policy chain', async t => {
  const f = nativeDomain(t, true), result = await f.create(f.configuration()).collect(f.input());
  assert.equal(result.policyOutcome, 'policy-satisfied'); const gate = result.gates[1]!, native = gate.nativeDomainReviews[0]!;
  assert.equal(native.linkedEvidenceVerified, true); assert.equal(native.observation.reviewerAuthenticityVerificationRequired, true);
  assert.equal(gate.sources.find(value => value.path === f.selected.path)!.content, JSON.stringify(f.record, null, 2) + '\n');
  for (const pin of f.selected.evidence) assert.ok(gate.sources.some(value => value.path === pin.path && value.contentDigest === pin.digest && value.revision === f.record.target.revision));
  assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
});

test('native reports cannot select new linked reads or omit finding-only evidence even with repinned report digests', async t => {
  for (const mode of ['new-path', 'missing', 'extra', 'digest', 'exam', 'late']) {
    const f = nativeDomain(t), before = f.reads.length;
    if (mode === 'new-path') f.record.findings[0]!.evidence[0]!.path = 'unapproved/secret.md';
    if (mode === 'missing') f.selected.evidence.pop();
    if (mode === 'extra') f.selected.evidence.push({ path: 'unapproved/secret.md', digest: 'a'.repeat(64) });
    if (mode === 'digest') f.selected.evidence[1]!.digest = 'a'.repeat(64);
    if (mode === 'exam') f.record.target.exam.sha256 = 'a'.repeat(64);
    if (mode === 'late') f.record.reviewedAt = new Date(Date.parse(f.config.gates[1]!.signerCollection.signers[0]!.proof.expected.signedAt) + 1).toISOString();
    f.repin(); await assert.rejects(f.create(f.configuration()).collect(f.input()), failure, mode);
    assert.ok(!f.reads.slice(before).includes('unapproved/secret.md'));
  }
});

test('native original-revision evidence corruption or a source move denies instead of accepting a matching review assertion', async t => {
  for (const mode of ['content', 'head', 'revision']) {
    const f = nativeDomain(t), read = f.reader.readArtifact, path = f.selected.evidence[1]!.path; let hit = false;
    f.reader.readArtifact = async (...args) => { const result = await read(...args);
      // The linked-evidence read follows the native report, not its earlier signer grant read.
      if (args[0] === f.selected.path) hit = true;
      if (hit && args[0] === path) {
        if (mode === 'content') result.content += 'changed';
        if (mode === 'head') f.state.head = 'd'.repeat(40);
        if (mode === 'revision') result.revision = f.state.head;
      } return result;
    };
    await assert.rejects(f.create(f.configuration()).collect(f.input()), failure, mode);
  }
});

test('native review admission requires Gate 2, a selected Exam and a complete duplicate-free startup evidence allowlist', t => {
  const f = nativeDomain(t);
  for (const selected of [{ ...f.selected, evidence: [] }, { ...f.selected, evidence: [f.selected.evidence[0], f.selected.evidence[0]] },
    { ...f.selected, examPath: 'unselected/EXAM.md' }, { ...f.selected, format: 'unknown' }]) {
    const entry = f.config.gates[1]!;
    assert.throws(() => f.create({ gates: [f.config.gates[0], { ...entry, domainAssurance: { ...entry.domainAssurance, reviews: [selected] } }] }));
  }
  const first = f.config.gates[0]!;
  assert.throws(() => f.create({ gates: [{ ...first, domainAssurance: { ...first.domainAssurance,
    reviews: [{ ...f.selected, examPath: first.signerCollection.gateSource.artifactPaths[0] }] } }] }));
  assert.equal(f.reads.length, 0);
});

test('native linked evidence is byte-bounded per file and across the collection without following the remaining links', async t => {
  for (const mode of ['file', 'aggregate']) {
    const f = nativeDomain(t), read = f.reader.readArtifact, content = 'x'.repeat(512 * 1024 + (mode === 'file' ? 1 : 0));
    const digest = hash(content), count = mode === 'file' ? 1 : 17;
    const refs = Array.from({ length: count }, (_, index) => ({ path: `large/evidence-${index}.md`, digest }));
    f.selected.evidence.push(...refs); f.record.evidence.push(...refs.map(value => ({ path: value.path, sha256: value.digest }))); f.repin();
    let largeReads = 0;
    f.reader.readArtifact = async (path, revision) => {
      if (path.startsWith('large/')) { largeReads++; return { organizationId: 'synthetic', repositoryId: 1, path, revision,
        content, contentDigest: digest, blobSha: blob(content) }; }
      return read(path, revision);
    };
    await assert.rejects(f.create(f.configuration()).collect(f.input()), failure);
    assert.ok(largeReads > 0); if (mode === 'aggregate') assert.ok(largeReads < count);
  }
});

function nativeException(t: TestContext, native = false) {
  const f = nativeDomain(t, native), entry = f.config.gates[1]!;
  const brief = nativeDomainExceptionFixture([{ path: f.selected.path, record: f.record }],
    new Date(Date.parse(entry.signerCollection.signers[0]!.proof.expected.authenticatedAt) - 500).toISOString());
  const reference = { ...entry.domainAssurance.exceptionBrief, format: 'steer-domain-exception-brief/v1',
    builderSubject: 'synthetic-builder', examPath: f.selected.examPath };
  const repin = () => { f.sources.set(f.selected.path, JSON.stringify(f.record, null, 2) + '\n'); f.selected.digest = hash(f.sources.get(f.selected.path)!);
    f.sources.set(reference.path, JSON.stringify(brief, null, 2) + '\n'); reference.digest = hash(f.sources.get(reference.path)!); };
  const configuration = () => ({ gates: [f.config.gates[0], { ...entry, domainAssurance: { reviews: [f.selected], exceptionBrief: reference } }] });
  repin(); if (native) f.commit(); return { ...f, brief, reference, repin, configuration };
}

test('native Git review and exception bytes reconstruct together before feeding the actual policy evaluator', async t => {
  const f = nativeException(t, true), result = await f.create(f.configuration()).collect(f.input());
  const gate = result.gates[1]!, native = gate.nativeDomainException!;
  assert.equal(result.policyOutcome, 'policy-satisfied'); assert.equal(native.sourceConsolidationVerified, true);
  assert.equal(native.reviewerAuthenticityVerificationRequired, true); assert.equal(native.gateVerified, false);
  assert.deepEqual(gate.input.domainAssurance!.exceptionBrief.reviewDigests, [f.selected.digest]);
  assert.equal(gate.sources.find(value => value.path === f.reference.path)!.content, JSON.stringify(f.brief, null, 2) + '\n');
  assert.equal(gate.input.domainAssurance!.exceptionBrief.digest, f.reference.digest); assert.ok(Object.isFrozen(native.record.domainSummaries));
  assert.equal(result.writeAuthorized, false);
});

test('a repinned native exception cannot suppress findings, replace reviewers, change source links or precede/follow the wrong events', async t => {
  for (const mode of ['finding', 'reviewer', 'path', 'before-review', 'after-signature', 'scope', 'oversize', 'head']) {
    const f = nativeException(t);
    // The declared consolidation is detached from its source record.
    Object.assign(f.brief, structuredClone(f.brief));
    if (mode === 'finding') f.brief.findings = [];
    if (mode === 'reviewer') f.brief.domainSummaries[0]!.reviewerServiceIdentity = 'replacement';
    if (mode === 'path') f.brief.domainSummaries[0]!.recordPath = 'unapproved/secret.md';
    if (mode === 'before-review') f.brief.generatedAt = new Date(Date.parse(f.record.reviewedAt) - 1).toISOString();
    if (mode === 'after-signature') f.brief.generatedAt = new Date(Date.parse(f.config.gates[1]!.signerCollection.signers[0]!.proof.expected.signedAt) + 1).toISOString();
    if (mode === 'scope') f.brief.item = 'foreign';
    f.repin();
    if (mode === 'oversize') { const text = ' '.repeat(512 * 1024 + 1); f.sources.set(f.reference.path, text); f.reference.digest = hash(text); }
    if (mode === 'head') { const read = f.reader.readArtifact; f.reader.readArtifact = async (...args) => {
      const result = await read(...args); if (args[0] === f.reference.path) f.state.head = 'd'.repeat(40); return result;
    }; }
    await assert.rejects(f.create(f.configuration()).collect(f.input()), failure, mode); assert.ok(!f.reads.includes('unapproved/secret.md'));
  }
});

test('native pending escalations and medium-confidence readiness do not satisfy the gate policy', async t => {
  for (const mode of ['escalation', 'medium']) {
    const f = nativeException(t);
    if (mode === 'escalation') { f.record.findings[0]!.status = 'open'; f.record.escalations.push({ triggerId: 'unresolved-blocker-or-major-finding', reason: 'Pending.', findingIds: ['CASE-OLD'] }); }
    else f.record.confidence = 'medium';
    Object.assign(f.brief, nativeDomainExceptionFixture([{ path: f.selected.path, record: f.record }], f.brief.generatedAt)); f.repin();
    const result = await f.create(f.configuration()).collect(f.input()); assert.equal(result.policyOutcome, 'blocked');
    assert.equal(result.gates[1]!.nativeDomainException!.record.eligibleForGateTwoCritic, mode === 'medium');
    assert.equal(result.writeAuthorized, false);
  }
});

test('native exception admission requires an explicit Builder, selected common Exam and exclusively native Gate 2 records', t => {
  const f = nativeException(t), entry = f.config.gates[1]!;
  for (const reference of [{ ...f.reference, builderSubject: '' }, { ...f.reference, examPath: 'unselected.md' }, { ...f.reference, format: 'unknown' }]) {
    assert.throws(() => f.create({ gates: [f.config.gates[0], { ...entry, domainAssurance: { reviews: [f.selected], exceptionBrief: reference } }] }));
  }
  assert.throws(() => f.create({ gates: [f.config.gates[0], { ...entry, domainAssurance: {
    reviews: [{ path: f.selected.path, digest: f.selected.digest }], exceptionBrief: f.reference } }] }));
  assert.equal(f.reads.length, 0);
});

function nativeCritic(t: TestContext, git = false) {
  const f = chain(t, 2, git), entry = f.config.gates[1]!, record = nativeCriticFixture();
  record.item = entry.signerCollection.gateSource.recordItem; record.targetRevision = entry.signerCollection.gateSource.artifactRevision;
  record.reviewedAt = JSON.parse(f.sources.get(entry.critic.path)!).critic.reportedAt;
  const reference = { ...entry.critic, format: 'steer-critic-review/v1', reviewerProvider: record.reviewer.provider as string,
    reviewerTask: record.reviewer.task as string, builderTask: '/synthetic/builder' };
  const repin = () => { const content = JSON.stringify(record, null, 2); f.sources.set(reference.path, content); reference.digest = hash(content); };
  repin();
  const configuration = () => ({ gates: [f.config.gates[0], { ...entry, critic: reference }] });
  return { ...f, record, reference, repin, configuration };
}

test('native Git Critic HOLD bytes survive source collection and block real gate policy despite passing test metadata', async t => {
  const f = nativeCritic(t, true); f.commit();
  const result = await f.create(f.configuration()).collect(f.input()), gate = result.gates[1]!;
  assert.equal(result.gates[0]!.nativeCritic, null); assert.deepEqual(gate.nativeCritic!.record, f.record);
  assert.equal(gate.nativeCritic!.record.pass, false); assert.equal(gate.input.critic!.unresolvedFindings, 6);
  assert.equal(gate.sources.find(value => value.path === f.reference.path)!.content, f.sources.get(f.reference.path));
  assert.equal(gate.input.critic!.reportDigest, f.reference.digest); assert.equal(gate.input.critic!.passed, false);
  assert.equal(gate.evaluation.outcome, 'blocked'); assert.equal(result.policyOutcome, 'blocked');
  assert.equal(gate.nativeCritic!.evidenceVerificationRequired, true); assert.equal(result.reviewAuthenticityVerificationRequired, true);
  assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
});

test('native Critic report substitution, contradictory counters and post-signature reviews reject before returning policy', async t => {
  for (const mode of ['digest', 'item', 'revision', 'reviewer', 'counter', 'time', 'future', 'pass', 'oversize', 'head']) {
    const f = nativeCritic(t);
    if (mode === 'item') f.record.item = 'foreign';
    if (mode === 'revision') f.record.targetRevision = 'd'.repeat(40);
    if (mode === 'reviewer') f.record.reviewer.task = '/different/task';
    if (mode === 'counter') f.record.unresolved.total = 0;
    if (mode === 'time') f.record.reviewedAt = f.config.gates[1]!.signerCollection.signers.at(-1)!.proof.expected.signedAt.replace(/Z$/, '1Z');
    if (mode === 'future') f.record.reviewedAt = '2099-01-01T00:00:00Z';
    if (mode === 'pass') f.record.pass = true;
    f.repin();
    if (mode === 'digest') f.reference.digest = 'd'.repeat(64);
    if (mode === 'oversize') { const value = ' '.repeat(512 * 1024 + 1); f.sources.set(f.reference.path, value); f.reference.digest = hash(value); }
    if (mode === 'head') { const read = f.reader.readArtifact; f.reader.readArtifact = async (...args) => {
      const value = await read(...args); if (args[0] === f.reference.path) f.state.head = 'd'.repeat(40); return value;
    }; }
    await assert.rejects(f.create(f.configuration()).collect(f.input()), failure, mode);
  }
});

test('native Critic startup must explicitly bind task/provider/Builder and cannot apply a Gate 2 format to another gate', t => {
  const f = nativeCritic(t), entry = f.config.gates[1]!;
  for (const reference of [{ ...f.reference, reviewerTask: '' }, { ...f.reference, reviewerProvider: '' },
    { ...f.reference, builderTask: '' }, { ...f.reference, format: 'unknown' }]) {
    assert.throws(() => f.create({ gates: [f.config.gates[0], { ...entry, critic: reference }] }));
  }
  assert.throws(() => f.create({ gates: [{ ...f.config.gates[0], critic: f.reference }] }));
  assert.equal(f.reads.length, 0);
});

function nativeRunner(t: TestContext, git = false) {
  const f = nativeDomain(t, git), attestor = reviewRunnerFixture(), entry = f.config.gates[1]!, scope = entry.signerCollection.gateSource.scope;
  Object.assign(attestor.trust, { organizationId: scope.organizationId, repository: scope.repository,
    reviewerSubject: f.record.reviewer.serviceIdentity, configurationRevision: f.record.reviewer.configurationRevision,
    notBefore: new Date(Date.parse(f.record.reviewedAt) - 2000).toISOString(), notAfter: new Date(Date.now() + 60000).toISOString() });
  Object.assign(attestor.payload, { organizationId: scope.organizationId, repository: scope.repository,
    reviewerSubject: f.record.reviewer.serviceIdentity, configurationRevision: f.record.reviewer.configurationRevision,
    recordItem: f.record.target.item, artifactRevision: f.record.target.revision, reportPath: f.selected.path, reportDigest: f.selected.digest,
    reviewedAt: f.record.reviewedAt, startedAt: new Date(Date.parse(f.record.reviewedAt) - 1000).toISOString(),
    recordedAt: new Date(Date.parse(f.record.reviewedAt) + 1).toISOString() });
  const runner = { trust: { path: 'gate-2/review-runner-trust.json', digest: '' }, proof: { path: 'gate-2/review-runner-proof.json', digest: '' },
    executionId: attestor.payload.executionId, builderExecutionId: attestor.payload.builderExecutionId };
  const seal = () => {
    for (const [ref, record] of [[runner.trust, attestor.trust], [runner.proof, attestor.encode()]] as const) {
      const content = JSON.stringify(record); f.sources.set(ref.path, content); ref.digest = hash(content);
    }
  };
  seal();
  const configuration = () => ({ gates: [f.config.gates[0], { ...entry, domainAssurance: { ...entry.domainAssurance, reviews: [{ ...f.selected, runner }] } }] });
  return { ...f, attestor, runner, seal, configuration };
}

test('native Git collector verifies actual runner signatures and retains source-pinned provenance without gate authority', async t => {
  const f = nativeRunner(t, true); f.commit();
  const result = await f.create(f.configuration()).collect(f.input()), native = result.gates[1]!.nativeDomainReviews[0]!;
  assert.ok(native.runnerAttestation); assert.equal(native.runnerAttestation.proofDigest, f.runner.proof.digest);
  assert.equal(native.runnerAttestation.trustDigest, f.runner.trust.digest);
  assert.equal(native.runnerAttestation.claims.reportDigest, f.selected.digest);
  assert.equal(native.runnerAttestation.claims.executionId, f.runner.executionId);
  for (const ref of [f.runner.trust, f.runner.proof]) assert.equal(result.gates[1]!.sources.find(value => value.path === ref.path)!.content, f.sources.get(ref.path));
  assert.equal(result.policyOutcome, 'policy-satisfied'); assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
  assert.equal(result.reviewAuthenticityVerificationRequired, true); assert.equal(native.runnerAttestation.runnerIsolationVerificationRequired, true);
});

test('configured runner proof is mandatory and wrong signed claims, keys, source encodings or chronology cannot fall back to raw review', async t => {
  for (const mode of ['missing', 'hash', 'report', 'configuration', 'execution', 'builder', 'domain', 'signature', 'key', 'order', 'late', 'bytes']) {
    const f = nativeRunner(t);
    if (mode === 'report') f.attestor.payload.reportDigest = 'f'.repeat(64);
    if (mode === 'configuration') f.attestor.payload.configurationRevision = 'foreign-configuration';
    if (mode === 'execution') f.attestor.payload.executionId = 'foreign-execution';
    if (mode === 'builder') f.attestor.payload.builderSubject = 'foreign-builder';
    if (mode === 'domain') { f.attestor.payload.domain = 'security'; f.attestor.trust.domain = 'security'; }
    if (mode === 'key') f.attestor.trust.publicKeyHex = 'f'.repeat(64);
    if (mode === 'late') f.attestor.payload.recordedAt = new Date(Date.parse(f.config.gates[1]!.signerCollection.signers.at(-1)!.proof.expected.signedAt) + 1).toISOString();
    f.seal();
    if (mode === 'missing') f.sources.delete(f.runner.proof.path);
    if (mode === 'hash') f.runner.proof.digest = 'f'.repeat(64);
    if (mode === 'signature') { const proof = f.attestor.encode(); proof.signatureBase64 = Buffer.alloc(64).toString('base64'); const content = JSON.stringify(proof);
      f.sources.set(f.runner.proof.path, content); f.runner.proof.digest = hash(content); }
    if (mode === 'order') { const content = JSON.stringify(Object.fromEntries(Object.entries(f.attestor.trust).reverse()));
      f.sources.set(f.runner.trust.path, content); f.runner.trust.digest = hash(content); }
    if (mode === 'bytes') { const content = ' '.repeat(65537); f.sources.set(f.runner.proof.path, content); f.runner.proof.digest = hash(content); }
    await assert.rejects(f.create(f.configuration()).collect(f.input()), failure, mode);
  }
});

test('all collected runner keys remain current at final policy completion, including a scheduled revocation boundary', async t => {
  const realNow = Date.now; let offset = 0;
  try {
    Date.now = () => realNow() + offset;
    for (const mode of ['expires', 'revokes', 'before']) {
      offset = 0; const f = nativeRunner(t), read = f.reader.readArtifact, base = realNow();
      f.attestor.trust[mode === 'revokes' ? 'revokedAt' : 'notAfter'] = new Date(base + 1000).toISOString(); f.seal();
      let observed = false;
      f.reader.readArtifact = async (...args) => { const result = await read(...args); if (args[0] === f.runner.proof.path) observed = true; return result; };
      f.reader.readHead = async () => { if (observed) offset = base + (mode === 'before' ? 500 : 1000) - realNow(); return f.state.head; };
      if (mode === 'before') assert.ok((await f.create(f.configuration()).collect(f.input())).gates[1]!.nativeDomainReviews[0]!.runnerAttestation);
      else await assert.rejects(f.create(f.configuration()).collect(f.input()), failure, mode);
      assert.ok(observed, 'The test must reach the actual runner proof before the completion-time clock change.');
    }
  } finally { Date.now = realNow; }
});

test('runner selection rejects ambiguous source paths and missing run identities before source access', t => {
  const f = nativeRunner(t);
  for (const runner of [{ ...f.runner, executionId: '' }, { ...f.runner, builderExecutionId: '' },
    { ...f.runner, trust: f.runner.proof }, { ...f.runner, proof: { ...f.runner.proof, path: f.selected.path } }]) {
    const configuration = f.configuration(); configuration.gates[1]!.domainAssurance.reviews = [{ ...f.selected, runner }];
    assert.throws(() => f.create(configuration));
  }
  assert.equal(f.reads.length, 0);
});

function criticHistory(t: TestContext, git = false) {
  const f = nativeCritic(t, git), entry = f.config.gates[1]!, prior = structuredClone(f.record), followup = JSON.parse(criticSource('ab1d036'));
  Object.assign(followup, { item: prior.item, targetRevision: prior.targetRevision, reviewedAt: prior.reviewedAt });
  prior.reviewedAt = new Date(Date.parse(followup.reviewedAt) - 1000).toISOString();
  for (const key of Object.keys(f.record)) delete f.record[key]; Object.assign(f.record, followup);
  f.reference.reviewerTask = followup.reviewer.task; f.repin();
  const previous = { path: 'gate-2/previous-critic.json', digest: '', artifactRevision: prior.targetRevision as string,
    reviewerProvider: prior.reviewer.provider as string, reviewerTask: prior.reviewer.task as string, builderTask: '/synthetic/builder' };
  const repinPrior = () => { const content = JSON.stringify(prior, null, 2); f.sources.set(previous.path, content); previous.digest = hash(content); }; repinPrior();
  const configuration = () => ({ gates: [f.config.gates[0], { ...entry, critic: { ...f.reference, history: [previous] } }] as const });
  return { ...f, prior, previous, repinPrior, configuration };
}

test('native Git policy retains the exact initial and followup Critic bytes and links every predecessor finding without clearing HOLD', async t => {
  const f = criticHistory(t, true); f.commit(); const result = await f.create(f.configuration()).collect(f.input());
  const history = result.gates[1]!.nativeCriticHistory; assert.ok(history);
  assert.equal(history.findingIds.length, 6); assert.deepEqual(history.records[0]!.record, f.prior); assert.deepEqual(history.records[1]!.record, f.record);
  for (const ref of [f.previous, f.reference]) assert.equal(result.gates[1]!.sources.find(value => value.path === ref.path)!.content, f.sources.get(ref.path));
  assert.equal(result.gates[0]!.nativeCriticHistory, null); assert.equal(result.policyOutcome, 'blocked');
  assert.equal(result.gateVerified, false); assert.equal(history.resolutionEvidenceVerificationRequired, true);
});

test('opt-in Critic ancestry verifies native review targets through the current source head without clearing HOLD', async t => {
  const f = criticHistory(t, true); f.commit();
  const config = f.configuration();
  const selected = { gates: [config.gates[0], { ...config.gates[1], critic: { ...config.gates[1].critic, ancestry: { maxCommits: 4 } } }] };
  const result = await f.create(selected).collect(f.input()), ancestry = result.gates[1]!.nativeCriticAncestry;
  assert.ok(ancestry); assert.equal(ancestry.links.length, 2);
  assert.equal(ancestry.links[0]!.ancestor, f.previous.artifactRevision);
  assert.equal(ancestry.links[1]!.descendant, f.state.head);
  assert.equal(result.gates[0]!.nativeCriticAncestry, null);
  assert.equal(result.policyOutcome, 'blocked'); assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
});

test('configured ancestry denies unrelated history, exhaustion, changed head and lost observation authority', async t => {
  for (const mode of ['unrelated', 'budget', 'head', 'grant']) {
    const f = criticHistory(t, true);
    if (mode === 'unrelated') {
      const tree = f.git('rev-parse', `${f.previous.artifactRevision}^{tree}`);
      const orphan = f.git('-c', 'commit.gpgsign=false', 'commit-tree', tree, '-m', 'Unrelated synthetic history');
      f.prior.targetRevision = orphan; f.previous.artifactRevision = orphan; f.repinPrior();
    }
    f.commit(); const read = f.reader.readCommit!;
    f.reader.readCommit = async revision => {
      const value = await read(revision);
      if (mode === 'head') f.state.head = 'f'.repeat(40);
      if (mode === 'grant') f.state.identity = { ...principalSchema.parse(f.state.identity), toolGrants: [] };
      return value;
    };
    const config = f.configuration();
    await assert.rejects(f.create({ gates: [config.gates[0], { ...config.gates[1], critic: {
      ...config.gates[1].critic, ancestry: { maxCommits: mode === 'budget' ? 1 : 4 },
    } }] }).collect(f.input()), failure, mode);
  }
});

test('ancestry startup requires bounded configuration, retained history and commit reader before I/O', t => {
  const f = criticHistory(t), config = f.configuration();
  for (const ancestry of [{ maxCommits: 1 }, { maxCommits: 101 }, { maxCommits: 0 }, { maxCommits: 4, bypass: true }]) {
    assert.throws(() => f.create({ gates: [config.gates[0], { ...config.gates[1], critic: { ...config.gates[1].critic, ancestry } }] }));
  }
  f.reader.readCommit = async () => { throw new Error('Unexpected read'); };
  assert.throws(() => f.create({ gates: [config.gates[0], { ...config.gates[1], critic: { ...f.reference, ancestry: { maxCommits: 4 } } }] }));
  assert.equal(f.reads.length, 0); assert.equal(f.state.authCalls, 0);
});

test('configured Critic history cannot be omitted, substituted, oversized or moved during collection even with coherent local counts', async t => {
  for (const mode of ['omit-resolved', 'omit-open', 'missing-source', 'digest', 'time', 'task', 'oversize', 'head']) {
    const f = criticHistory(t);
    if (mode === 'omit-resolved') f.record.originalFindingStatus.shift();
    if (mode === 'omit-open') { f.record.originalFindingStatus.splice(2, 1); f.record.unresolved.total--; f.record.unresolved.blocker--; }
    if (mode === 'time') f.prior.reviewedAt = new Date(Date.parse(f.record.reviewedAt) + 1).toISOString();
    if (mode === 'task') f.prior.reviewer.task = '/foreign/task';
    f.repin(); f.repinPrior();
    if (mode === 'missing-source') f.sources.delete(f.previous.path);
    if (mode === 'digest') f.previous.digest = 'd'.repeat(64);
    if (mode === 'oversize') { const content = ' '.repeat(512 * 1024 + 1); f.sources.set(f.previous.path, content); f.previous.digest = hash(content); }
    if (mode === 'head') { const read = f.reader.readArtifact; f.reader.readArtifact = async (...args) => { const value = await read(...args);
      if (args[0] === f.previous.path) f.state.head = 'd'.repeat(40); return value; }; }
    await assert.rejects(f.create(f.configuration()).collect(f.input()), failure, mode);
  }
});

test('history startup rejects missing pins, duplicate current/prior paths and more than fifteen predecessors before reads', t => {
  const f = criticHistory(t);
  for (const history of [[], [f.previous, f.previous], [{ ...f.previous, path: f.reference.path }],
    [{ ...f.previous, reviewerTask: '' }], Array(16).fill(f.previous)]) {
    const config = f.configuration();
    assert.throws(() => f.create({ gates: [config.gates[0], { ...config.gates[1], critic: { ...config.gates[1].critic, history } }] }));
  }
  assert.equal(f.reads.length, 0);
});

function criticRunner(t: TestContext, git = false) {
  const f = criticHistory(t, git), attestor = criticRunnerFixture(), source = f.config.gates[1]!.signerCollection.gateSource;
  Object.assign(attestor.trust, { organizationId: source.scope.organizationId, repository: source.scope.repository,
    reviewerProvider: f.record.reviewer.provider, reviewerTask: f.record.reviewer.task,
    notBefore: new Date(Date.parse(f.record.reviewedAt) - 2000).toISOString(), notAfter: new Date(Date.now() + 60000).toISOString() });
  Object.assign(attestor.payload, { organizationId: source.scope.organizationId, repository: source.scope.repository,
    reviewerProvider: f.record.reviewer.provider, reviewerTask: f.record.reviewer.task,
    recordItem: f.record.item, artifactRevision: f.record.targetRevision, reportPath: f.reference.path, reportDigest: f.reference.digest,
    reviewedAt: f.record.reviewedAt, startedAt: new Date(Date.parse(f.record.reviewedAt) - 1000).toISOString(),
    recordedAt: new Date(Date.parse(f.record.reviewedAt) + 1).toISOString() });
  const runner = { trust: { path: 'gate-2/critic-runner-trust.json', digest: '' }, proof: { path: 'gate-2/critic-runner-proof.json', digest: '' },
    executionId: attestor.payload.executionId, builderExecutionId: attestor.payload.builderExecutionId, configurationRevision: attestor.payload.configurationRevision };
  const seal = () => { for (const [reference, value] of [[runner.trust, attestor.trust], [runner.proof, attestor.encode()]] as const) {
    const content = JSON.stringify(value); f.sources.set(reference.path, content); reference.digest = hash(content);
  } }; seal();
  const configuration = () => { const prior = f.configuration(); return { gates: [prior.gates[0], { ...prior.gates[1], critic: { ...prior.gates[1].critic, runner } }] as const }; };
  return { ...f, attestor, runner, seal, configuration };
}

test('actual native Git verifies Critic runner provenance alongside retained history and never clears the original HOLD', async t => {
  const f = criticRunner(t, true); f.commit(); const result = await f.create(f.configuration()).collect(f.input());
  const gate = result.gates[1]!, proof = gate.nativeCriticRunner; assert.ok(proof); assert.ok(gate.nativeCriticHistory);
  assert.equal(proof.proofDigest, f.runner.proof.digest); assert.equal(proof.trustDigest, f.runner.trust.digest);
  assert.equal(proof.claims.reportDigest, f.reference.digest); assert.equal(proof.claims.reviewerTask, f.record.reviewer.task);
  assert.equal(proof.runnerIsolationVerificationRequired, true); assert.equal(result.gates[0]!.nativeCriticRunner, null);
  assert.equal(gate.input.critic!.passed, false); assert.equal(result.policyOutcome, 'blocked'); assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
  for (const ref of [f.runner.trust, f.runner.proof]) assert.equal(gate.sources.find(value => value.path === ref.path)!.content, f.sources.get(ref.path));
});

test('selected Critic runner evidence cannot fall back on missing, forged, foreign, late or contradictory native claims', async t => {
  for (const mode of ['missing', 'hash', 'signature', 'report', 'task', 'provider', 'configuration', 'run', 'builder', 'late', 'context', 'trust-order', 'oversize', 'head']) {
    const f = criticRunner(t);
    if (mode === 'report') f.attestor.payload.reportDigest = 'f'.repeat(64);
    if (mode === 'task') f.attestor.payload.reviewerTask = '/foreign/task';
    if (mode === 'provider') f.attestor.payload.reviewerProvider = 'foreign';
    if (mode === 'configuration') f.attestor.payload.configurationRevision = 'foreign';
    if (mode === 'run') f.attestor.payload.executionId = 'foreign';
    if (mode === 'builder') f.attestor.payload.builderTask = '/foreign/builder';
    if (mode === 'late') f.attestor.payload.recordedAt = new Date(Date.parse(f.config.gates[1]!.signerCollection.signers.at(-1)!.proof.expected.signedAt) + 1).toISOString();
    if (mode === 'context') { f.record.reviewer.inheritedConversation = true; f.repin(); f.attestor.payload.reportDigest = f.reference.digest; }
    f.seal();
    if (mode === 'missing') f.sources.delete(f.runner.proof.path);
    if (mode === 'hash') f.runner.proof.digest = 'f'.repeat(64);
    if (mode === 'signature') { const proof = f.attestor.encode(); proof.signatureBase64 = Buffer.alloc(64).toString('base64');
      const content = JSON.stringify(proof); f.sources.set(f.runner.proof.path, content); f.runner.proof.digest = hash(content); }
    if (mode === 'trust-order') { const content = JSON.stringify(Object.fromEntries(Object.entries(f.attestor.trust).reverse()));
      f.sources.set(f.runner.trust.path, content); f.runner.trust.digest = hash(content); }
    if (mode === 'oversize') { const content = ' '.repeat(65537); f.sources.set(f.runner.proof.path, content); f.runner.proof.digest = hash(content); }
    if (mode === 'head') { const read = f.reader.readArtifact; f.reader.readArtifact = async (...args) => { const value = await read(...args);
      if (args[0] === f.runner.proof.path) f.state.head = 'd'.repeat(40); return value; }; }
    await assert.rejects(f.create(f.configuration()).collect(f.input()), failure, mode);
  }
});

test('Critic runner expiry and scheduled revocation remain enforced after all later review/history reads', async t => {
  const realNow = Date.now; let offset = 0;
  try {
    Date.now = () => realNow() + offset;
    for (const mode of ['expires', 'revokes', 'before']) {
      offset = 0; const f = criticRunner(t), read = f.reader.readArtifact, base = realNow();
      f.attestor.trust[mode === 'revokes' ? 'revokedAt' : 'notAfter'] = new Date(base + 1000).toISOString(); f.seal();
      let historyRead = false;
      f.reader.readArtifact = async (...args) => { const value = await read(...args); if (args[0] === f.previous.path) historyRead = true; return value; };
      f.reader.readHead = async () => { if (historyRead) offset = base + (mode === 'before' ? 500 : 1000) - realNow(); return f.state.head; };
      if (mode === 'before') assert.ok((await f.create(f.configuration()).collect(f.input())).gates[1]!.nativeCriticRunner);
      else await assert.rejects(f.create(f.configuration()).collect(f.input()), failure, mode);
      assert.ok(historyRead, 'The intended later history boundary must be reached before the clock change.');
    }
  } finally { Date.now = realNow; }
});

test('Critic runner startup requires full run/configuration identity and disjoint current/history/proof paths before I/O', t => {
  const f = criticRunner(t), selected = f.configuration();
  for (const runner of [{ ...f.runner, executionId: '' }, { ...f.runner, builderExecutionId: '' }, { ...f.runner, configurationRevision: '' },
    { ...f.runner, trust: f.runner.proof }, { ...f.runner, proof: { ...f.runner.proof, path: f.previous.path } }]) {
    assert.throws(() => f.create({ gates: [selected.gates[0], { ...selected.gates[1], critic: { ...selected.gates[1].critic, runner } }] }));
  }
  assert.equal(f.reads.length, 0);
});
