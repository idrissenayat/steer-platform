# Spec: Policy-ranked event ordering

## Source and comparator

The accepted retention policy at
`intent/0001/reviews/domain/round-2/remediation/RETENTION-AND-RECORDS-POLICY.candidate.md`
defines ordering by `(occurredAt, ordinal, eventId)`. Its SHA-256 is
`f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

The closed code-owned mapping is:

| Rank | Event types |
|---|---|
| 10 | hold-applied, hold-released |
| 15 | record-superseded, corpus-version-superseded, corpus-retired, environment-retired |
| 20 | expiry-due |
| 30 | deletion-requested |
| 40 | deletion-completed |
| 50 | tombstone-committed |

The helper first compares exact BigInt instants. A strictly later instant keeps
the prior behavior for every event type; a reversed instant denies. At equal
instants, both types must have a known rank. Higher rank follows lower rank;
equal rank requires a strictly larger UUID byte value. Canonical hex-lowercase
ASCII comparison implements UUID byte order; locale-sensitive sorting is not used.

For unranked equal-time events, the candidate denies instead of inventing a
default rank. This includes unrelated session/corpus/derived completion types;
the increment does not claim acceptance of every possible equal-time pair.
Whole seconds and explicit zero fractional seconds denote the same instant, but
exact original timestamp strings remain bound by their event/provider signatures.

## Integration and replay

0059 checks every prior/current pair in the supplied order. It never sorts the
input or changes signed event bytes. A caller ordinal is an unknown schema field
and denies. eventOrderPolicyDigest binds the source policy hash, mapping and
comparison semantics; the event candidate policy and dependent lifecycle graph
policy therefore change explicitly. Old policy pins are not silently upgraded.

The event-ID replay set uses lowercase UUID identity, preventing a second signed
record with only UUID letter case changed from passing as a different event.
The original event ID is retained in payloads and output. Provider IDs, binding
digests, signatures and all other evidence remain exact. No normalization or
re-signing of stored evidence occurs.

Ordering is not an approval: every tied event still traverses the closed schema,
scope check, ordinary signature, independent full provider proof, exact native
time and current key validation. Duplicate event/proof IDs and digests still deny.
Full 0061 graph composition still checks matching hold application/release,
current signed hold/reference state, per-copy human/shared authority, receipts
and separate tombstone authorization. A syntactically ordered release without
a preceding application does not pass the full lifecycle check.

## Limits and boundaries

Existing 128-history/129-total-event and byte limits remain. No truncation,
partial success or restored ordering fallback. Errors remain fixed/content-free
and all candidate results retain zero effects. The pure comparator itself is
not a signature verifier or disposition capability.

Remaining: unranked tie semantics where policy clarification is needed, auxiliary
native event-time rules, future-retention/archival/key rotation, reference
revocation, full raw-key/pre-terminal grant behavior, migration and complete
normative evidence. All five R5 findings and independent/protected review remain
open. No source policy, frozen schema, key window, provider state or gate is changed.
