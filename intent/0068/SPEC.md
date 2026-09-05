# Spec: Source-faithful lifecycle retention

## Source and compatibility

The exact retention source is
`intent/0001/reviews/domain/round-2/remediation/RETENTION-AND-RECORDS-POLICY.candidate.md`,
SHA-256 `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.
Its historical status header is preserved; HR-01-R2 acceptance/ratification is
recorded separately. This increment neither replaces that ruling nor signs a gate.

0061 remains the composed entry point. Its policy digest explicitly binds the
new earliest-rebuildable and derived-manifest rules and 128-entry limit. Older
envelopes fail the policy pin; they are not re-signed or transformed. The frozen
table remains unchanged for traceability. Its provenance item-closure surrogate
is explicitly overridden by the signed source rule, not treated as normative.

## Rebuildable records

After full event/provider/time/history verification, select the first matching
supersession or rebuild request. Its event ID must be the terminal-event binding
in each copy's human authority and the separate tombstone authority. Existing
shared protected-action, replay and receipt checks remain mandatory. Same-type
repetitions still fail closed rather than guessing which reopening applies.

## Provenance manifest and completion

For RC-CORPUS-PROVENANCE only, require `derivedInventoryBytes` in the closed graph
and `derivedInventoryDigest` in its closed authority-signed state. Other classes
reject these fields. The derived bytes are included in the full input digest
used by the protected copy/tombstone actions.

The closed provider-domain signed record has exactly kind, configDigest, source,
manifestId, corpusId, corpusVersion, entries, complete, recordedAt, validThrough,
recordDigest and signature. Kind is `derived-inventory`; source is
`authoritative-derived-record-manifest`; complete must be true. It must match
the independently authority-signed state digest and the sole corpus-retired
event's corpus ID/version. Its key is checked at recording and evaluation time.
It must follow the latest verified event, precede or equal the state snapshot,
be no more than 300 seconds old and remain strictly before validThrough.

There are 0–128 sorted entries, each exactly derivedRecordId,
derivedRecordClass and deletionEventId. IDs/event IDs are unique; classes must
exist in the pinned table; a child cannot be the selected provenance record.
Each entry has exactly one fully verified `derived-record-deleted` event with
the same record ID/class and parent corpus ID/version. Every such event in the
history must be accounted for; missing, orphan, duplicate, substituted or
out-of-order manifest entries fail closed. Event schemas also require the
deletion-receipt digest, but this candidate does not retrieve those receipts.

The expiry is seven calendar years after the later of the sole retirement and
the maximum matched deletion time. Multiple distinct derived completions are
valid. Item closure is not a substitute and cannot move this boundary. A signed
complete empty inventory attests no derived records, making retirement the sole
trigger; missing inventory is never interpreted as empty.

Manifest completeness is an assertion by the trusted source, not a fact proven
by a caller's row count. Production integration must derive it from the actual
authoritative inventory and verify receipt availability. No runtime completeness
or actual deletion is claimed here.

## Existing rules and limits

Earlier sanitized-corpus selection, parent minimum caps, holds/references, strict
calendar arithmetic, immutable retention and the raw 60-second completion
deadline remain. Every result has typed zero effects. The existing 128-history
event, 65,536-unit signed-record and 16-Mi-unit graph limits also apply; no partial
success or truncation. A 128-child manifest uses 129 total verified events when
retirement is included.

## Evidence boundary

The suite exercises all 16 classes at a current valid-key instant: immutable,
scheduled, immediate/raw complete and parent-capped complete outcomes. It does
not claim future completed dispositions for 1/3/7-year records. Current-key
requirements are unchanged; expired original evidence still fails. Future trust
rotation/archival semantics, reference-revocation positives, sub-millisecond
canonical-time fidelity, the full normative matrix and independent/protected
review remain required. Raw-copy fixture coverage is not proof of the complete
three-key inventory requirement in the frozen amendment.
