// Ordering is a pure policy check, never signature or disposition authority.
import { exactInstant } from '../0069/exact-time.candidate.mjs';
import { RETENTION_POLICY_SHA, jcs, sha256 } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const ordinal = Object.freeze({
  'hold-applied': 10, 'hold-released': 10,
  'record-superseded': 15, 'corpus-version-superseded': 15,
  'corpus-retired': 15, 'environment-retired': 15,
  'expiry-due': 20, 'deletion-requested': 30,
  'deletion-completed': 40, 'tombstone-committed': 50,
});
export const eventOrderPolicyDigest = sha256(jcs({ version: 'steer-lifecycle-event-order/v1', retentionPolicyDigest: RETENTION_POLICY_SHA,
  ordinal, rules: 'exact instant, then policy ordinal, then UUID bytes; no caller ordinal or sorting; unranked equal-time events deny; UUID identity ignores hex letter case' }));
function key(event) {
  if (!event || typeof event !== 'object' || typeof event.eventType !== 'string' || typeof event.eventId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(event.eventId)) return null;
  const at = exactInstant(event.occurredAt);
  return at === null ? null : { at, ordinal: Object.hasOwn(ordinal, event.eventType) ? ordinal[event.eventType] : null, id: event.eventId.toLowerCase() };
}
export function lifecycleEventFollows(previous, current) {
  const after = key(current); if (!after) return false;
  if (previous === null) return true;
  const before = key(previous); if (!before || after.at < before.at) return false;
  if (after.at > before.at) return true;
  if (before.ordinal === null || after.ordinal === null) return false;
  return after.ordinal > before.ordinal || (after.ordinal === before.ordinal && after.id > before.id);
}
