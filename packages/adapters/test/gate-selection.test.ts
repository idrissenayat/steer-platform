import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { principalSchema } from '@steer/tool-registry';
import { createGitGatePolicyCollector } from '../src/code-host/gate-policy.ts';
import { chain } from './gate-policy-chain-fixture.ts';
import { selectChain } from './gate-selection-fixture.ts';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const failure = /^Error: Gate policy source collection could not be verified\.$/;

test('native Git selection binds the whole configured chain and exact current source without upgrading governance', async t => {
  const f = chain(t, 2, true), selected = selectChain(f), service = f.create(selected.configuration); t.after(() => service.shutdown());
  const result = await service.collect(f.input());
  assert.equal(result.policyOutcome, 'policy-satisfied'); assert.deepEqual(result.selectionSource, {
    path: selected.reference.path, revision: f.state.head, contentDigest: selected.reference.digest,
    blobSha: f.git('rev-parse', `${f.state.head}:${selected.reference.path}`), configurationDigest: hash(JSON.stringify(selected.document.configuration)),
  });
  assert.ok(Object.isFrozen(result.selectionSource)); assert.equal(result.governedSelectionVerificationRequired, true);
  assert.equal(result.reviewAuthenticityVerificationRequired, true); assert.equal(result.currentSourceVerificationRequired, true);
  assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
  f.sources.set('unrelated.txt', 'A later unrelated source commit'); f.commit();
  const again = await service.collect(f.input()); assert.notEqual(again.selectionSource!.revision, result.selectionSource!.revision);
  assert.equal(again.selectionSource!.configurationDigest, result.selectionSource!.configurationDigest);
  const legacy = f.create(); t.after(() => legacy.shutdown()); assert.equal((await legacy.collect(f.input())).selectionSource, null);
});

test('selection cannot substitute scopes, signers, proof pins, policy or evidence sets even with a repinned manifest', async t => {
  const f = chain(t, 2), selected = selectChain(f);
  const changes: ((value: typeof selected.document) => void)[] = [
    value => { value.organizationId = 'foreign'; }, value => { value.repository = 'github:2'; }, value => { value.branch = 'other'; },
    value => { value.configuration.gates.pop(); }, value => { value.configuration.gates.reverse(); },
    value => { value.configuration.gates[1]!.signerCollection.signers.pop(); },
    value => { value.configuration.gates[1]!.signerCollection.signers[0]!.source.trustDigest = 'f'.repeat(64); },
    value => { value.configuration.gates[1]!.signerCollection.signers[0]!.proof.identityProofPath = 'another-proof.json'; },
    value => { value.configuration.gates[1]!.policy.digest = 'f'.repeat(64); },
    value => { value.configuration.gates[1]!.critic.path = 'other-critic.json'; },
    value => { value.configuration.gates[1]!.domainAssurance!.reviews = []; },
    value => { value.configuration.gates[1]!.domainAssurance!.exceptionBrief.digest = 'f'.repeat(64); },
  ];
  for (const change of changes) {
    const document = structuredClone(selected.document); change(document); const content = JSON.stringify(document);
    f.sources.set(selected.reference.path, content); const before = f.reads.length;
    const service = f.create({ ...selected.configuration, selection: { path: selected.reference.path, digest: hash(content) } });
    await assert.rejects(service.collect(f.input()), failure); await service.shutdown();
    assert.deepEqual(f.reads.slice(before), [selected.reference.path]);
  }
});

test('selection checks exact bytes, hashes, tuple, JSON and size before following any policy source', async t => {
  const f = chain(t, 2), selected = selectChain(f), original = f.reader.readArtifact;
  for (const mode of ['tenant', 'repository', 'path', 'revision', 'digest', 'blob', 'content', 'surrogate', 'oversize', 'duplicate-json', 'pretty-json', 'extra-field']) {
    let content = selected.content;
    if (mode === 'surrogate') content = '\ud800';
    if (mode === 'oversize') content = 'x'.repeat(512 * 1024 + 1);
    if (mode === 'duplicate-json') content = selected.content.replace('{', '{"version":"discarded",');
    if (mode === 'pretty-json') content = JSON.stringify(selected.document, null, 2);
    if (mode === 'extra-field') content = JSON.stringify({ ...selected.document, approved: true });
    f.sources.set(selected.reference.path, content);
    f.reader.readArtifact = async (path, revision) => {
      const value = await original(path, revision); if (path !== selected.reference.path) return value;
      return { ...value, ...(mode === 'tenant' ? { organizationId: 'foreign' } : mode === 'repository' ? { repositoryId: 2 } :
        mode === 'path' ? { path: 'other.json' } : mode === 'revision' ? { revision: 'f'.repeat(40) } :
        mode === 'digest' ? { contentDigest: 'f'.repeat(64) } : mode === 'blob' ? { blobSha: 'f'.repeat(40) } : mode === 'content' ? { content: 'changed' } : {}) };
    };
    const service = f.create({ ...selected.configuration, selection: { path: selected.reference.path, digest: hash(content) } }), before = f.reads.length;
    await assert.rejects(service.collect(f.input()), failure, mode); await service.shutdown(); assert.deepEqual(f.reads.slice(before), [selected.reference.path]);
  }
});

