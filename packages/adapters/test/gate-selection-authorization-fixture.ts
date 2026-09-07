import { createHash } from 'node:crypto';
import type { chain } from './gate-policy-chain-fixture.ts';
import { attestSelection } from './gate-selection-attestation-fixture.ts';

/** Independently retained historical/current test grants. Never a live grant. */
export function authorizeSelection(f: ReturnType<typeof chain>, type: 'human' | 'agent' = 'human') {
  const selected = attestSelection(f), now = Date.now(), path = 'access/policy-selectors.json', issuer = 'https://selector.synthetic.invalid';
  const grant = { subject: selected.proof.payload.selectorSubject, organizationId: f.reader.binding.organizationId, type,
    hats: [] as string[], toolGrants: ['gate.policy.select'], expiresAt: new Date(now + 90000).toISOString(), issuer,
    active: true, validAfter: new Date(now - 60000).toISOString() };
  const document = { version: 'steer-authorization/v1', organizationId: grant.organizationId, records: [grant] };
  const historicalContent = JSON.stringify(document), hash = (text: string) => createHash('sha256').update(text).digest('hex');
  f.sources.set(path, historicalContent); if (f.directory) f.commit();
  const historicalRevision = f.directory ? f.state.head : 'c'.repeat(40);
  if (!f.directory) {
    const original = f.reader.readArtifact;
    f.reader.readArtifact = async (file, revision) => {
      if (file !== path || revision !== historicalRevision) return original(file, revision);
      f.reads.push(file); return { organizationId: grant.organizationId, repositoryId: f.reader.binding.repositoryId, path, revision,
        content: historicalContent, contentDigest: hash(historicalContent),
        blobSha: createHash('sha1').update(`blob ${Buffer.byteLength(historicalContent)}\0`).update(historicalContent).digest('hex') };
    };
  }
  const authorization = { path, issuer, type, historicalRevision, historicalDigest: hash(historicalContent) };
  const selectedAt = new Date(Date.now()).toISOString();
  Object.assign(selected.proof.trust, { selectorIssuer: issuer, selectorType: type });
  Object.assign(selected.proof.payload, { selectedAt, recordedAt: selectedAt, selectorIssuer: issuer, selectorType: type,
    selectorAuthorizationPath: path, selectorAuthorizationRevision: historicalRevision, selectorAuthorizationDigest: authorization.historicalDigest });
  selected.attestation.selectedAt = selectedAt; selected.publish();
  const publishGrant = () => { f.sources.set(path, JSON.stringify(document)); if (f.directory) f.commit(); };
  return { ...selected, document, grant, authorization, publishGrant, configuration: { ...selected.configuration,
    selection: { ...selected.configuration.selection, attestation: { ...selected.attestation, authorization } } } };
}
