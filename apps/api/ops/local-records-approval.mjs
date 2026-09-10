import { createHash } from 'node:crypto';

// This verifies the recorded local decision, not activation or a provider signature.
// Runtime policy, exact schema adoption, key/copy controls and current tool grants
// remain independent. Never turn this result into an authorize() no-op callback.
export const localD1Decision = Object.freeze({
  decisionId: 'D1-LOCAL-2026-09-10',
  organizationId: 'steer-local-idrissenayat',
  commit: '9442b2d212b2c47c436cbe527dd07707b3c8174c',
  path: 'docs/architecture/DRAFT-RECORDS-AMENDMENT.md',
  sha256: '9191831b9870da5cb632d51e8f815aa538e7a191d4ac119f2d8318a264b53ac8',
});

export function inspectLocalRecordsApproval(record, policy, amendmentBytes) {
  const fail = () => { throw new Error('Local records decision could not be verified.'); };
  const bound = record?.boundState, confirmation = record?.confirmation, signer = record?.signer;
  if (record?.version !== 'steer-records-decision/v1' || record.decisionId !== localD1Decision.decisionId
    || record.organizationId !== localD1Decision.organizationId || record.decision !== 'accepted-amendment'
    || signer?.githubLogin !== 'idrissenayat' || signer.authorizationConfirmed !== true
    || JSON.stringify(signer.authorities) !== JSON.stringify(['records-owner', 'architecture-owner'])
    || bound?.commit !== localD1Decision.commit || bound.artifactPath !== localD1Decision.path
    || bound.artifactSha256 !== localD1Decision.sha256 || bound.revision !== 1
    || !(amendmentBytes instanceof Uint8Array)
    || createHash('sha256').update(amendmentBytes).digest('hex') !== localD1Decision.sha256
    || confirmation?.response !== 'yes' || confirmation.provider !== 'OpenAI Codex'
    || confirmation.threadId !== '01a049c9-80d5-7710-9607-2a5ae0c23e43'
    || confirmation.proofKind !== 'recorded-user-confirmation-not-cryptographic-attestation'
    || typeof confirmation.prompt !== 'string'
    || createHash('sha256').update(confirmation.prompt).digest('hex') !== 'a74ab9c6ece1f1e3f186ce288b3be0bb888006b1198b9ff3a0da228647ed82de') fail();
  const expectedEffects = {
    recordsAmendmentAccepted: true, architectureAmendmentAccepted: true,
    activationPrerequisitesWaived: false, runtimeActivated: false,
    schemaMigrationAuthorizedByThisRecord: false, applicationGithubWritesAuthorized: false,
    deletionAuthorized: false, deploymentAuthorized: false, releaseAuthorized: false,
    gateSigned: false, additionalSpendingAuthorized: false,
  };
  if (!record.effects || Object.keys(record.effects).length !== Object.keys(expectedEffects).length
    || Object.entries(expectedEffects).some(([key, value]) => record.effects[key] !== value)
    || policy?.version !== 'steer-intent-records-policy/v1'
    || policy.amendment?.commit !== localD1Decision.commit || policy.amendment?.path !== localD1Decision.path
    || policy.amendment?.sha256 !== localD1Decision.sha256
    || policy.defaultActivation !== 'disabled-until-organization-adoption-and-verified-binding'
    || createHash('sha256').update(JSON.stringify(policy)).digest('hex') !== '14b7deaa66c841cc39c94fa32a6f83ffcd1e85a491c38aa4bb82db9c22a2603a') fail();
  return Object.freeze({ decisionId: localD1Decision.decisionId, organizationId: localD1Decision.organizationId,
    policyDecision: 'accepted', runtimeAuthorityGranted: false,
    amendmentSha256: localD1Decision.sha256, proofKind: confirmation.proofKind });
}
