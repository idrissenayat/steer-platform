// Complete current hold-decision binding; no mutation or human signing route.
import { exactKeys, jcs, parseCanonical, sha256, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createHumanAuthorityVerifier } from '../0058/human-authority.candidate.mjs';
import { createMixedHistoryVerifier, policyDigest as mixedPolicy } from '../0081/mixed-history.candidate.mjs';
import { schemaPolicyDigest as qualifiedSchemaPolicy } from '../0082/qualified-decision-schema.candidate.mjs';
import { exactInstant } from '../0069/exact-time.candidate.mjs';
const excluded = ['providerProofBytes', 'providerProofDigest', 'recordDigest', 'signature'];
export const policyDigest = sha256(jcs({ version: 'steer-qualified-history/v1', mixedPolicy, qualifiedSchemaPolicy, excluded,
  rules: 'every current hold decision has a full qualified owner proof; exact actor event selector predecessor and before-commit reservation; ordered unique identities; historical hold releases deny until separately qualified; facts only' }));
const ensure = (value) => { if (!value) throw new Error('QUALIFIED_HISTORY_INVALID'); };
const time = (value) => { const parsed = exactInstant(value); ensure(parsed !== null); return parsed; };
const text = (value) => typeof value === 'string' && value.length > 0 && value.length <= 512 && !/[\u0000-\u001f*?]/u.test(value);
export function createQualifiedHistoryVerifier(trustedHistoricalContextBytes) {
  const history = createMixedHistoryVerifier(trustedHistoricalContextBytes), context = parseCanonical(trustedHistoricalContextBytes);
  const human = createHumanAuthorityVerifier(context.currentRegistryBytes, 'qualified-event');
  const selector = { ...context.scope, recordId: context.recordId, recordClass: context.recordClass, artifactRevision: context.artifactRevision };
  const selectorDigest = sha256(jcs(selector));
  const expectedRow = { recordId: context.recordId, recordClass: context.recordClass, artifactRevision: context.artifactRevision, selectorDigest };
  return Object.freeze({ policyDigest,
    verify(serialized, evaluationTime) {
      try {
        ensure(typeof serialized === 'string' && serialized.length <= 16777216); const input = parseCanonical(serialized);
        ensure(exactKeys(input, ['version', 'policyDigest', 'archivedEvidenceBytes', 'eventBytes', 'historyBytes', 'qualifiedDecisionBytes']) &&
          input.version === 'steer-qualified-history/v1' && input.policyDigest === policyDigest && typeof input.qualifiedDecisionBytes === 'string' && input.qualifiedDecisionBytes.length <= 12582912);
        const facts = history.verify(jcs({ version: 'steer-mixed-history/v1', policyDigest: history.policyDigest,
          archivedEvidenceBytes: input.archivedEvidenceBytes, eventBytes: input.eventBytes, historyBytes: input.historyBytes }), evaluationTime);
        ensure(facts.state === 'verified-mixed-history');
        const proofs = parseCanonical(input.qualifiedDecisionBytes); ensure(Array.isArray(proofs) && proofs.length <= 128);
        const events = [...input.historyBytes, input.eventBytes].map(parseCanonical), held = new Map(), seen = new Set(), approvals = [];
        const unique = (type, value) => { ensure(text(value) && !seen.has(jcs([type, value]))); seen.add(jcs([type, value])); };
        let proofIndex = 0, everHeld = false;
        for (let index = 0; index < events.length; index++) {
          const event = events[index];
          if (!['hold-applied', 'hold-released'].includes(event.eventType)) continue;
          const previous = held.get(event.holdId);
          ensure(event.eventType === 'hold-applied' ? !previous : !!previous);
          if (index < facts.archivedEventCount) {
            // A historical application only restricts disposition. A historical
            // release needs qualified archival evidence, not a new backdated vote.
            ensure(event.eventType === 'hold-applied'); held.set(event.holdId, event); everHeld = true; continue;
          }
          const entry = proofs[proofIndex++];
          ensure(exactKeys(entry, ['eventId', 'humanBundleBytes']) && entry.eventId === event.eventId &&
            typeof entry.humanBundleBytes === 'string' && entry.humanBundleBytes.length <= 1048576);
          const result = human.verify(jcs({ version: human.envelopeVersion, policyDigest: human.policyDigest, bundleBytes: entry.humanBundleBytes }), evaluationTime);
          ensure(result.decision === 'ALLOW');
          const bundle = parseCanonical(entry.humanBundleBytes), authority = parseCanonical(bundle.authorityBytes), inventory = parseCanonical(bundle.inventoryBytes);
          const reservation = parseCanonical(bundle.casReservationBytes), head = parseCanonical(bundle.casHeadBytes);
          const bindingDigest = sha256(jcs(Object.fromEntries(Object.entries(event).filter(([field]) => !excluded.includes(field)))));
          const previousDigest = previous?.recordDigest ?? null;
          ensure(authority.decisionKind === event.eventType && authority.eventId === event.eventId && authority.eventBindingDigest === bindingDigest &&
            authority.previousHoldEventDigest === previousDigest && authority.holdState === (held.size ? 'active' : everHeld ? 'released' : 'none') &&
            event.actorId === authority.humanSubject && event.actorAuthority === authority.activeHat &&
            event[event.eventType === 'hold-applied' ? 'reasonAuthority' : 'releaseAuthority'] === authority.authorityId &&
            jcs(inventory.items) === jcs([expectedRow]) &&
            jcs(authority.conditions) === jcs([`event:${bindingDigest}`, `selector:${selectorDigest}`, `previous-hold:${previousDigest ?? 'none'}`]) &&
            jcs(authority.safeguards) === jcs(['exact-record-scope', 'independent-provider-proof', 'current-qualified-owner', 'revision-bound-decision']) &&
            time(reservation.recordedAt) >= time(authority.decidedAt) && time(reservation.recordedAt) <= time(event.occurredAt) &&
            (!previous || time(authority.decidedAt) >= time(previous.occurredAt)));
          if (event.eventType === 'hold-applied') ensure(event.selectorsSha256 === selectorDigest);
          const approval = { authorityId: authority.authorityId, providerRecordId: authority.providerRecordId, idempotencyKey: authority.idempotencyKey,
            reservationId: reservation.reservationId, headPair: jcs([head.headId, head.head]) };
          for (const [field, value] of Object.entries(approval)) unique(field, value);
          approvals.push(approval);
          if (event.eventType === 'hold-applied') { held.set(event.holdId, event); everHeld = true; } else held.delete(event.holdId);
        }
        ensure(proofIndex === proofs.length);
        return { ...facts, state: 'verified-qualified-history', qualifiedDecisionCount: approvals.length, qualifiedApprovals: approvals,
          qualifiedDecisionDigest: sha256(input.qualifiedDecisionBytes), policyDigest, executionAuthorized: false, effects: zeroEffects() };
      } catch { return { state: 'blocked', firstError: 'QUALIFIED_HISTORY_INVALID', executionAuthorized: false, effects: zeroEffects() }; }
    },
  });
}
