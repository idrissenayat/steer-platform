import { createHash } from 'node:crypto';
import type { chain } from './gate-policy-chain-fixture.ts';
import { selectChain } from './gate-selection-fixture.ts';
import { selectionProofFixture } from './gate-selection-proof-fixture.ts';

/** Actual source files, synthetic attestor. No live selection approval. */
export function attestSelection(f: ReturnType<typeof chain>) {
  const selected = selectChain(f), proof = selectionProofFixture(), now = Date.now();
  Object.assign(proof.trust, { organizationId: f.reader.binding.organizationId, repository: `github:${f.reader.binding.repositoryId}`,
    branch: f.reader.binding.branch, notBefore: new Date(now - 60000).toISOString(), notAfter: new Date(now + 60000).toISOString() });
  Object.assign(proof.payload, { organizationId: proof.trust.organizationId, repository: proof.trust.repository, branch: proof.trust.branch,
    recordItem: f.config.gates[0]!.signerCollection.gateSource.recordItem,
    platformRevision: f.config.gates.at(-1)!.signerCollection.gateSource.artifactRevision, decisionDigest: f.input().decisionDigest,
    selectionPath: selected.reference.path, selectionDigest: selected.reference.digest,
    configurationDigest: createHash('sha256').update(JSON.stringify(selected.document.configuration)).digest('hex'),
    selectedAt: new Date(now - 1000).toISOString(), recordedAt: new Date(now - 500).toISOString(), validBefore: new Date(now + 30000).toISOString() });
  const attestation = { trust: { path: '.steer/selection-trust.json', digest: '' }, proof: { path: '.steer/selection-proof.json', digest: '' },
    selectorSubject: proof.payload.selectorSubject, selectionId: proof.payload.selectionId, selectedAt: proof.payload.selectedAt };
  const publish = () => {
    const envelope = proof.encode(); attestation.trust.digest = proof.digest(proof.trust); attestation.proof.digest = proof.digest(envelope);
    f.sources.set(attestation.trust.path, JSON.stringify(proof.trust)); f.sources.set(attestation.proof.path, JSON.stringify(envelope));
    if (f.directory) f.commit();
  };
  publish();
  return { ...selected, proof, publish, attestation, configuration: { ...selected.configuration, selection: { ...selected.reference, attestation } } };
}
