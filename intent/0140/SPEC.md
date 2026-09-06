# Spec — Common completion-time signer validity

## Actual reader evidence

Every successful `createGitProviderProofReader` observation includes a frozen
`currentEvidenceValidity` with `evaluatedAt`, `validBefore` and
`sourceRevalidationRequired: true`. The bound describes only evidence verified by
the selected mode; it does not upgrade provider-only verification into human or
specialist verification.

Compute `validBefore` from the earliest applicable verified source boundary:

- Provider, identity and qualification trust-key `notAfter` and non-null `revokedAt`.
- The current verified human role grant's `expiresAt`.
- The verified qualification's `validThrough` and non-null `revokedAt`.

Historical grant expiry and historical authentication-session expiry are not
current-use bounds. Those documents must still cover their required historical
events. Natural login expiry after signing does not invalidate that history.

Validate the reader's final evaluation strictly before its earliest bound. Preserve
the exact UTC text and nanosecond comparisons; do not round through `Date.parse`.
The system clock still has millisecond precision; exact comparison does not claim
a nanosecond-precision clock. Existing source, signature, role and service checks
remain mandatory and unchanged in meaning.

## Whole signer set

After every actual signer verifier and final canonical source/artifact recollection,
sample one completion instant. Reject if any observation was evaluated after it or
has reached its exclusive bound. Return the earliest bound with that shared instant
in a frozen `currentEvidenceValidity` object.

One signer cannot extend another's expiry or scheduled revocation. This works for
approved, send-back and declined collection; no decision is upgraded. Strict input
continues to accept only the existing revision/digest, not caller-supplied windows.

## Not an authority lease

The bounds refer to pinned source observations. An unobserved later revocation,
head change or authorization change still requires actual current-source checks.
`currentSignerRevalidationRequired`, `policyVerificationRequired`, `gateVerified:
false` and `writeAuthorized: false` remain. The writer authority schema must reject
this result. Gate policy, prerequisites, Critic/domain/build sources, governed pins,
real approved attestor bindings and commercial compatibility remain unfinished.

Existing monotonic deadlines, earliest service expiry, single-flight ownership,
closed admission on failed collection and draining shutdown must keep passing.
