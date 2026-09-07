# Spec

Extend the optional 0187 authorization profile with `identity`, containing distinct
trust/proof path+digest references, `sessionId` and `authenticatedAt`. The selection
receipt and independent expectation bind all four fields atomically:
`selectorSessionId`, `selectorAuthenticatedAt`, `selectorIdentityDigest` and
`selectorIdentityTrustDigest`. A partial receipt, absent expected field or downgrade
to grant-only configuration denies. Existing profiles without identity remain valid
as weaker evidence, not as complete authority.

An internal verify-only `steer-selector-identity-{trust,attestation,proof}/v1`
Ed25519 profile uses its own NUL-terminated signature domain. Closed schema-ordered
compact UTF-8 JSON, exact independent pins, bounded bytes and exact organization,
repository, branch, issuer, actor kind, subject, session and authentication time are
required. Explicit scoped agents are supported without changing the existing
human-only gate identity verifier. No tokens, hats or gate approval fields are accepted.

Authentication precedes selection and identity recording; session expiry is exclusive
for both events. Selection and identity records must precede selection recording,
which cannot be in the future. Current identity-key expiry/revocation is mandatory;
natural historical session expiry after selection is not current key revocation.
All time comparisons retain nanoseconds. Trust ownership remains externally governed.

Collect both identity sources through current exact-head Git reads with the same
observer, hash/blob, deadline, byte-budget and shutdown checks. Source roles cannot
alias grants, manifest, proof/trust, policy, human membership or save paths. Recheck
identity-key validity after all later policy reads. Retain immutable internal
evidence only; no session claims enter held runtime diagnostics or HTTP errors.

An integrated held HTTP journey must reach policy-satisfied facts, still deny saving,
create no Git artifact/operation, discard stale assessment after grant revocation,
and deny a reconstructed runtime using coherently repinned revoked identity trust.
All three held-authority gaps and five R5 findings remain open.
