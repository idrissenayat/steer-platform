// Original-era retained evidence verifier. No effects, fetching or future archive
// revalidation. A future parent composition must supply verified manifest bindings.
import { exactKeys, hex, jcs, parseCanonical, sha256, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createLifecycleGraphVerifier, policyDigest as lifecyclePolicy } from '../0061/lifecycle-graph.candidate.mjs';
import { correctedLifecycleEventDecision, correctionPolicyDigest as eventPolicy } from '../0059/lifecycle-events.candidate.mjs';
import { exactInstant, timePolicyDigest } from '../0069/exact-time.candidate.mjs';
import { Buffer } from 'node:buffer';
export const policyDigest = sha256(jcs({ version: 'steer-derived-disposition/v1', lifecyclePolicy, eventPolicy, timePolicyDigest,
  classes: ['RC-CORPUS-DERIVED-TEXT', 'RC-CORPUS-EXPORT'], maxChildren: 128, maxBytes: 16777216,
  rules: 'trusted exact parent and child/event/config/graph/aggregate-byte pins; actual original-era full child graphs and provider-bound derived deletion events; aggregate is the named deletion receipt; tombstone precedes event; global physical-copy, credential, idempotency, transaction and human-record isolation; no recursive parent or digest-only success; evidence only, not future trust or execution' }));
