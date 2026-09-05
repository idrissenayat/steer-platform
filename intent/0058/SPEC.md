# Spec: Full-bound human authority and explicit verification times

## Shared verifier

createTimedRecordVerifier accepts a canonical independently supplied trusted
registry at composition time, never from a request. Validate its closed shape,
unique domain/key/algorithm selectors, Ed25519 public keys, valid half-open key
windows and optional revocation times. Copy it into a private snapshot. A new
trusted snapshot must be installed when revocation changes; this offline helper
does not claim a live revocation subscription.

verifyBytes requires explicit domain, recordedAt and evaluatedAt with no defaults.
Require recordedAt <= evaluatedAt, and key activation/expiry/revocation eligibility
at both instants. Verify the canonical record preimage, digest, strict signature
metadata/canonical base64 and actual Ed25519 signature. Return the record and the
independently selected public-key digest; errors are fixed and content-free.
Registry and record limits are 65,536 UTF-16 code units; at most 128 anchors.

The caller must derive the record timestamp from the appropriate signed field,
not a separate user claim. Evaluation time comes from the trusted decision
service; the offline tests explicitly supply it. Neither helper authorizes an
effect. No network, real key, provider call or implicit wall-clock fallback.

## Human successor

Require a closed canonical envelope with version, exact correction policy digest
and bundleBytes, bounded to 1,048,576 UTF-16 code units. Require the original 12
closed bundle fields and at most 65,536 units per field. The existing closed
HUMAN-AUTHORITY shape is retained; the outer successor policy identifies the new
proof semantics. Bare legacy input or an old partial provider proof cannot pass.

Provider authorityBindingDigest is SHA-256 of the complete canonical authority
payload excluding only providerProofDigest, recordDigest and signature, which
would otherwise be circular. It includes session/authentication, all evidence,
policies/targets, anchor, holds/references, sequence, terminal event, idempotency
and CAS fields. No hand-maintained subset of positive fields.

Verify authority at decidedAt/evaluationTime, provider proof at its recordedAt/
evaluationTime. Require provider recordedAt == authority decidedAt; validate the
closed provider record, identity/decision/reference binding and provider proof
digest. Compare authority.providerTrustAnchorDigest against the independently
selected registry key digest. Authority cannot select a public key or registry.

Supporting proof timestamps: identity verifiedAt, inventory capturedAt, replay/
head snapshotAt, reservation recordedAt. Qualification and assignment records
lack issue timestamps in the frozen contract: verify their signatures as of
decidedAt and evaluationTime and retain their explicit validity-through checks.
Do not fabricate issue times or claim a broader validity proof.

Retain all identity, qualification, hat, target, policy, inventory, replay and CAS
cross-record checks. Also enforce canonical times, authority validFrom <= decidedAt,
identity verification <= authenticatedAt, inventory capture <= decidedAt and a
positive safe-integer CAS sequence. Output only zero-effect candidate ALLOW/DENY,
fixed errors, consumed reference IDs and policy digest, never source payloads.

## Boundary

This candidate is not a production route. All old public oracles in the frozen
directory stay unchanged for traceability. The remaining corrected public entry
points must adopt the no-default-time verifier before R5-002 can be presented as
a complete correction. R5-001/003 and independent/protected review also remain.
