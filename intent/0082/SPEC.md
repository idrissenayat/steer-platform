# Specification · development candidate

## Explicit profile and source preservation

`createHumanAuthorityVerifier(trustedRegistryBytes, 'qualified-event')` selects
an explicit server-side profile. The default remains `disposition`; unknown
profiles deny. The profile cannot be installed by an evidence-envelope field.
The new `steer-qualified-event-human/v1` envelope has a distinct policy digest
binding the original human policy, current registry and qualified schema policy.
The constructor exposes its envelopeVersion for trusted composition.

An in-memory schema is derived from the frozen source with independently recorded
source/successor digests. The source file and the existing precision schema stay
unchanged. The new authority version is `steer-qualified-lifecycle-decision/v1`,
authorityType is `qualified-lifecycle-decision`, and decisionKind is exactly
hold-applied or hold-released. Reference revocation is not admitted yet.

The profile removes copyInventoryDigest, referenceState, allowedCopyProviders,
sourceOriginalExcluded, deadlineSeconds, eraseMethod and terminalEventId. Supplying
those old fields denies. It adds selectorInventoryDigest, eventId,
eventBindingDigest and previousHoldEventDigest. Hold application requires a null
predecessor digest; hold release requires a SHA-256 predecessor and holdState=active.
The six original human time fields retain exact nanosecond validation.

## Full current human proof

All nine existing signed records remain mandatory: authority, independent full
human-provider binding, identity, qualification, assignment, selector inventory,
replay ledger, CAS head and winning reservation. Exact policy/target, qualified
privacy/legal records-owner hat, actor/session/provider anchor, full binding,
current expiry and explicit trusted clock checks are shared with 0058/0079.
Historical keys cannot be omitted, replaced or extended. The qualified profile
also requires distinct public-key material across all original/current bindings.

The closed selector inventory contains exactly one row with recordId, recordClass,
artifactRevision and selectorDigest. IDs are bounded and cannot contain wildcard
or control characters; digests/revision have exact hexadecimal lengths. Copy
inventory rows, missing selectors, extra fields and multiple targets deny.

Decision, identity and inventory age are at most 300 seconds. Authority lifetime
from decidedAt is at most 300 seconds. Head/replay/reservation age and lifetime
are at most 300 seconds. Reservation cannot precede the decision or replay/head
snapshots and cannot outlive authority, replay or head. All comparisons are exact;
expiry is half-open. Qualification/assignment retain the existing explicit
observed-as-of-decidedAt basis rather than invented native timestamps.

## Semantics and limits

Every response has zero effects and executionAuthorized=false. Candidate ALLOW
only verifies this exact current qualified-decision record and its supporting
proofs. It does not prove the event/predecessor/selector digest matches a selected
lifecycle history, that the event commit followed the approval reservation, or
that identities were not reused across event/disposition decisions. Those checks
belong to the next full history composition and are not implied here.

No actual human signature, provider/IdP access, trust publication, hold mutation,
deletion or deployment occurs. The existing current-v2 lifecycle remains unchanged
and is not yet upgraded to require this profile. All five R5 findings and
independent/protected review remain open.

