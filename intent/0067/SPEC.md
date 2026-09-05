# Specification

## Trusted composition and immutable metadata

`createAccessibilityTimeVerifier(contextBytes)` accepts exactly canonical
`{version: "steer-audit-clock/v1", evaluatedAt}` from trusted composition per
audit. No implicit clock, metadata evaluation override or request-selected
registry. 0058 supplies key/domain verification at explicit record/evaluation
times against the pinned synthetic registry.

`verify(serialized, rows)` accepts a closed canonical envelope with version
`steer-accessibility-time/v1`, policyDigest and metadataBytes. Metadata contains
exactly the original manifestBytes and six signed fields: summaryBytes,
identityBytes, qualificationBytes, assignmentBytes, batchProofBytes and
providerProofBytes. Signed bytes are never rewritten. The exact original
manifest and all original semantic/schema checks remain mandatory.

The row iterator is a trusted in-process integration seam for retrieved immutable
rows, not a serialized tool callback. This increment has no file/object-store or
async network ingestion adapter. Composition must provide bounded iterator steps;
the verifier cannot interrupt a malicious synchronous iterator that never returns.

## Time and authority graph

| Record | Domain | Verification time |
|---|---|---|
| Summary | summary | signedAt |
| Identity | provider | verifiedAt |
| Qualification | provider | provider proof recordedAt, observed-as-of |
| Assignment | assignment | provider proof recordedAt, observed-as-of |
| Batch | summary | sealedAt |
| Provider proof | human-provider | recordedAt |

Require identity.verifiedAt <= summary.signedAt <= batch.sealedAt <=
provider.recordedAt <= evaluatedAt. Every key is also valid at evaluation. The
human-provider anchor must be distinct from the five other evidence anchors.

Before consuming rows, prove the provider's exact summary/batch/assignment digest
references, summary identity/qualification/assignment references and manifest
digest, and batch manifest/assignment/count/raw-digest bindings. This existing
provider proof supplies independent transitive observation; no new self-signed
observation is invented. Original closed record schemas, reviewer identity,
credential/status/hat, target/revision and other binding checks remain mandatory.

Qualification and assignment have validity intervals but no issuance fields.
Their observed-as-of basis is the independent provider proof time, not validFrom
misrepresented as issuance. Both must be valid at summary and current evaluation.
This legacy interpretation remains subject to independent review.

## Complete bounded raw evidence

For each original canonical row require identity verification <= startedAt <
endedAt <= summary.signedAt. Qualification and assignment validFrom must be at or
before row start, with row end strictly before validThrough. Yield the original
row bytes to the old matrix checker. Do not normalize or regenerate them.

The original manifest determines 32,900 raw rows and 2,664,900 checkpoint keys.
Every actual row still passes full environment/surface/state/scenario/viewport,
checkpoint, applicability, operator, evidence byte/digest and duplicate-key
checks. The old oracle recomputes rawRowsDigest, counts and outcome; a correct
signed summary cannot replace missing rows or hide all-not-applicable evidence.

Limits: 262,144 outer UTF-16 characters, 131,072 metadata, 16,384 each signed
record or raw row, at most 32,900 raw rows and 536,870,912 total raw characters.
Rows are streamed once through the composed verifier; the old full-key uniqueness
set remains in memory. This is bounded but not a production-scale streaming or
process-isolated ingestion service. Async iterators are rejected. Iteration
errors, limits and early failure become fixed errors without raw evidence echo;
normal iterator return/finally cleanup is preserved.

Success returns the original valid/count/digest result plus timing counts,
rawRowCount, policy/evaluation metadata, zero effects, executionAuthorized false
and manualAuditComplete false. This expressly does not certify a real audit.
All failures return valid false, ACCESSIBILITY_TIME_INVALID, zero count/null
digest, zero effects and both authority/completion flags false.

## Public timing inventory

PUBLIC-ORACLE-TIMING.json pins the preserved semantic-oracle source hash and
enumerates all ten signature-consuming public functions with actual successor
exports and regression suites. It separately records two unsigned text helpers,
two retired fixture factories and the historical primitive/constant reexports.
AST tests require exact function/reexport membership and existing successor/test
symbols. Production-source checks prohibit direct frozen/candidate references.

This is source/symbol coverage, not a proof that every behavioral path is correct.
The old frozen functions and primitives retain their earlier behavior for review
reproduction; no production route may use them as authorization. Explicit clocks
in every candidate must still be supplied by trusted runtime composition.

Remaining: full lifecycle retention/compound/reference/parent/future-key matrix,
actual migration compatibility/concurrency/checkpoint coverage, complete normative
inventory, legacy issuance/currentness review, real integration and qualified
manual accessibility evidence, independent review/protected incorporation and
gates. All five R5 findings remain formally open.
