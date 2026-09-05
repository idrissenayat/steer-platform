# Spec: Uniform lifecycle event/history verification

Require a closed canonical envelope with version, policyDigest, scope, eventBytes,
historyBytes and evaluationTime. scope has exactly organization, itemId and
environmentId. Organization is a nonempty string; item/environment are nonempty
strings or null. Strings are bounded to 256 UTF-16 units. Scope must match every
signed event; this is a consistency check, never a grant.

Enforce 8,388,608 UTF-16 units per envelope, 65,536 per serialized event and at
most 128 history events. No truncated-history fallback. Require explicit strict
evaluationTime; there is no wall-clock or fixed-time default.

For each history entry and then the current event, use the explicit 0070 precision
successor of the closed LIFECYCLE-EVENT schema, including event-type required
fields; the frozen schema file stays unchanged. Verify its ordinary
signature at occurredAt/evaluationTime using the 0058 timed verifier. Verify its
provider proof at recordedAt/evaluationTime against the independent trusted
registry. Both timestamps must be canonical and recordedAt must equal occurredAt.

The provider record is closed to providerRecordId, eventId, eventBindingDigest,
recordedAt, recordDigest and signature. Require matching provider/event IDs,
provider digest, and SHA-256 of the complete canonical event payload excluding
only providerProofBytes, providerProofDigest, recordDigest and signature. No
omitted historical proof, malformed schema or surrogate trigger is accepted.

Require exact instant/rank/UUID order under 0071. At equal instants only the ten
policy-ranked event types are accepted in increasing rank/UUID order; unranked
ties deny. Event UUID replay identity ignores hex letter case, without changing
signed bytes. Require unique event IDs/digests and provider
record IDs/digests across history and current event. Checks apply uniformly; no
special less-strict history branch. Return only current event ID/digest, verified
history count, policy digest and zero effects; all errors are fixed and omit
source payloads. Scope/proof failures never return validated-trigger.

This does not prove history completeness, choose a trusted record disposition,
authorize deletion/tombstoning or compose the lifecycle effect graph. That graph
must explicitly consume the exact event/digest and the new shared-action checks
before R5-001 is a complete correction. Other public oracles still need the
explicit-time rule under R5-002. Production routes and frozen history remain unchanged.
