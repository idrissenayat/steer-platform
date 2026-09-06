// Fact-only parent history/manifest composition. No lifecycle action admission.
import { Buffer } from 'node:buffer';
import { exactKeys, jcs, parseCanonical, sha256, zeroEffects, RETENTION_POLICY_SHA } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createQualifiedHistoryVerifier, archivalPolicyDigest as historyPolicy } from '../0083/qualified-history.candidate.mjs';
import { createArchivedDerivedVerifier, policyDigest as derivedPolicy } from '../0118/archived-derived.candidate.mjs';
import { createTimedRecordVerifier } from '../0058/record-verifier.candidate.mjs';
import { exactInstant, exactRetentionBoundary, timePolicyDigest } from '../0069/exact-time.candidate.mjs';
export const policyDigest = sha256(jcs({ version: 'steer-provenance-history/v1', historyPolicy, derivedPolicy, timePolicyDigest, retentionPolicySha256: RETENTION_POLICY_SHA,
  rules: 'qualified hold history and pinned fresh authoritative manifest/head with signed policy digest; exact retained derived-event bytes and child pins; explicit complete empty mode; retirement metadata only, qualified retirement authority still required; later retirement/final verified deletion plus P7Y candidate boundary; no copy inventory, readiness or current parent authority' }));
const ensure = v => { if (!v) throw new Error('PROVENANCE_HISTORY_INVALID'); };
const time = v => { const t = exactInstant(v); ensure(t !== null); return t; };
const bytes = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max && Buffer.byteLength(v, 'utf8') <= max;
const text = v => bytes(v, 512) && v.trim() === v && !/[\u0000-\u001f*?]/u.test(v);
export function createProvenanceHistoryVerifier(configBytes) {
  let config, context, history, current, derived, derivedContext, childrenContext;
  try {
    ensure(bytes(configBytes, 2097152)); config = parseCanonical(configBytes);
    ensure(exactKeys(config, ['version', 'historicalContextBytes', 'archivedOwnerContextBytes', 'derivedArchiveContextBytes', 'manifestSelector']) &&
      config.version === 'steer-provenance-history-context/v1' && bytes(config.historicalContextBytes, 131072) && bytes(config.archivedOwnerContextBytes, 16384) &&
      exactKeys(config.manifestSelector, ['manifestId', 'corpusId', 'corpusVersion']) && Object.values(config.manifestSelector).every(text));
    context = parseCanonical(config.historicalContextBytes); ensure(context.recordClass === 'RC-CORPUS-PROVENANCE');
    history = createQualifiedHistoryVerifier(config.historicalContextBytes, config.archivedOwnerContextBytes);
    ensure(history.policyDigest === historyPolicy); current = createTimedRecordVerifier(context.currentRegistryBytes);
    const registry = parseCanonical(context.currentRegistryBytes); ensure(new Set(registry.bindings.map(k => k.publicKeyHex)).size === registry.bindings.length);
    if (config.derivedArchiveContextBytes !== null) {
      ensure(bytes(config.derivedArchiveContextBytes, 524288)); derived = createArchivedDerivedVerifier(config.derivedArchiveContextBytes);
      derivedContext = parseCanonical(config.derivedArchiveContextBytes); childrenContext = parseCanonical(derivedContext.originalContextBytes);
      ensure(derivedContext.currentRegistryBytes === context.currentRegistryBytes && jcs(childrenContext.scope) === jcs(context.scope) &&
        childrenContext.parent.recordId === context.recordId && childrenContext.parent.artifactRevision === context.artifactRevision &&
        childrenContext.parent.corpusId === config.manifestSelector.corpusId && childrenContext.parent.corpusVersion === config.manifestSelector.corpusVersion &&
        time(childrenContext.observedAt) <= time(context.observedAt));
    }
  } catch { throw new Error('PROVENANCE_HISTORY_CONFIGURATION_INVALID'); }
  const configDigest = sha256(configBytes);
  return Object.freeze({ configDigest, policyDigest,
    verify(serialized, evaluationTime) {
      const limits = { effects: zeroEffects(), executionAuthorized: false, deletionVerified: false, liveProviderUsed: false, dispositionEvidenceVerified: false, retirementAuthorityVerified: false };
      try {
        const now = time(evaluationTime); ensure(bytes(serialized, 67108864)); const input = parseCanonical(serialized);
        ensure(exactKeys(input, ['version', 'policyDigest', 'configDigest', 'qualifiedHistoryBytes', 'derivedEvidenceBytes', 'manifestBytes', 'headBytes']) &&
          input.version === 'steer-provenance-history/v1' && input.policyDigest === policyDigest && input.configDigest === configDigest &&
          bytes(input.qualifiedHistoryBytes, 16777216) && typeof input.derivedEvidenceBytes === 'string');
        const facts = history.verify(input.qualifiedHistoryBytes, evaluationTime);
        ensure(facts.state === 'verified-qualified-history' && facts.executionAuthorized === false && jcs(facts.effects) === jcs(zeroEffects()));
        const qualified = parseCanonical(input.qualifiedHistoryBytes), allBytes = [...qualified.historyBytes, qualified.eventBytes], events = allBytes.map(parseCanonical);
        const retirements = events.filter(e => e.eventType === 'corpus-retired'), deletions = events.filter(e => e.eventType === 'derived-record-deleted');
        ensure(retirements.length === 1); const retired = retirements[0];
        ensure(retired.corpusId === config.manifestSelector.corpusId && retired.corpusVersion === config.manifestSelector.corpusVersion &&
          retired.timestampAuthority === 'qualified-owner-decision-commit' && retired.actorAuthority === 'privacy-legal-records-owner');
        let childFacts = null, childBytes = null;
        if (derived) {
          ensure(bytes(input.derivedEvidenceBytes, 33554432)); childFacts = derived.verify(input.derivedEvidenceBytes, evaluationTime);
          ensure(childFacts.state === 'verified-archived-derived-evidence' && childFacts.futureArchiveVerified === true && childFacts.executionAuthorized === false && jcs(childFacts.effects) === jcs(zeroEffects()));
          childBytes = parseCanonical(parseCanonical(input.derivedEvidenceBytes).originalBytes).children;
          ensure(deletions.length === childrenContext.children.length && childFacts.verifiedChildCount === deletions.length);
        } else ensure(input.derivedEvidenceBytes === '' && deletions.length === 0);
        const proof = (serializedRecord, domain, fields) => {
          ensure(bytes(serializedRecord, 65536)); const raw = parseCanonical(serializedRecord);
          const record = current.verifyBytes(serializedRecord, { domain, recordedAt: raw.recordedAt, evaluatedAt: evaluationTime }).record;
          ensure(exactKeys(record, ['kind', 'source', 'configDigest', 'policyDigest', ...fields, 'recordedAt', 'validThrough', 'recordDigest', 'signature']) && record.configDigest === configDigest && record.policyDigest === policyDigest &&
            now < time(record.validThrough) && now - time(record.recordedAt) <= 300000000000n && time(record.validThrough) > time(record.recordedAt) &&
            time(record.validThrough) - time(record.recordedAt) <= 300000000000n); return record;
        };
        const manifest = proof(input.manifestBytes, 'provider', ['manifestId', 'corpusId', 'corpusVersion', 'entries', 'complete']);
        ensure(manifest.kind === 'derived-inventory' && manifest.source === 'authoritative-derived-record-manifest' && manifest.complete === true &&
          Object.keys(config.manifestSelector).every(k => manifest[k] === config.manifestSelector[k]) && Array.isArray(manifest.entries) &&
          manifest.entries.length <= 128 && manifest.entries.length === deletions.length && time(manifest.recordedAt) >= time(events.at(-1).occurredAt));
        const ids = new Set(), eventIds = new Set();
        for (let index = 0; index < manifest.entries.length; index++) {
          const entry = manifest.entries[index], expected = childrenContext.children[index];
          ensure(exactKeys(entry, ['derivedRecordId', 'derivedRecordClass', 'deletionEventId']) && Object.values(entry).every(text) &&
            !ids.has(entry.derivedRecordId) && !eventIds.has(entry.deletionEventId) && entry.derivedRecordId !== context.recordId);
          ids.add(entry.derivedRecordId); eventIds.add(entry.deletionEventId);
          const matches = events.map((event, i) => ({ event, bytes: allBytes[i] })).filter(row => row.event.eventType === 'derived-record-deleted' && row.event.eventId === entry.deletionEventId);
          ensure(matches.length === 1); const event = matches[0].event;
          ensure(entry.derivedRecordId === expected.recordId && entry.derivedRecordClass === expected.recordClass && entry.deletionEventId === expected.eventId &&
            event.recordDigest === expected.eventDigest && event.derivedRecordId === entry.derivedRecordId && event.derivedRecordClass === entry.derivedRecordClass &&
            event.parentCorpusId === manifest.corpusId && event.parentCorpusVersion === manifest.corpusVersion && event.deletionReceiptSha256 === expected.receiptBytesDigest &&
            matches[0].bytes === childBytes[index].eventBytes);
        }
        ensure(jcs(manifest.entries.map(e => e.derivedRecordId)) === jcs([...ids].sort()));
        const archived = parseCanonical(qualified.archivedEvidenceBytes), retained = parseCanonical(archived.retentionReceiptBytes);
        ensure(time(retained.recordedAt) <= time(manifest.recordedAt) && time(facts.archivedOwnerRetainedAt) <= time(manifest.recordedAt) &&
          (!childFacts || time(childFacts.retainedAt) <= time(manifest.recordedAt)));
        const held = new Set(); let everHeld = false;
        for (const event of events) {
          if (event.eventType === 'hold-applied') { held.add(event.holdId); everHeld = true; }
          if (event.eventType === 'hold-released') held.delete(event.holdId);
        }
        const holdState = held.size ? 'active' : everHeld ? 'released' : 'none';
        const head = proof(input.headBytes, 'authority', ['historyDigest', 'historyComplete', 'derivedInventoryDigest', 'archivedChildEvidenceDigest', 'holdState']);
        ensure(head.kind === 'provenance-history-head' && head.source === 'authoritative-lifecycle-store' && head.historyDigest === facts.historyDigest && head.historyComplete === true &&
          head.derivedInventoryDigest === manifest.recordDigest && head.archivedChildEvidenceDigest === sha256(input.derivedEvidenceBytes) && head.holdState === holdState &&
          time(head.recordedAt) >= time(manifest.recordedAt) && time(head.recordedAt) >= time(events.at(-1).occurredAt));
        const triggers = events.filter(e => ['corpus-retired', 'derived-record-deleted'].includes(e.eventType)), selected = triggers.at(-1);
        return { state: 'verified-provenance-history-evidence', firstError: null, ...limits, factOnly: true, parentManifestHistoryVerified: true,
          currentActionAuthorityRequired: true, configDigest, policyDigest, historyDigest: facts.historyDigest, manifestDigest: manifest.recordDigest,
          headDigest: head.recordDigest, archivedChildEvidenceDigest: sha256(input.derivedEvidenceBytes), derivedArchiveConfigDigest: derived?.configDigest ?? null,
          childCount: manifest.entries.length, holdState, selectedEventId: selected.eventId, selectedEventDigest: selected.recordDigest,
          selectedEventType: selected.eventType, selectedAt: selected.occurredAt, boundaryCandidateAt: exactRetentionBoundary(selected.occurredAt, 'P7Y'),
          manifestAt: manifest.recordedAt, headAt: head.recordedAt, evaluatedAt: evaluationTime, inputDigest: sha256(jcs({ bytes: serialized, evaluatedAt: evaluationTime })),
          requires: ['qualified-retirement-decision-proof', 'current-parent-copy-inventory', 'complete-current-parent-disposition-authority', 'separate-readiness-or-full-lifecycle-composition'] };
      } catch { return { state: 'blocked', firstError: 'PROVENANCE_HISTORY_INVALID', ...limits, parentManifestHistoryVerified: false }; }
    } });
}
