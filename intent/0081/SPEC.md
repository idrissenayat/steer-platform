# Specification · development candidate

## Current event verifier

0059 now exposes `createLifecycleEventVerifier(trustedRegistryBytes)` using the
same complete verification body as its original export. It preserves every old
anchor's identity/material/windows and permits new keys/current revocation, not
omission or window extension. Its policy binds the exact selected registry.

`verify(serializedEnvelope, evaluationTime)` requires an explicit valid trusted
clock exactly matching the unsigned envelope clock. All original closed event
schemas, full event/provider signatures, native/current key validity, scope,
ordering and replay checks remain. Event and provider public keys must differ;
separate role labels on the same material are not independence. Original registry
policy/output stays exact; the new factory additionally denies execution.

## Mixed history

`createMixedHistoryVerifier(trustedHistoricalContextBytes)` binds the existing
0078 archive selection and current registry. Its closed `steer-mixed-history/v1`
envelope contains policyDigest, archivedEvidenceBytes, eventBytes and historyBytes.
The maximum serialized size is 16 Mi UTF-16 units, with 129 total events across
both eras and the existing 64 Ki per-event limits. No truncation is permitted.

First verify the full archived evidence through 0078. Its ordered events must
be the byte-exact prefix of the entire graph history. Verify every remaining
event through the selected current event verifier. Empty suffix is valid; missing
or different archive prefix is not. Recheck order across the complete sequence,
including the era boundary, and globally reject repeated event UUIDs/digests or
provider record IDs/digests. Every event binds the same record/class/artifact,
scope and signed retention policy. No sorting, dropping or ID relabeling occurs.

Standalone success is verified-mixed-history, with separate archive/current counts,
the full history digest, factOnly=true, currentActionAuthorityRequired=true,
executionAuthorized=false and zero effects. Current events are not an archive
attestation, action grant or signature by the human records owner.

## Full lifecycle composition

Trusted `steer-lifecycle-runtime/v2` selects the new history path; graph version
`steer-lifecycle-graph/current-v2` and its distinct policy digest bind that choice.
The existing historicalEvidenceBytes field still contains only the complete
archive envelope; graph eventBytes/historyBytes contain the full two-era sequence.
Current-v1 retains its prior entire-history archive contract and policy identity.
No implicit upgrade is performed.

Current-v2 requires unique public-key material across every original and current
registry binding: role aliases and relabeled old material deny at configuration.
This complements per-event/provider key independence. The four-class 0080 allowlist
is unchanged. Raw and referenced-evidence classes remain closed on this path.

The full lifecycle verifier processes holds across the combined history. Active
holds retain; a claimed cleared state with an active hold, unmatched release or
different hold ID denies. Every current event must precede the state snapshot.
Current inventory, archive-before-state proof, full human authority, protected
copy actions, exact selected provider receipts, aggregate and separate tombstone
checks still run. Input digests bind the entire current history plus archived
evidence; later history cannot be added without changing those bindings.

## Remaining limits

Completeness remains an authoritative state/archive assertion, not proof of a live
feed or a caller-supplied count. No live subscription, archive service, current
trust publication, atomic effect, provider erasure or human signature is performed.
Cross-era raw checkpoints and referenced-object revocation remain separate work.
Current hold-event proofs establish typed, provider-bound events and consistent
state transitions; a separate complete qualified-owner human bundle is not yet
composed for each hold decision. That source-policy binding must be added before
executable adoption, not inferred from the provider signature alone.
All five R5 findings, broader normative coverage and independent/protected review
remain open.