const ensure = value => { if (!value) throw new Error('DERIVED_DISPOSITION_INVALID'); };
const text = v => typeof v === 'string' && v.length > 0 && v.length <= 512 && v.trim() === v && !/[\u0000-\u001f*?]/u.test(v);
const time = v => { const t = exactInstant(v); ensure(t !== null); return t; };
const classes = ['RC-CORPUS-DERIVED-TEXT', 'RC-CORPUS-EXPORT'];
export function createDerivedDispositionVerifier(configBytes) {
  let config;
  try {
    ensure(typeof configBytes === 'string' && configBytes.length <= 131072 && Buffer.byteLength(configBytes, 'utf8') <= 131072); config = parseCanonical(configBytes);
    ensure(exactKeys(config, ['version', 'scope', 'parent', 'observedAt', 'children']) && config.version === 'steer-derived-disposition-context/v1' &&
      exactKeys(config.scope, ['organization', 'itemId', 'environmentId']) && config.scope.organization === 'steer-platform' && config.scope.itemId === '0001-flight-deck-foundation' && (config.scope.environmentId === null || text(config.scope.environmentId)) &&
      exactKeys(config.parent, ['recordId', 'artifactRevision', 'corpusId', 'corpusVersion']) && Object.values(config.parent).every(text) && hex(config.parent.artifactRevision, 40) &&
      Array.isArray(config.children) && config.children.length > 0 && config.children.length <= 128);
    time(config.observedAt); const ids = new Set(), events = new Set();
    for (const child of config.children) {
      ensure(exactKeys(child, ['recordId', 'recordClass', 'artifactRevision', 'eventId', 'eventDigest', 'receiptBytesDigest', 'configBytesDigest', 'graphBytesDigest']) &&
        text(child.recordId) && child.recordId !== config.parent.recordId && classes.includes(child.recordClass) && hex(child.artifactRevision, 40) &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(child.eventId) &&
        ['eventDigest', 'receiptBytesDigest', 'configBytesDigest', 'graphBytesDigest'].every(k => hex(child[k], 64)) && !ids.has(child.recordId) && !events.has(child.eventId));
      ids.add(child.recordId); events.add(child.eventId);
    }
    ensure(jcs(config.children.map(c => c.recordId)) === jcs([...ids].sort()));
  } catch { throw new Error('DERIVED_DISPOSITION_CONFIGURATION_INVALID'); }
  const configDigest = sha256(configBytes);
  return Object.freeze({ configDigest, policyDigest,
    verify(serialized, evaluationTime) {
      const limits = { effects: zeroEffects(), executionAuthorized: false, deletionVerified: false, liveProviderUsed: false, futureArchiveVerified: false };
      try {
        ensure(evaluationTime === config.observedAt); const now = time(evaluationTime);
        ensure(typeof serialized === 'string' && serialized.length <= 16777216 && Buffer.byteLength(serialized, 'utf8') <= 16777216); const input = parseCanonical(serialized);
        ensure(exactKeys(input, ['version', 'policyDigest', 'configDigest', 'children']) && input.version === 'steer-derived-disposition/v1' && input.policyDigest === policyDigest && input.configDigest === configDigest &&
          Array.isArray(input.children) && input.children.length === config.children.length);
        const verified = [], physical = new Set(), providerRecords = new Set(), credentials = new Set(), idempotency = new Set(), transactions = new Set(), humanRecords = new Set();
        const unique = (set, value) => { ensure(text(value) && !set.has(value)); set.add(value); };
        for (let index = 0; index < config.children.length; index++) {
          const expected = config.children[index], entry = input.children[index];
          ensure(exactKeys(entry, ['recordId', 'eventBytes', 'configBytes', 'graphBytes', 'receiptBytes']) && entry.recordId === expected.recordId &&
            ['eventBytes', 'configBytes', 'graphBytes', 'receiptBytes'].every(k => typeof entry[k] === 'string' && entry[k].length > 0));
          ensure(sha256(entry.configBytes) === expected.configBytesDigest && sha256(entry.graphBytes) === expected.graphBytesDigest && sha256(entry.receiptBytes) === expected.receiptBytesDigest);
          const event = parseCanonical(entry.eventBytes), childConfig = parseCanonical(entry.configBytes), graph = parseCanonical(entry.graphBytes);
          ensure(correctedLifecycleEventDecision(jcs({ version: 'steer-r5-001-events/v1', policyDigest: eventPolicy, scope: config.scope, eventBytes: entry.eventBytes, historyBytes: [], evaluationTime })).state === 'validated-trigger');
          ensure(event.recordDigest === expected.eventDigest && event.eventId === expected.eventId && event.eventType === 'derived-record-deleted' &&
            event.timestampAuthority === 'lifecycle-transaction' && event.actorAuthority === 'lifecycle-worker' &&
            event.recordId === config.parent.recordId && event.recordClass === 'RC-CORPUS-PROVENANCE' && event.artifactRevision === config.parent.artifactRevision &&
            event.parentCorpusId === config.parent.corpusId && event.parentCorpusVersion === config.parent.corpusVersion &&
            event.derivedRecordId === expected.recordId && event.derivedRecordClass === expected.recordClass && event.deletionReceiptSha256 === expected.receiptBytesDigest &&
            !providerRecords.has(event.providerRecordId)); providerRecords.add(event.providerRecordId);
          ensure(['recordId', 'recordClass', 'artifactRevision'].every(k => childConfig[k] === expected[k]) && childConfig.environmentId === config.scope.environmentId &&
            graph.version === 'steer-lifecycle-graph/v1' && entry.receiptBytes === graph.aggregateBytes);
          const result = createLifecycleGraphVerifier(entry.configBytes).verify(entry.graphBytes, evaluationTime);
          ensure(result.state === 'validated-lifecycle-candidate' && result.protectedActionCount === result.copyCount + 1 && jcs(result.effects) === jcs(zeroEffects()));
          const receipt = parseCanonical(entry.receiptBytes), tombstone = parseCanonical(graph.tombstone.receiptBytes);
          ensure(time(receipt.recordedAt) < time(tombstone.recordedAt) && time(tombstone.recordedAt) <= time(event.occurredAt) && time(event.occurredAt) <= now);
          for (const copy of parseCanonical(graph.inventoryBytes).copies) {
            const tuple = jcs([copy.providerBindingId, copy.account, copy.objectKey, copy.versionId]); ensure(!physical.has(tuple)); physical.add(tuple);
          }
          for (const action of [...graph.copies, graph.tombstone]) {
            const bundle = parseCanonical(action.actionBundleBytes), authority = parseCanonical(parseCanonical(action.humanBundleBytes).authorityBytes);
            for (const field of ['upstreamBytes', 'downstreamBytes']) unique(credentials, parseCanonical(bundle[field]).credentialId);
            unique(idempotency, parseCanonical(bundle.requestBytes).operation.idempotencyKey);
            unique(transactions, parseCanonical(action.receiptBytes).transactionId); unique(humanRecords, authority.providerRecordId);
          }
          verified.push({ recordId: expected.recordId, eventDigest: event.recordDigest, receiptBytesDigest: expected.receiptBytesDigest,
            graphBytesDigest: expected.graphBytesDigest, childEvidenceDigest: result.evidenceDigest, copyCount: result.copyCount, occurredAt: event.occurredAt });
        }
        return { state: 'verified-derived-disposition-evidence', firstError: null, ...limits, factOnly: true, fullChildEvidenceVerified: true,
          configDigest, policyDigest, observedAt: evaluationTime, verifiedChildCount: verified.length, verifiedCopyCount: physical.size,
          evidenceDigest: sha256(jcs(verified)), inputDigest: sha256(jcs({ bytes: serialized, evaluatedAt: evaluationTime })),
          requires: ['verified-parent-manifest-and-history', 'fresh-future-archive-revalidation', 'complete-parent-disposition-authority'] };
      } catch { return { state: 'blocked', firstError: 'DERIVED_DISPOSITION_INVALID', ...limits, fullChildEvidenceVerified: false }; }
    } });
}
