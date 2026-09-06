# Specification · development candidate

## Trusted selection

`createHistoricalEventVerifier(configBytes)` takes a trusted closed context:
version `steer-historical-event-context/v1`, scope (organization/item/environment),
recordId, recordClass, artifactRevision, archiveReference (repository/revision/path),
historyDigest, observedAt and currentRegistryBytes. None may be installed from
an untrusted action request. Archive path is relative and traversal-free.

The current registry must retain every original anchor's domain, ID, algorithm,
public key, notBefore and notAfter exactly. It may add distinct successor keys or
record revocation. Historical anchors cannot be omitted, replaced or extended.
The selected configuration, current registry and original event/time policies are
digest-bound. Configuration is at most 128 Ki UTF-16 units; registry at most 64 Ki.

## Original facts and current revocation

The `steer-historical-events/v1` envelope contains policyDigest, eventBytes,
historyBytes, attestationBytes and retentionReceiptBytes. It is at most 12 Mi
UTF-16 units. The complete unchanged 0059 schema/provider/history verifier runs
at the trusted observedAt, preserving all 27 kinds, original signatures, exact
proof times, ordering, unique IDs and the 128-history-plus-current limit.

The exact ordered serialized event array must hash to the trusted historyDigest.
Every event binds the selected record/class/artifact, scope and signed retention
policy. Each event and nested provider proof is also verified against the current
registry at its native and original-observation times. An original key whose
known revokedAt is at or before current evaluation denies, even if revocation was
after the original observation. Ordinary expiry alone is allowed for historical
facts only; this does not restore a key's signing authority or action capability.

## Fresh independent revalidation and retained bytes

A current authority-domain `historical-event-attestation` from
`authoritative-history-revalidator` states `historical-facts-verified`. A separate
current provider-domain `historical-event-retention` from
`authoritative-archive-store` binds that exact attestation and attests complete
retained bytes whose digest equals the original ordered history.

Both closed records bind configuration/policy/current-registry/history digests,
archive reference, original observedAt, exact event count, and a derived ordered
inventory of each event ID, event bytes/digest, nested provider bytes/digest and
occurredAt. Their signatures must be independently keyed from each other and from
the historical event/provider keys. Native/current key validity is strict.

Current proof age and maximum lifetime are 300 seconds; expiry is half-open at
exact nanosecond precision. The archive receipt cannot precede or outlive the
attestation. Future observations, incomplete receipts, substitutions, omitted or
forged proofs and unknown fields deny. No fetch is inferred from a signed receipt:
the complete event and nested provider bytes must actually be present and verified.

## Output and limits

Success is `verified-historical-events`, factOnly=true,
currentActionAuthorityRequired=true, executionAuthorized=false and zero effects.
No trust is loaded from the evidence envelope. The attestation is not a qualified
human signature, a timestamp certification or a deletion/use permission.

The legacy 0059/0061 current-authority paths are unchanged and still reject expired
original keys. This helper is not yet composed with future fresh inventory, human
authorization, protected actions or provider/tombstone receipts. The current
registry/archive reference must eventually come from governed runtime selection;
synthetic future keys are not deployed or approved bindings. Actual retention,
compromise reporting, completeness and provenance of that selection require live
integration and independent review. All five R5 findings remain open.

