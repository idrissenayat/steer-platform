import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import { fixture, hash } from './gate-signers-fixture.ts';
import type { RepositoryReader } from '../src/code-host/github.ts';
import { createGitGatePolicyCollector } from '../src/code-host/gate-policy.ts';
const blob = (text: string) => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
export function chain(t: TestContext, count: 1 | 2 | 3 = 3, native = false) {
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
  return { config, sources, state, reader, input, reads, change, commit, parts, git, directory,
    create: (configuration: unknown = config) => createGitGatePolicyCollector(reader, configuration, async () => { state.authCalls++; return state.identity; }) };
}
