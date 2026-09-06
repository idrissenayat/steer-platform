// Closed synthetic parent composition. No signer/mutator or provider is exported.
import { Buffer } from 'node:buffer';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { jcs, sha256, RETENTION_POLICY_SHA } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { makeLifecycleEventBytes } from '../0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { archivedDerivedExecutionCase } from '../0118/execution-fixtures.mjs';
import { policyDigest as historicalPolicy } from '../0078/historical-events.candidate.mjs';
import { policyDigest as ownerPolicy } from '../0084/archived-owner.candidate.mjs';
import { archivalPolicyDigest as qualifiedPolicy } from '../0083/qualified-history.candidate.mjs';
import { createProvenanceHistoryVerifier, policyDigest } from './provenance-history.candidate.mjs';
const variants = ['positive', 'retired-last', 'empty', 'empty-with-deletions', 'missing-retirement', 'double-retirement', 'wrong-retirement-source', 'wrong-retirement-actor',
  'wrong-child-event', 'orphan-child-event', 'unproved-hold', 'missing-child-proof', 'missing-history', 'missing-owner-archive', 'missing-child-archive', 'missing-manifest',
  'manifest-incomplete', 'manifest-missing-child', 'manifest-duplicate-child', 'manifest-reordered', 'manifest-wrong-class', 'manifest-wrong-event', 'manifest-wrong-corpus',
  'manifest-wrong-id', 'manifest-extra-child', 'manifest-source', 'manifest-policy', 'manifest-before-retention', 'head-incomplete', 'head-wrong-history', 'head-wrong-manifest',
  'head-wrong-child', 'head-wrong-hold', 'head-source', 'head-policy', 'head-before-manifest', 'head-future', 'extra-field'];
