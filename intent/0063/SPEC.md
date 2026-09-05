# Specification

## Trusted composition and closed input

`createPrivacyCostTimeVerifier(contextBytes)` accepts only canonical
`{version: "steer-audit-clock/v1", evaluatedAt}` from trusted composition. Create
one verifier per audit; no wall-clock default, request-selected clock or registry.
An eventual runtime must obtain this clock itself, never deserialize it from a
tool request. The immutable registry is the existing frozen synthetic trust
registry; 0058 enforces half-open validity and revocation at both instants.

The request contains exactly version `steer-privacy-cost-time/v1`, policyDigest,
kind (`privacy` or `cost-reconciliation`), correctionBytes and observationBytes.
The policy binds 0056/0057 policies, the trust registry, observation domain and
timing/limit rules. Correction bytes remain the unchanged 0056 or 0057 envelope.
Only the new composed path provides this timing assurance; direct historical
exports remain available for frozen counterexample/review reproduction.

## Independent observation

The closed verifier-domain record contains version
`steer-evidence-observation/v1`, kind, correctionDigest, policyDigest,
registryDigest, inventoryDigest, recordCount, recordedAt, recordDigest and
signature. It must bind exact canonical correction bytes, the same kind/policy
and registry, and recordedAt exactly equal to graph.decisionAt. Evaluation must
be at or after that decision. Its selected public-key anchor must differ from
every evidence signer. The verifier domain is the pinned synthetic independent
observation authority, not a real provider integration or human approval.

The inventory is recomputed, not trusted from a claimant. Each entry contains
path, domain, bytesDigest, recordDigest, timeBasis and recordedAt. Order is the
following table order, then original array order. The attestation binds SHA-256
of this canonical array and its exact count. Reordering a graph requires a fresh
observation of those exact bytes; it must not change the business result.

| Evidence | Domain | Time basis |
|---|---|---|
| Privacy source/use authority | authority | observed-as-of |
| Privacy sanitizer and inspection | record | observed-as-of |
| Every raw copy | record | signed createdAt |
| Every raw authority | authority | observed-as-of |
| Every raw receipt | provider | signed recordedAt |
| Cost authorization | money | signed sealedAt |
| Nested authorization providerProof | provider | signed recordedAt |
| Price | money | observed-as-of |
| Price provider proof | provider-usage | signed recordedAt |
| Every ledger line | money | observed-as-of |
| Every provider usage | provider-usage | signed recordedAt |
| Every provider invoice | provider-invoice | signed issuedAt |
| Every variance | money | signed recordedAt |
| Every reconciliation successor | money | signed reconciledAt |

Native timestamps must be valid and no later than observation. These are signed
claims about the named event, not necessarily cryptographic issuance timestamps.
For records with no such field, verify the signature/key as of independent
observation and evaluation; never substitute validFrom/effectiveAt as issuance.
Nested providerProof is serialized canonically from its signed parent object.

Observation proves the attestor saw these bytes as of the decision, not that it
proved their original issuance or independently executed a source operation.
This bounded rule does not resolve a future requirement for issuance proof;
such a requirement must introduce source-native timestamp evidence explicitly.

## Business checks and outputs

Run every timed signature before the mandatory original correction. Privacy
additionally requires source and use validThrough to remain strictly after
evaluation, and copy creation no later than its deletion receipt. It cannot
resurrect expired use grants by selecting an old graph decision.

Cost is a historical reconciliation audit: an expired spending period does not
itself invalidate a later invoice audit, but key expiry/revocation at evaluation
does. It grants no new spending. 0057 still checks all five line arrays, exact
bijective lineage, provider bytes, amounts, ordering, 24-hour limit and aggregate
before rounding. 0056 still checks the entire original privacy graph and Unicode
phone detection. Neither result can bypass these checks.

Successful results retain original business fields plus timePolicyDigest,
evaluatedAt, observationDigest, timedRecordCount and observedAsOfCount. Every
failure returns the same content-free DENY/TIME_EVIDENCE_INVALID/zero-effects
shape; no partial aggregate, prompt, source, provider error or exception echo.

Limits are 12 Mi UTF-16 outer characters, 8 Mi correction, 4 Mi graph, 65,536
observation characters, 16,384 per evidence record and 64 per array. Inventory
hashing supports the full 64-line/324-record cost case without inflating the
signed observation. Existing semantic limits remain mandatory.

## Not completed here

Non-reconciliation cost modes, spend authorization, recovery and the remaining
public-oracle timing inventory; full lifecycle/migration matrices; future-key
coverage; source-native observation/issuance integration; independent complete-
package review, protected incorporation and formal gates. No production route
imports this candidate and no external operation executes.
