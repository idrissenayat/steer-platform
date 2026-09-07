import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createGitGateSignerCollector } from '../src/code-host/gate-signers.ts';
import type { RepositoryReader } from '../src/code-host/github.ts';
import { providerProofFixture } from './gate-proof-fixture.ts';
import { identityProofFixture } from './gate-identity-fixture.ts';
import { qualificationProofFixture } from './gate-qualification-fixture.ts';

export const hash = (content: string) => createHash('sha256').update(content).digest('hex');
const blob = (content: string) => createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex');
export function fixture(t: { after: (cleanup: () => void) => void }, native = false, gate: 1 | 2 | 3 = 2, now = Date.now(), organizationId = 'synthetic') {
  const directory = native ? mkdtempSync(join(tmpdir(), 'steer-0139-')) : undefined;
  if (directory) t.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
  const put = (path: string, content: string) => { const file = join(directory!, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, content); };
  const at = (delta: number) => new Date(now + delta).toISOString(), issuer = 'https://identity.synthetic.invalid';
  const hats = gate === 1 ? ['product-lead', 'product-designer', 'specialist'] : gate === 2 ? ['tech-lead', 'specialist'] : ['product-lead', 'tech-lead', 'specialist'];
  const scope = { organizationId, repository: 'github:1', itemId: 'intent/0139' };
  const grant = { organizationId: scope.organizationId, subject: 'synthetic-human', issuer, type: 'human', hats,
    toolGrants: [], active: true, validAfter: at(-10000), expiresAt: at(120000) };
  const sources = new Map([['BRIEF.md', '# Synthetic Brief\n'], ['organization/authorization.json', JSON.stringify({ version: 'steer-authorization/v1', organizationId: scope.organizationId, records: [grant] })]]);
  const original = new Map(sources);
  if (native) {
    git('init', '-q', '-b', 'synthetic'); git('config', 'user.name', 'Synthetic Test'); git('config', 'user.email', 'test@synthetic.invalid');
    for (const [path, content] of sources) put(path, content);
    git('add', '.'); git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'Original artifacts and grants');
  }
  const revision = native ? git('rev-parse', 'HEAD') : 'a'.repeat(40);
  const record = { version: 'steer-gate-signature/v1', organization: scope.organizationId, productHome: 'https://github.com/synthetic/synthetic',
    item: 'synthetic-item', gate, artifactRevision: revision, decision: 'approved', artifacts: [{ path: 'BRIEF.md', revision }],
    signatures: hats.map((hat, index) => ({ subject: grant.subject, hat, sequence: index + 1, signedAt: at(-6000) })) };
  const recordPath = 'gates/record.json'; sources.set(recordPath, JSON.stringify(record));
  const providers = hats.map(() => providerProofFixture());
  const identities: ReturnType<typeof identityProofFixture>[] = [], qualifications: ReturnType<typeof qualificationProofFixture>[] = [];
  const signers = providers.map((provider, index) => {
    Object.assign(provider.expected, { ...scope, gate, artifactRevision: revision, decisionDigest: hash(sources.get(recordPath)!),
      subject: grant.subject, hat: record.signatures[index]!.hat, sequence: index + 1, sessionId: `synthetic-human-session-${gate}`, authenticatedAt: at(-7000),
      signedAt: at(-6000), authorizationEvidenceDigest: hash(sources.get('organization/authorization.json')!) });
    Object.assign(provider.payload, provider.expected, { recordedAt: at(-5000) });
    Object.assign(provider.trust, { organizationId, notBefore: at(-10000), notAfter: at(120000) });
    const identity = identityProofFixture(provider);
    identities.push(identity);
    Object.assign(identity.trust, { notBefore: at(-10000), notAfter: at(120000) });
    Object.assign(identity.payload, { authenticatedAt: at(-7000), authenticationExpiresAt: at(120000), recordedAt: at(-6500) });
    const prefix = `evidence/${index}`, trustPath = `organization/${index}-provider.json`, proofPath = `${prefix}-provider.json`;
    const identityTrustPath = `organization/${index}-identity.json`, identityProofPath = `${prefix}-identity.json`;
    sources.set(identityTrustPath, JSON.stringify(identity.trust)); sources.set(identityProofPath, JSON.stringify(identity.encode()));
    provider.expected.identityEvidenceDigest = hash(sources.get(identityProofPath)!); provider.payload.identityEvidenceDigest = provider.expected.identityEvidenceDigest;
    sources.set(trustPath, JSON.stringify(provider.trust)); sources.set(proofPath, JSON.stringify(provider.encode()));
    const qualification = qualificationProofFixture();
    qualifications.push(qualification);
    Object.assign(qualification.trust, { organizationId, notBefore: at(-10000), notAfter: at(120000) });
    Object.assign(qualification.payload, { organizationId, validAfter: at(-10000), validThrough: at(120000), recordedAt: at(-8000) });
    const qualificationTrustPath = `organization/${index}-qualification.json`, qualificationProofPath = `${prefix}-qualification.json`;
    sources.set(qualificationTrustPath, JSON.stringify(qualification.trust)); sources.set(qualificationProofPath, JSON.stringify(qualification.encode()));
    return { source: { organizationId: scope.organizationId, repository: scope.repository, branch: 'synthetic', trustPath, trustDigest: hash(sources.get(trustPath)!), proofPaths: [proofPath],
      signerAuthorization: { path: 'organization/authorization.json', issuer },
      signerIdentity: { trustPath: identityTrustPath, trustDigest: hash(sources.get(identityTrustPath)!), proofPaths: [identityProofPath] },
      ...(hats[index] === 'specialist' ? { specialistQualification: { trustPath: qualificationTrustPath, trustDigest: hash(sources.get(qualificationTrustPath)!),
        proofPath: qualificationProofPath, proofDigest: hash(sources.get(qualificationProofPath)!), requiredDomains: ['privacy'] } } : {}) },
      proof: { proofPath, proofDigest: hash(sources.get(proofPath)!), authorizationRevision: revision, identityProofPath, expected: provider.expected } };
  });
  const config = { gateSource: { scope, gate, artifactRevision: revision, artifactPaths: ['BRIEF.md'], recordPath, recordItem: record.item }, signers };
  const actor = { subject: 'synthetic-collector', organizationId: scope.organizationId, type: 'agent', hats: [], toolGrants: ['gate.observe'], expiresAt: at(120000) };
  const state = { head: 'b'.repeat(40), reads: [] as string[], authCalls: 0, identity: actor as unknown };
  const commit = () => { for (const [path, content] of sources) put(path, content); git('add', '.'); git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'Current evidence'); state.head = git('rev-parse', 'HEAD'); };
  if (native) commit();
  const contentAt = (path: string, atRevision: string) => native ? execFileSync('git', ['show', `${atRevision}:${path}`], { cwd: directory, encoding: 'utf8' }) : (atRevision === revision ? original : sources).get(path)!;
  const reader: RepositoryReader = { binding: { organizationId: scope.organizationId, repositoryId: 1, installationId: 1, owner: 'synthetic', repository: 'synthetic', branch: 'synthetic' },
    readHead: async () => state.head,
    readArtifact: async (path, atRevision) => { state.reads.push(path); const content = contentAt(path, atRevision); if (content === undefined) throw new Error('Synthetic source missing.');
      return { organizationId: scope.organizationId, repositoryId: 1, path, revision: atRevision, content, contentDigest: hash(content), blobSha: native ? git('rev-parse', `${atRevision}:${path}`) : blob(content) }; },
    readInventory: async (_selection, atRevision) => ({ organizationId: scope.organizationId, repositoryId: 1, revision: atRevision,
      treeSha: native ? git('rev-parse', `${atRevision}^{tree}`) : 'c'.repeat(40), entries: [{ path: recordPath, blobSha: blob(contentAt(recordPath, atRevision)) }] }),
  };
  const repin = () => { sources.set(recordPath, JSON.stringify(record)); for (const [index, provider] of providers.entries()) {
    provider.expected.decisionDigest = hash(sources.get(recordPath)!); provider.payload.decisionDigest = provider.expected.decisionDigest;
    sources.set(signers[index]!.proof.proofPath, JSON.stringify(provider.encode())); signers[index]!.proof.proofDigest = hash(sources.get(signers[index]!.proof.proofPath)!);
  } };
  return { config, reader, state, sources, original, record, providers, identities, qualifications, grant, commit, repin,
    input: () => ({ sourceRevision: state.head, decisionDigest: hash(sources.get(recordPath)!) }),
    create: (configuration: unknown = config) => createGitGateSignerCollector(reader, configuration, async () => { state.authCalls++; return state.identity; }) };
}