function seal(input, domain, fresh = false) {
  const key = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'),
    createHash('sha256').update(fresh ? `steer-0118-future-2033-${domain}` : `steer-r3-r1-${domain}`).digest()]), format: 'der', type: 'pkcs8' });
  const payload = Object.fromEntries(Object.entries(input).filter(([k]) => !['recordDigest', 'signature'].includes(k))), digest = sha256(jcs(payload));
  return { ...payload, recordDigest: digest, signature: { algorithm: 'Ed25519', keyId: `${domain}-key-${fresh ? 'current' : 'v1'}`, signedDigest: digest,
    valueBase64: sign(null, Buffer.from(digest), key).toString('base64') } };
}
function event(input) {
  const payload = Object.fromEntries(Object.entries(input).filter(([k]) => !['providerProofBytes', 'providerProofDigest', 'recordDigest', 'signature'].includes(k)));
  const provider = seal({ providerRecordId: input.providerRecordId, eventId: input.eventId, eventBindingDigest: sha256(jcs(payload)), recordedAt: input.occurredAt }, 'provider');
  return jcs(seal({ ...payload, providerProofBytes: jcs(provider), providerProofDigest: provider.recordDigest }, 'record'));
}
export function provenanceHistoryExecutionCase(variant = 'positive') {
  if (!variants.includes(variant)) throw new Error('UNKNOWN_PROVENANCE_HISTORY_CASE');
  const child = archivedDerivedExecutionCase(variant === 'missing-child-proof' ? 'missing-child-proof' : 'positive'), original = child.original.config;
  const empty = variant === 'empty', emptyMode = empty || variant === 'empty-with-deletions', evaluationTime = child.evaluationTime;
  const parent = { ...original.scope, recordId: original.parent.recordId, recordClass: 'RC-CORPUS-PROVENANCE', artifactRevision: original.parent.artifactRevision, policySha256: RETENTION_POLICY_SHA };
  const makeEvent = (type, id, occurredAt, extra = {}) => event({ ...JSON.parse(makeLifecycleEventBytes(type, id)), ...parent, occurredAt, ...extra });
  const retirement = at => makeEvent('corpus-retired', 3, at, { corpusId: original.parent.corpusId, corpusVersion: original.parent.corpusVersion,
    timestampAuthority: variant === 'wrong-retirement-source' ? 'system-of-record-commit' : 'qualified-owner-decision-commit',
    actorAuthority: variant === 'wrong-retirement-actor' ? 'lifecycle-worker' : 'privacy-legal-records-owner' });
  let allBytes = empty ? [] : child.original.envelope.children.map(e => e.eventBytes);
  if (variant === 'wrong-child-event') allBytes[0] = event({ ...JSON.parse(allBytes[0]), parentCorpusVersion: 'other-version' });
  if (variant !== 'missing-retirement') {
    if (variant === 'retired-last') allBytes.push(retirement('2026-09-04T12:00:01Z'));
    else allBytes.unshift(retirement(empty ? '2026-09-04T12:00:00Z' : '2026-09-04T11:59:58Z'));
  }
  if (variant === 'double-retirement') allBytes.push(makeEvent('corpus-retired', 5, '2026-09-04T12:00:02Z', { corpusId: original.parent.corpusId,
    corpusVersion: original.parent.corpusVersion, timestampAuthority: 'qualified-owner-decision-commit', actorAuthority: 'privacy-legal-records-owner' }));
  if (variant === 'orphan-child-event') allBytes.push(makeEvent('derived-record-deleted', 6, '2026-09-04T12:00:02Z', { ...JSON.parse(child.original.envelope.children[0].eventBytes),
    eventId: '00000000-0000-4000-8000-000000000006', providerRecordId: 'provider-event-6', occurredAt: '2026-09-04T12:00:02Z', derivedRecordId: 'orphan-child' }));
  if (variant === 'unproved-hold') allBytes.push(makeEvent('hold-applied', 7, '2026-09-04T12:00:02Z'));
  allBytes.push(makeEvent('item-closed', 4, '2026-09-04T12:00:03Z'));
  const historical = { version: 'steer-historical-event-context/v1', scope: original.scope, recordId: parent.recordId, recordClass: parent.recordClass, artifactRevision: parent.artifactRevision,
    archiveReference: { repositoryId: 'steer-platform', revision: 'd'.repeat(40), path: 'evidence/parent-history.json' }, historyDigest: sha256(jcs(allBytes)),
    observedAt: '2026-09-04T12:00:50Z', currentRegistryBytes: child.config.currentRegistryBytes };
  const historicalContextBytes = jcs(historical), ownerContext = { version: 'steer-archived-owner-context/v1', historicalContextDigest: sha256(historicalContextBytes), decisionBytesDigest: sha256('[]'),
    archiveReference: { ...historical.archiveReference, path: 'evidence/parent-owner-decisions.json' } }, archivedOwnerContextBytes = jcs(ownerContext);
  const config = { version: 'steer-provenance-history-context/v1', historicalContextBytes, archivedOwnerContextBytes, derivedArchiveContextBytes: emptyMode ? null : child.configBytes,
    manifestSelector: { manifestId: 'fixture-provenance-manifest', corpusId: original.parent.corpusId, corpusVersion: original.parent.corpusVersion } };
  const configBytes = jcs(config), configDigest = sha256(configBytes), registryDigest = sha256(child.config.currentRegistryBytes);
  const inventory = allBytes.map(bytes => { const e = JSON.parse(bytes), p = JSON.parse(e.providerProofBytes); return { eventId: e.eventId, bytesDigest: sha256(bytes), recordDigest: e.recordDigest,
    providerBytesDigest: sha256(e.providerProofBytes), providerDigest: p.recordDigest, occurredAt: e.occurredAt }; });
  const common = { configDigest: sha256(historicalContextBytes), policyDigest: historicalPolicy, registryDigest, historyDigest: historical.historyDigest, inventoryDigest: sha256(jcs(inventory)),
    archiveReference: historical.archiveReference, observedAt: historical.observedAt, recordCount: allBytes.length, recordedAt: '2033-09-04T12:00:30Z', validThrough: '2033-09-04T12:02:00Z' };
  const attested = seal({ ...common, kind: 'historical-event-attestation', source: 'authoritative-history-revalidator', decision: 'historical-facts-verified' }, 'authority', true);
  const retained = seal({ ...common, kind: 'historical-event-retention', source: 'authoritative-archive-store', recordedAt: '2033-09-04T12:00:31Z',
    attestationDigest: attested.recordDigest, retainedBytesDigest: historical.historyDigest, complete: true }, 'provider', true);
  const archivedEvidenceBytes = jcs({ version: 'steer-historical-events/v1', policyDigest: historicalPolicy, eventBytes: allBytes.at(-1), historyBytes: allBytes.slice(0, -1), attestationBytes: jcs(attested), retentionReceiptBytes: jcs(retained) });
  const ownerCommon = { configDigest: sha256(archivedOwnerContextBytes), policyDigest: ownerPolicy, registryDigest, historyDigest: historical.historyDigest, decisionBytesDigest: sha256('[]'), inventoryDigest: sha256('[]'),
    archiveReference: ownerContext.archiveReference, observedAt: historical.observedAt, decisionCount: 0, recordedAt: '2033-09-04T12:00:30Z', validThrough: '2033-09-04T12:02:00Z' };
  const ownerAttested = seal({ ...ownerCommon, kind: 'archived-owner-attestation', source: 'authoritative-owner-history-revalidator', decision: 'historical-owner-records-verified' }, 'authority', true);
  const ownerRetained = seal({ ...ownerCommon, kind: 'archived-owner-retention', source: 'authoritative-archive-store', recordedAt: '2033-09-04T12:00:31Z',
    attestationDigest: ownerAttested.recordDigest, retainedBytesDigest: sha256('[]'), complete: true }, 'provider', true);
  const archivedOwnerBytes = jcs({ version: 'steer-archived-owner/v1', policyDigest: ownerPolicy, archivedEvidenceBytes, decisionBytes: '[]', attestationBytes: jcs(ownerAttested), retentionReceiptBytes: jcs(ownerRetained) });
  const qualified = { version: 'steer-qualified-history/v2', policyDigest: qualifiedPolicy, archivedEvidenceBytes, eventBytes: allBytes.at(-1), historyBytes: allBytes.slice(0, -1), qualifiedDecisionBytes: '[]', archivedOwnerBytes };
  if (variant === 'missing-owner-archive') qualified.archivedOwnerBytes = '';
  const entries = emptyMode ? [] : original.children.map(c => ({ derivedRecordId: c.recordId, derivedRecordClass: c.recordClass, deletionEventId: c.eventId }));
  const manifest = { kind: 'derived-inventory', source: 'authoritative-derived-record-manifest', configDigest, policyDigest, ...config.manifestSelector, entries, complete: true,
    recordedAt: '2033-09-04T12:00:32Z', validThrough: '2033-09-04T12:02:00Z' };
  if (variant === 'manifest-missing-child') entries.pop();
  if (variant === 'manifest-duplicate-child') entries[1] = entries[0];
  if (variant === 'manifest-reordered') entries.reverse();
  if (variant === 'manifest-wrong-class') entries[0].derivedRecordClass = 'RC-FAILED-RUN';
  if (variant === 'manifest-wrong-event') entries[0].deletionEventId = '00000000-0000-4000-8000-000000000004';
  if (variant === 'manifest-extra-child') entries.push({ ...entries[0], derivedRecordId: 'other-child' });
  for (const [name, field, value] of [['manifest-incomplete', 'complete', false], ['manifest-wrong-corpus', 'corpusVersion', 'other-version'], ['manifest-wrong-id', 'manifestId', 'other-manifest'],
    ['manifest-source', 'source', 'caller'], ['manifest-policy', 'policyDigest', 'f'.repeat(64)], ['manifest-before-retention', 'recordedAt', '2033-09-04T12:00:30Z']]) if (variant === name) manifest[field] = value;
  const signedManifest = seal(manifest, 'provider', true), derivedEvidenceBytes = emptyMode ? '' : child.bytes;
  const head = { kind: 'provenance-history-head', source: 'authoritative-lifecycle-store', configDigest, policyDigest, historyDigest: historical.historyDigest, historyComplete: true,
    derivedInventoryDigest: signedManifest.recordDigest, archivedChildEvidenceDigest: sha256(derivedEvidenceBytes), holdState: 'none', recordedAt: '2033-09-04T12:00:33Z', validThrough: '2033-09-04T12:02:00Z' };
  for (const [name, field, value] of [['head-incomplete', 'historyComplete', false], ['head-wrong-history', 'historyDigest', 'f'.repeat(64)], ['head-wrong-manifest', 'derivedInventoryDigest', 'f'.repeat(64)],
    ['head-wrong-child', 'archivedChildEvidenceDigest', 'f'.repeat(64)], ['head-wrong-hold', 'holdState', 'active'], ['head-source', 'source', 'caller'], ['head-policy', 'policyDigest', 'f'.repeat(64)],
    ['head-before-manifest', 'recordedAt', '2033-09-04T12:00:31Z'], ['head-future', 'recordedAt', '2033-09-04T12:00:50.000000001Z']]) if (variant === name) head[field] = value;
  const envelope = { version: 'steer-provenance-history/v1', policyDigest, configDigest, qualifiedHistoryBytes: jcs(qualified), derivedEvidenceBytes, manifestBytes: jcs(signedManifest), headBytes: jcs(seal(head, 'authority', true)) };
  if (variant === 'missing-history') envelope.qualifiedHistoryBytes = '';
  if (variant === 'missing-child-archive') envelope.derivedEvidenceBytes = '';
  if (variant === 'missing-manifest') envelope.manifestBytes = '';
  if (variant === 'extra-field') envelope.executionAuthorized = true;
  return { config, configBytes, envelope, bytes: jcs(envelope), evaluationTime, child, qualified, allBytes, verifier: createProvenanceHistoryVerifier(configBytes) };
}
