import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { briefWriteAuthoritySchema } from '@steer/tool-registry';
import { createGitGatePolicyCollector } from '../src/code-host/gate-policy.ts';
import { fixture, hash } from './gate-signers-fixture.ts';
import type { RepositoryReader } from '../src/code-host/github.ts';
import { nativeDomainReviewFixture } from './native-domain-review-fixture.ts';

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
  const change = (reference: { path: string; digest: string }, edit: (value: any) => void, repin = true) => {
    const value = JSON.parse(sources.get(reference.path)!); edit(value); sources.set(reference.path, JSON.stringify(value)); if (repin) reference.digest = hash(sources.get(reference.path)!);
  };
  return { config, sources, state, reader, input, reads, change, commit, parts,
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