test('selection path cannot alias another configured source role and is rejected before I/O', t => {
  const f = chain(t, 2), selected = selectChain(f), gate = f.config.gates[0]!;
  for (const path of [gate.signerCollection.gateSource.recordPath, ...gate.signerCollection.gateSource.artifactPaths,
    gate.policy.path, gate.critic.path, gate.signerCollection.signers[0]!.source.trustPath,
    gate.signerCollection.signers[0]!.proof.identityProofPath]) {
    assert.throws(() => f.create({ ...selected.configuration, selection: { path, digest: selected.reference.digest } }), /Invalid gate policy selection/);
  }
  assert.equal(f.reads.length, 0); assert.equal(f.state.authCalls, 0);
  const large = chain(t, 3), declared = selectChain(large);
  for (const gate of declared.configuration.gates) for (const signer of gate.signerCollection.signers) {
    signer.source.proofPaths.push(...Array.from({ length: 99 }, (_, index) => `proofs/${'x'.repeat(380)}-${index}.json`));
    signer.source.signerIdentity!.proofPaths.push(...Array.from({ length: 99 }, (_, index) => `identity/${'x'.repeat(380)}-${index}.json`));
  }
  assert.throws(() => large.create(declared.configuration), /Invalid gate policy selection/);
  assert.equal(large.reads.length, 0); assert.equal(large.state.authCalls, 0);
});

test('selection observer revocation, identity substitution, expiry, rollback and moving head deny at the read boundary', async t => {
  const realNow = Date.now;
  try {
    for (const mode of ['revoked', 'subject', 'expiry', 'rollback', 'head'] as const) {
      const f = chain(t, 2), selected = selectChain(f), original = f.reader.readArtifact; let clock = realNow(); Date.now = () => clock;
      f.reader.readArtifact = async (path, revision) => {
        const result = await original(path, revision);
        if (path === selected.reference.path) {
          if (mode === 'revoked') f.state.identity = null;
          if (mode === 'subject') f.state.identity = { ...principalSchema.parse(f.state.identity), subject: 'another-observer' };
          if (mode === 'expiry') clock = Date.parse(principalSchema.parse(f.state.identity).expiresAt);
          if (mode === 'rollback') clock--;
          if (mode === 'head') f.state.head = 'f'.repeat(40);
        }
        return result;
      };
      const service = f.create(selected.configuration); await assert.rejects(service.collect(f.input()), failure, mode); await service.shutdown();
      assert.deepEqual(f.reads, [selected.reference.path]); Date.now = realNow;
    }
  } finally { Date.now = realNow; }
});

test('selection timeout keeps admission closed and shutdown drains an ignored-abort source without following later evidence', async t => {
  const f = chain(t, 2), selected = selectChain(f), original = f.reader.readArtifact;
  let enter!: () => void, release!: () => void; const entered = new Promise<void>(resolve => { enter = resolve; });
  const pending = new Promise<void>(resolve => { release = resolve; });
  f.reader.readArtifact = async (path, revision) => { enter(); await pending; return original(path, revision); };
  const service = createGitGatePolicyCollector(f.reader, selected.configuration, async () => f.state.identity);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const work = service.collect(f.input()); await Promise.race([entered, work.then(() => { throw new Error('Selection read was not reached.'); })]);
    await assert.rejects(service.collect(f.input()), failure); let stopped = false;
    const shutdown = service.shutdown().then(() => { stopped = true; });
    const denied = assert.rejects(work, failure); t.mock.timers.tick(15000); await denied; assert.equal(stopped, false);
    release(); await shutdown; assert.deepEqual(f.reads, [selected.reference.path]); await assert.rejects(service.collect(f.input()), failure);
  } finally { release(); await service.shutdown(); }
});
