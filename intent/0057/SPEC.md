# Spec: Exact multi-line cost reconciliation

Require a closed canonical envelope: version, policyDigest, graphBytes,
varianceRecordsBytes and reconciliationRecordsBytes. The exact policy binds
bounds and semantics. Reject bare legacy graphs, stale policies, other kinds,
extra fields and mixed scalar/plural evidence. graphBytes contains the unchanged
legacy reconciliation graph shape with both scalar evidence fields empty.

Bounds: 8 Mi code units per envelope, 4 Mi per graph, 16 Ki per individual record,
1–64 ledger lines. Ledger, usage, invoice, variance and successor arrays must have
equal cardinality. Verify unique IDs/digests in each class and unique ledger
bindings in both additional arrays. Signed money evidence uses the existing
candidate verifier; every original provider/authorization check remains mandatory.

For each ledger record, match exactly one usage and invoice, one variance by
ledger digest, and one successor by predecessor-ledger digest. Verify exact
invoice/usage/variance digests; reject reused provider lines and orphan/missing
records. The arrays are independently reorderable. No first-element assumption.

Variance provider/ledger totals must equal the actual invoice/ledger totals and
their exact integer difference must match varianceNanoUsd. Require existing
within-threshold/reconciled statuses. Times must be canonical and satisfy invoice
acknowledgement <= variance <= reconciliation <= evaluation, with reconciliation
at most 24 hours after acknowledgement. No caller-signed assertion substitutes
for those recomputed comparisons.

Only after every additional lineage check, invoke the unchanged full cost oracle
with the matching first pair in its legacy scalar slots. All complete original
ledger/provider arrays and signed records remain unchanged. This call verifies
all original authority, prices, provider proofs, record schemas, amounts and
lineage before deriving the aggregate. Preserve its integer aggregate-before-
rounding result. Return count and correction-policy digest only on ALLOW; every
failure has a fixed reason, zero effects and no amount payload.

This candidate is not imported by production routes. It neither edits the frozen
oracle nor claims to fix R5-001/002/003. Independent review, exact complete-package
binding and protected incorporation are required for formal closure.
