// Closed original-era synthetic component fixtures; no signer/mutator is exported.
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { provenanceChildDispositionExecutionCase } from '../0107/execution-fixtures.mjs';
import { makeLifecycleEventBytes } from '../0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { jcs, sha256, RETENTION_POLICY_SHA } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createDerivedDispositionVerifier, policyDigest } from './derived-disposition.candidate.mjs';
function seal(input, domain) {
  const key = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), createHash('sha256').update(`steer-r3-r1-${domain}`).digest()]), format: 'der', type: 'pkcs8' });
  const payload = Object.fromEntries(Object.entries(input).filter(([k]) => !['recordDigest', 'signature'].includes(k))), digest = sha256(jcs(payload));
  return { ...payload, recordDigest: digest, signature: { algorithm: 'Ed25519', keyId: `${domain}-key-v1`, signedDigest: digest, valueBase64: sign(null, Buffer.from(digest), key).toString('base64') } };
}
export function derivedDispositionExecutionCase(variant = 'positive') {
  if (!['positive', 'replay', 'missing-receipt', 'digest-only', 'missing-child-proof', 'partial-child-proof', 'wrong-copy', 'wrong-parent', 'wrong-child-class',
    'early-event', 'wrong-event-source', 'swapped-children', 'borrowed-receipt', 'extra-field', 'shared-objects', 'shared-credentials'].includes(variant)) throw new Error('UNKNOWN_DERIVED_DISPOSITION_CASE');
  const config = { version: 'steer-derived-disposition-context/v1', scope: { organization: 'steer-platform', itemId: '0001-flight-deck-foundation', environmentId: null },
    parent: { recordId: 'provenance-1', artifactRevision: 'b'.repeat(40), corpusId: 'fixture-corpus', corpusVersion: 'fixture-v1' }, observedAt: '2026-09-04T12:00:02Z', children: [] };
  const children = [], full = [];
  for (const index of [1, 2]) {
    const selected = ['replay', 'shared-objects', 'shared-credentials'].includes(variant) ? variant : index === 1 && variant === 'partial-child-proof' ? 'partial-receipt' : index === 1 && variant === 'wrong-copy' ? 'wrong-copy' : 'positive';
    const child = provenanceChildDispositionExecutionCase(index, selected); full.push(child);
    const receiptBytes = index === 2 && variant === 'borrowed-receipt' ? children[0].receiptBytes : child.graph.aggregateBytes;
    const event = { ...JSON.parse(makeLifecycleEventBytes('derived-record-deleted', index)), ...config.scope,
      recordId: config.parent.recordId, recordClass: 'RC-CORPUS-PROVENANCE', artifactRevision: config.parent.artifactRevision,
      policySha256: RETENTION_POLICY_SHA, parentCorpusId: variant === 'wrong-parent' ? 'other-corpus' : config.parent.corpusId, parentCorpusVersion: config.parent.corpusVersion,
      derivedRecordId: child.config.recordId, derivedRecordClass: variant === 'wrong-child-class' ? 'RC-FAILED-RUN' : child.config.recordClass,
      deletionReceiptSha256: sha256(receiptBytes), timestampAuthority: variant === 'wrong-event-source' ? 'system-of-record-commit' : 'lifecycle-transaction',
      actorAuthority: 'lifecycle-worker', occurredAt: variant === 'early-event' ? '2026-09-04T11:59:56Z' : index === 1 ? '2026-09-04T11:59:59Z' : '2026-09-04T12:00:00Z' };
    const payload = Object.fromEntries(Object.entries(event).filter(([k]) => !['providerProofDigest', 'providerProofBytes', 'recordDigest', 'signature'].includes(k)));
    const provider = seal({ providerRecordId: event.providerRecordId, eventId: event.eventId, eventBindingDigest: sha256(jcs(payload)), recordedAt: event.occurredAt }, 'provider');
    const signed = seal({ ...event, providerProofBytes: jcs(provider), providerProofDigest: provider.recordDigest }, 'record');
    config.children.push({ recordId: child.config.recordId, recordClass: child.config.recordClass, artifactRevision: child.config.artifactRevision,
      eventId: signed.eventId, eventDigest: signed.recordDigest, receiptBytesDigest: sha256(receiptBytes), configBytesDigest: sha256(child.configBytes), graphBytesDigest: sha256(child.bytes) });
    children.push({ recordId: child.config.recordId, eventBytes: jcs(signed), configBytes: child.configBytes, graphBytes: child.bytes, receiptBytes });
  }
  const configBytes = jcs(config), verifier = createDerivedDispositionVerifier(configBytes);
  const envelope = { version: 'steer-derived-disposition/v1', policyDigest, configDigest: verifier.configDigest, children };
  if (variant === 'missing-receipt') children[0].receiptBytes = '';
  if (variant === 'digest-only') children[0].receiptBytes = config.children[0].receiptBytesDigest;
  if (variant === 'missing-child-proof') children[0].graphBytes = '';
  if (variant === 'swapped-children') children.reverse();
  if (variant === 'extra-field') envelope.executionAuthorized = true;
  const bytes = jcs(envelope);
  return { config, configBytes, envelope, bytes, full, verifier, evaluationTime: config.observedAt, input: jcs({ configBytes, bytes, evaluatedAt: config.observedAt }) };
}
