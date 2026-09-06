// Complete current-observation retirement decision evidence; not a live command.
import { Buffer } from 'node:buffer';
import { exactKeys, hex, jcs, parseCanonical, sha256, zeroEffects, RETENTION_POLICY_SHA } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createHumanAuthorityVerifier, correctionPolicyDigest as originalHumanPolicy } from '../0058/human-authority.candidate.mjs';
import { createLifecycleEventVerifier, correctionPolicyDigest as originalEventPolicy } from '../0059/lifecycle-events.candidate.mjs';
import { createTimedRecordVerifier } from '../0058/record-verifier.candidate.mjs';
import { exactInstant, timePolicyDigest } from '../0069/exact-time.candidate.mjs';
import { schemaPolicyDigest } from './retirement-decision-schema.candidate.mjs';
export const policyDigest = sha256(jcs({ version: 'steer-retirement-decision/v1', originalHumanPolicy, originalEventPolicy, schemaPolicyDigest, timePolicyDigest,
  rules: 'trusted exact parent/corpus/event/history and registry; complete nine-record qualified retirement proof; exact provider event actor/source; fresh signed policy-bound history head before decision; truthful hold metadata; predecessor and reserved-before-commit checks; no qualified prior-hold proof, archive or actual execution' }));
const ensure = v => { if (!v) throw new Error('RETIREMENT_DECISION_INVALID'); };
const time = v => { const t = exactInstant(v); ensure(t !== null); return t; };
const bytes = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max && Buffer.byteLength(v, 'utf8') <= max;
const text = v => bytes(v, 512) && v.trim() === v && !/[\u0000-\u001f*?]/u.test(v);
const excluded = ['providerProofBytes', 'providerProofDigest', 'recordDigest', 'signature'];
export function createRetirementDecisionVerifier(configBytes) {
  let config, human, events, timed;
  try {
    ensure(bytes(configBytes, 131072)); config = parseCanonical(configBytes);
    ensure(exactKeys(config, ['version', 'scope', 'recordId', 'artifactRevision', 'corpusId', 'corpusVersion', 'eventId', 'eventDigest', 'historyDigest', 'currentRegistryBytes']) &&
      config.version === 'steer-retirement-decision-context/v1' && exactKeys(config.scope, ['organization', 'itemId', 'environmentId']) &&
      config.scope.organization === 'steer-platform' && config.scope.itemId === '0001-flight-deck-foundation' && (config.scope.environmentId === null || text(config.scope.environmentId)) &&
      ['recordId', 'corpusId', 'corpusVersion'].every(k => text(config[k])) && hex(config.artifactRevision, 40) && hex(config.eventDigest, 64) && hex(config.historyDigest, 64) &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(config.eventId) && bytes(config.currentRegistryBytes, 65536));
    human = createHumanAuthorityVerifier(config.currentRegistryBytes, 'qualified-retirement');
    events = createLifecycleEventVerifier(config.currentRegistryBytes); timed = createTimedRecordVerifier(config.currentRegistryBytes);
  } catch { throw new Error('RETIREMENT_DECISION_CONFIGURATION_INVALID'); }
  const configDigest = sha256(configBytes), selector = { ...config.scope, recordId: config.recordId, recordClass: 'RC-CORPUS-PROVENANCE', artifactRevision: config.artifactRevision,
    corpusId: config.corpusId, corpusVersion: config.corpusVersion }, selectorDigest = sha256(jcs(selector));
  return Object.freeze({ configDigest, policyDigest, humanPolicyDigest: human.policyDigest,
    verify(serialized, evaluationTime) {
      const limits = { effects: zeroEffects(), executionAuthorized: false, deletionVerified: false, liveProviderUsed: false, futureArchiveVerified: false, qualifiedPriorHistoryVerified: false };
      try {
        const now = time(evaluationTime); ensure(bytes(serialized, 16777216)); const input = parseCanonical(serialized);
        ensure(exactKeys(input, ['version', 'policyDigest', 'configDigest', 'eventBytes', 'historyBytes', 'humanBundleBytes', 'historyHeadBytes']) &&
          input.version === 'steer-retirement-decision/v1' && input.policyDigest === policyDigest && input.configDigest === configDigest && Array.isArray(input.historyBytes) &&
          input.historyBytes.length <= 128 && bytes(input.humanBundleBytes, 1048576) && bytes(input.historyHeadBytes, 65536));
        ensure(events.verify(jcs({ version: 'steer-r5-001-events/v1', policyDigest: events.policyDigest, scope: config.scope,
          eventBytes: input.eventBytes, historyBytes: input.historyBytes, evaluationTime }), evaluationTime).state === 'validated-trigger');
        const event = parseCanonical(input.eventBytes), prior = input.historyBytes.map(parseCanonical), all = [...prior, event];
        ensure(all.every(e => e.recordId === config.recordId && e.recordClass === selector.recordClass && e.artifactRevision === config.artifactRevision && e.policySha256 === RETENTION_POLICY_SHA) &&
          event.eventType === 'corpus-retired' && event.eventId === config.eventId && event.recordDigest === config.eventDigest && event.corpusId === config.corpusId && event.corpusVersion === config.corpusVersion &&
          event.timestampAuthority === 'qualified-owner-decision-commit' && event.actorAuthority === 'privacy-legal-records-owner' && !prior.some(e => e.eventType === 'corpus-retired') &&
          sha256(jcs(input.historyBytes)) === config.historyDigest);
        const checked = human.verify(jcs({ version: human.envelopeVersion, policyDigest: human.policyDigest, bundleBytes: input.humanBundleBytes }), evaluationTime);
        ensure(checked.decision === 'ALLOW' && checked.executionAuthorized === false && checked.consumedRecordIds.length === 9 && jcs(checked.effects) === jcs(zeroEffects()));
        const bundle = parseCanonical(input.humanBundleBytes), authority = parseCanonical(bundle.authorityBytes), inventory = parseCanonical(bundle.inventoryBytes),
          reservation = parseCanonical(bundle.casReservationBytes), cas = parseCanonical(bundle.casHeadBytes), replay = parseCanonical(bundle.replayLedgerBytes);
        const rawHead = parseCanonical(input.historyHeadBytes), head = timed.verifyBytes(input.historyHeadBytes, { domain: 'authority', recordedAt: rawHead.recordedAt, evaluatedAt: evaluationTime }).record;
        const previousEventDigest = prior.at(-1)?.recordDigest ?? null, held = new Set(); let everHeld = false;
        for (const e of prior) {
          if (e.eventType === 'hold-applied') { ensure(!held.has(e.holdId)); held.add(e.holdId); everHeld = true; }
          if (e.eventType === 'hold-released') { ensure(held.has(e.holdId)); held.delete(e.holdId); }
        }
        const holdState = held.size ? 'active' : everHeld ? 'released' : 'none';
        ensure(exactKeys(head, ['kind', 'source', 'configDigest', 'policyDigest', 'registryDigest', 'historyDigest', 'historyComplete', 'previousEventDigest', 'holdState', 'recordedAt', 'validThrough', 'recordDigest', 'signature']) &&
          head.kind === 'retirement-history-head' && head.source === 'authoritative-lifecycle-store' && head.configDigest === configDigest && head.policyDigest === policyDigest && head.registryDigest === timed.registryDigest &&
          head.historyDigest === config.historyDigest && head.historyComplete === true && head.previousEventDigest === previousEventDigest && head.holdState === holdState &&
          (!prior.length || time(head.recordedAt) >= time(prior.at(-1).occurredAt)) && time(head.recordedAt) <= time(authority.decidedAt) &&
          now - time(head.recordedAt) <= 300000000000n && now < time(head.validThrough) && time(head.validThrough) > time(head.recordedAt) && time(head.validThrough) - time(head.recordedAt) <= 300000000000n);
        const eventBindingDigest = sha256(jcs(Object.fromEntries(Object.entries(event).filter(([k]) => !excluded.includes(k)))));
        ensure(authority.decisionKind === 'corpus-retired' && authority.eventId === event.eventId && authority.eventBindingDigest === eventBindingDigest &&
          authority.previousEventDigest === previousEventDigest && authority.historyHeadDigest === head.recordDigest && authority.corpusId === config.corpusId && authority.corpusVersion === config.corpusVersion &&
          authority.holdState === holdState && event.actorId === authority.humanSubject && event.actorAuthority === authority.activeHat &&
          jcs(inventory.items) === jcs([{ recordId: config.recordId, recordClass: selector.recordClass, artifactRevision: config.artifactRevision, selectorDigest }]) &&
          jcs(authority.conditions) === jcs([`event:${eventBindingDigest}`, `selector:${selectorDigest}`, `previous-event:${previousEventDigest ?? 'none'}`, `history-head:${head.recordDigest}`, `policy:${policyDigest}`]) &&
          jcs(authority.safeguards) === jcs(['exact-record-scope', 'independent-provider-proof', 'current-qualified-owner', 'non-erasure-retirement']) &&
          time(reservation.recordedAt) <= time(event.occurredAt) && time(cas.snapshotAt) >= time(head.recordedAt) && time(cas.snapshotAt) <= time(authority.decidedAt) &&
          time(replay.snapshotAt) >= time(head.recordedAt) && time(replay.snapshotAt) <= time(authority.decidedAt));
        return { state: 'verified-retirement-decision-evidence', firstError: null, ...limits, factOnly: true, retirementAuthorityVerified: true, currentActionAuthorityRequired: true,
          configDigest, policyDigest, registryDigest: timed.registryDigest, eventDigest: event.recordDigest, eventBytesDigest: sha256(input.eventBytes), historyDigest: config.historyDigest,
          historyHeadDigest: head.recordDigest, authorityDigest: authority.recordDigest, humanBundleDigest: sha256(input.humanBundleBytes), reservationDigest: reservation.recordDigest,
          selectorDigest, previousEventDigest, holdState, decidedAt: authority.decidedAt, retiredAt: event.occurredAt, evaluatedAt: evaluationTime,
          consumedRecordIds: checked.consumedRecordIds, inputDigest: sha256(jcs({ bytes: serialized, evaluatedAt: evaluationTime })),
          requires: ['verified-qualified-parent-history', 'fresh-retirement-archive-revalidation-for-later-audits', 'complete-parent-lifecycle-authority'] };
      } catch { return { state: 'blocked', firstError: 'RETIREMENT_DECISION_INVALID', ...limits, retirementAuthorityVerified: false }; }
    } });
}
