# Specification · development candidate

## Explicit trusted profile

`createHumanAuthorityVerifier(trustedRegistryBytes, 'qualified-reference')` selects
the new profile. The existing default disposition and qualified-event profiles,
policy digests and schemas remain unchanged. An input envelope cannot choose or
install the profile or registry.

The new closed envelope is `steer-qualified-reference-human/v1`, with a separate
policy digest binding the current registry, original human policy and new schema.
The schema is independently derived in memory from the frozen human schema; no
signed source file is rewritten. The authority's version is
`steer-qualified-reference-decision/v1`, authorityType is qualified-reference-decision,
and decisionKind is exactly reference-revocation-authorized.

Required decision bindings are eventId, eventBindingDigest, selectorInventoryDigest,
referenceInventoryDigest, verificationBundleDigest and tombstoneRecordId. The
human-provider proof covers all non-circular authority fields, including those
bindings. TombstoneRecordId is bounded to 512 characters with no wildcard/control
characters. HoldState may be none/active/released; referenceState may be active/cleared.
These are reported decision-context facts, not a resulting permission to delete.

The profile removes copyInventoryDigest, allowedCopyProviders,
sourceOriginalExcluded, deadlineSeconds, eraseMethod and terminalEventId. A hold
predecessor field is not part of this schema. Unknown, missing, cross-profile and
disposition-only fields deny. Exact nanosecond validation applies to the original
six authority time fields.

## Complete current owner evidence

All nine signed records remain mandatory: authority, full human-provider binding,
identity, qualification, assignment, selector inventory, replay ledger, CAS head
and winning reservation. The owner/hat/target/policy and current key validity,
revocation, replay and CAS checks are shared with the existing verifier. Qualified
profiles require independent key material and preserve old key windows/material.

The closed selector inventory contains exactly one typed record row with recordId,
recordClass=RC-REFERENCED-EVIDENCE, artifactRevision and selectorDigest. Multiple or
missing records, wildcard selectors, different classes and extra fields deny.

Decision/identity/inventory freshness, authority lifetime and CAS/replay snapshot
age/lifetime remain bounded to 300 seconds. The reservation follows the decision
and relevant snapshots and cannot outlive its authority/head/replay evidence.
The separately supplied trusted clock must match the bundle evaluation time;
expiry is half-open and exact.

## Limits

Candidate ALLOW verifies only this exact qualified current decision and supporting
proof. It does not establish that a digest names the complete reference inventory,
that verification bytes remain retained, that a tombstone exists, that an event
was committed or that history/reference state matches the decision. Those are
the next full-composition requirements. The current runtime still excludes
RC-REFERENCED-EVIDENCE, and archived owner verification remains hold-only.

Every result has zero effects and executionAuthorized=false. No owner signature,
reference mutation, deletion, provider access, trust publication, gate approval,
deployment or spending occurs. All five formal R5 findings remain open.
