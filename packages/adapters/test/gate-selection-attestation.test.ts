import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chain } from './gate-policy-chain-fixture.ts';
import { attestSelection } from './gate-selection-attestation-fixture.ts';
import { principalSchema } from '@steer/tool-registry';
const failure = /^Error: Gate policy source collection could not be verified\.$/;

test('current native Git selection and separate pinned attestation join the policy collector without unlocking governance', async t => {
  const f = chain(t, 2, true), selected = attestSelection(f), collector = f.create(selected.configuration); t.after(() => collector.shutdown());
  const result = await collector.collect(f.input()); assert.ok(result.selectionAttestation);
  assert.equal(result.selectionAttestation.claims.selectionDigest, result.selectionSource!.contentDigest);
  assert.equal(result.selectionAttestation.claims.configurationDigest, result.selectionSource!.configurationDigest);
  assert.equal(result.selectionAttestation.trustDigest, selected.attestation.trust.digest);
  assert.equal(result.selectionAttestation.proofDigest, selected.attestation.proof.digest);
  assert.ok(Object.isFrozen(result.selectionAttestation)); assert.equal(result.policyOutcome, 'policy-satisfied');
  assert.equal(result.governedSelectionVerificationRequired, true); assert.equal(result.reviewAuthenticityVerificationRequired, true);
  assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
  assert.deepEqual(f.reads.slice(0, 3), [selected.reference.path, selected.attestation.trust.path, selected.attestation.proof.path]);
  f.sources.set('unrelated.txt', 'unrelated later commit'); f.commit();
  assert.equal((await collector.collect(f.input())).selectionAttestation!.proofDigest, result.selectionAttestation.proofDigest);
  const legacy = f.create(); t.after(() => legacy.shutdown()); assert.equal((await legacy.collect(f.input())).selectionAttestation, null);
});

test('repinned genuine signatures cannot substitute the selected manifest, configuration, platform, decision or selector', async t => {
  for (const change of [{ selectionDigest: 'f'.repeat(64) }, { configurationDigest: 'f'.repeat(64) }, { platformRevision: 'f'.repeat(40) },
    { decisionDigest: 'f'.repeat(64) }, { selectorSubject: 'other' }, { selectionId: 'other' }]) {
    const f = chain(t, 2), selected = attestSelection(f); Object.assign(selected.proof.payload, change); selected.publish();
    const collector = f.create(selected.configuration); await assert.rejects(collector.collect(f.input()), failure); await collector.shutdown();
    assert.deepEqual(f.reads, [selected.reference.path, selected.attestation.trust.path, selected.attestation.proof.path]);
  }
});

test('attestation sources reject wrong tuples, raw bytes, blobs and digests before policy reads', async t => {
  for (const mode of ['organizationId', 'repositoryId', 'path', 'revision', 'contentDigest', 'blobSha', 'content'] as const) {
    const f = chain(t, 2), selected = attestSelection(f), original = f.reader.readArtifact;
    f.reader.readArtifact = async (path, revision) => {
      const value = await original(path, revision); return path === selected.attestation.proof.path
        ? { ...value, [mode]: mode === 'repositoryId' ? 99 : 'corrupt' } : value;
    };
    const collector = f.create(selected.configuration); await assert.rejects(collector.collect(f.input()), failure); await collector.shutdown();
    assert.equal(f.reads.length, 3);
  }
});

test('observer revocation, substitution and head drift deny after attestation reads; expiry during later collection denies final output', async t => {
  for (const mode of ['revoked', 'subject', 'head', 'expiry'] as const) {
    const f = chain(t, 2), selected = attestSelection(f), original = f.reader.readArtifact, realNow = Date.now;
    let now = realNow(); Date.now = () => now;
    // Expiry is later than the selected proof check but inside the 15-second collection deadline.
    if (mode === 'expiry') { selected.proof.payload.validBefore = new Date(now + 1000).toISOString(); selected.publish(); }
    f.reader.readArtifact = async (path, revision) => {
      const value = await original(path, revision);
      if (path === selected.attestation.proof.path) {
        if (mode === 'revoked') f.state.identity = null;
        if (mode === 'subject') f.state.identity = { ...principalSchema.parse(f.state.identity), subject: 'other-observer' };
        if (mode === 'head') f.state.head = 'f'.repeat(40);
      }
      if (mode === 'expiry' && path === f.config.gates[0]!.policy.path) now += 1000;
      return value;
    };
    const collector = f.create(selected.configuration);
    try { await assert.rejects(collector.collect(f.input()), failure); }
    finally { Date.now = realNow; await collector.shutdown(); }
    if (mode !== 'expiry') assert.equal(f.reads.length, 3);
  }
});

test('selection, trust and proof paths cannot alias each other or any selected policy source', t => {
  const f = chain(t, 2), selected = attestSelection(f);
  for (const path of [selected.reference.path, selected.attestation.trust.path, f.config.gates[0]!.policy.path]) {
    const config = structuredClone(selected.configuration); config.selection.attestation.proof.path = path;
    assert.throws(() => f.create(config), /Invalid gate policy selection/);
  }
  assert.equal(f.reads.length, 0); assert.equal(f.state.authCalls, 0);
});
