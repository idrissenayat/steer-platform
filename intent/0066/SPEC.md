# Specification

## Trusted input and inventory

`createAuthorizationTimeVerifier(contextBytes)` accepts only canonical
`{version: "steer-audit-clock/v1", evaluatedAt}` from composition, once per audit.
No default clock or request-selected trust registry. The original immutable
registry feeds 0058 key/domain validity and revocation checks at both times.

The request is exactly version `steer-authorization-time/v1`, policyDigest,
bundleBytes and observationBytes. bundleBytes is the canonical original bundle
containing the three manifest/registry/policy artifacts and ten signed records.
The original oracle still verifies exact frozen policy/manifest/registry bytes,
selectors, credential/delegation/assignment/authority/resources and replay/CAS.
This does not silently translate the old contract into the separate 0060 model.

The closed verifier-domain observation contains version
`steer-authorization-observation/v1`, bundleDigest, policyDigest, registryDigest,
inventoryDigest, recordCount, recordedAt, recordDigest and signature. It binds
SHA-256 of the complete exact bundle and the current candidate policy/registry.
recordedAt must equal the request's requestedAt, at or before evaluation. The
selected observer key must differ from every evidence signing anchor.

The complete code-derived inventory has path, domain, bytesDigest, recordDigest,
timeBasis and recordedAt for each of these ten records, in order:

| Record | Domain | Time basis | Current evaluation bound |
|---|---|---|---|
| Request | record | requestedAt | at or before evaluation |
| Upstream credential | upstream | issuedAt | strictly before expiresAt |
| Downstream credential | downstream | issuedAt | strictly before expiresAt |
| Delegation | delegation | issuedAt | strictly before expiresAt |
| Assignment | assignment | observed-as-of request time | validFrom <= evaluation < expiresAt |
| Authority | authority | decidedAt | strictly before validThrough |
| Provider resources | provider | recordedAt | age <= 300 seconds |
| Replay ledger | replay-authority | snapshotAt | age <= 300 seconds and before validThrough |
| CAS head | cas-authority | snapshotAt | age <= 300 seconds and before validThrough |
| Reservation | cas-authority | recordedAt | age <= 300 seconds and before validThrough |

Every native/as-of time must parse strictly and be no later than request time.
The observation binds the canonical inventory digest and exactly ten records;
callers cannot substitute order, subsets, domains or timestamp bases.
The assignment has no native issuance field: observed-as-of is an independent
observation, not an invented issuance time or a new assignment approval.

## Replay, effects and limits

Recompute the original immutable request digest from its exact original field
list before calling either branch of the original oracle. The list is pinned
in this candidate policy. This closes the original replay early return before
digest derivation; agreeing replay/delegation/reservation claims alone cannot
validate an arbitrary immutableRequestDigest.

Success returns VERIFIED with recordedDecision ALLOW or REPLAY_NOOP, consumed
record IDs, timing/observation metadata, zeroEffects and executionAuthorized false.
Do not copy the old oracle's hypothetical credential/provider/Git write counters
into an audit result: no such side effects were performed. Every failure is a
fixed content-free DENY/AUTHORIZATION_TIME_INVALID with zero effects and no
execution authority. No partial capability, raw payload or provider error escapes.

Limits: 1 Mi outer UTF-16 characters, 512 Ki bundle, 8,192 observation and 16,384
per signed source record. Old manifests/actions cannot be expanded by the caller.
No runtime route imports this candidate.

This does not prove actual CAS execution or stored replay-result bytes, sign a
gate, or finish the entire revised authorization model. Remaining accessibility/
public timing inventory, lifecycle/migration matrices, legacy issuance semantics,
complete-package independent review and protected incorporation remain required.
All five R5 findings remain formally open.
