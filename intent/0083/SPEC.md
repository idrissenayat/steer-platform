# Specification · development candidate

## Explicit trusted composition

`createQualifiedHistoryVerifier(trustedHistoricalContextBytes)` composes the exact
0081 mixed-history verifier and 0082 qualified-event human profile. The trusted
runtime selects `steer-lifecycle-runtime/v3`; the resulting graph requires
`steer-lifecycle-graph/current-v3` and `qualifiedDecisionBytes`. Separate policy
digests bind this contract and its dependencies. Earlier versions remain explicit
compatibility candidates, not equivalent qualified-source verification.

The closed `steer-qualified-history/v1` envelope contains policyDigest,
archivedEvidenceBytes, eventBytes, historyBytes and qualifiedDecisionBytes.
Limits are 16 MiB for the envelope, 12 MiB for serialized decision rows, 128 rows
and 1 MiB per human bundle, in addition to the mixed-history event/byte limits.
Rows contain exactly eventId and humanBundleBytes in current hold-event order.
Missing, duplicate, extra, reordered, malformed or unconsumed rows deny.

## Qualified event binding

Every current hold application/release requires all nine signed current human
proof records. The profile, clock, freshness, qualification, assignment, provider
binding, replay and winning CAS requirements from 0082 remain intact.

The selector digest covers organization, itemId, environmentId, recordId,
recordClass and artifactRevision from trusted context. The inventory must contain
exactly that one record row. The event binding digest covers the full event
payload excluding providerProofBytes, providerProofDigest, recordDigest and
signature. The independently verified provider event proof still binds that same
payload through the mixed-history verifier.

Authority decisionKind/eventId/eventBindingDigest must equal the actual event.
The human subject and active hat must equal actorId and actorAuthority; the
event's reasonAuthority/releaseAuthority must equal authorityId. Applications
also bind selectorsSha256 to the trusted selector digest.

Track active holds by holdId. Application requires no matching active hold;
release requires one and binds previousHoldEventDigest to its exact signed digest.
The owner's holdState must match the preceding aggregate history state. Conditions
are exactly event, selector and previous-hold digest strings; safeguards are
exact-record-scope, independent-provider-proof, current-qualified-owner and
revision-bound-decision. Reservation must follow the decision and precede or equal
event commitment. Release decision cannot precede its held event. Comparisons
preserve nanoseconds and half-open expiry.

Authority IDs, human-provider record IDs, idempotency keys, reservation IDs and
CAS head ID/value pairs are unique across hold decisions and later copy/tombstone
human approvals. The graph input digest binds qualifiedDecisionBytes, so downstream
actions/receipts cannot be transferred from another qualified history.

## Historical and execution boundaries

Archived applications may restrict disposition without asserting a qualified
approval. Every archived release denies until full qualified archival proof is
implemented. Current qualified release of an archived application is supported;
it is a new present-time decision, not backdated permission. Existing archive
integrity, old-key revocation, current source proof and selected provider-key
checks still apply. Active holds retain the object.

The same four current-runtime record classes remain admitted; referenced evidence,
raw copies and other classes are not broadened here. Other qualified-source event
types and qualified archival proof remain separate gaps. Every result has zero
effects and executionAuthorized=false. Verified history is fact-only; it neither
signs for a human nor mutates a hold, consumes a real CAS record, erases data or
closes a gate. No provider access or runtime trust deployment occurs.
