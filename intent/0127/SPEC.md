# Specification

## Internal context, unchanged public contract

`createOidcContextAuthenticator` retains the issuer and issuance instant from the
same RS256/JWKS verification and fresh Git grant lookup as the existing principal.
There is no second unverified decode. `createOidcAuthenticator` delegates to this
verification and returns only the principal, preserving its public shape/denials.

The internal context contains issuer, `establishedAt`, a domain-separated SHA-256
`sessionBinding`, and the current principal. For bearer access, establishment means
the verified token's `iat`; it is credential issuance, **not** provider `auth_time`,
user reauthentication or a fresh gate-review session. Token hash equality proves
the same credential, not an independent human approval. All metadata is internal.

The browser broker adds `authenticateContext` alongside its unchanged principal-only
method. It still reads the persisted opaque session, verifies the stored access
token against current grants, rereads the session and checks exact snapshot/expiry.
Browser establishment is the persisted local session's creation instant. Its binding
hash covers both the hashed opaque session key and verified token binding, so two
same-time sessions or a replaced stored token do not share a context. Reconstruction
over the same stored session preserves the binding. Credentials are never returned.

Metadata objects and principals are frozen, including principal hats/grant arrays.
HTTP session display and `session.context` responses continue to contain only their
existing selected fields. Internal hashes must not enter public views, analytics,
URLs or client storage; they are correlation values, never credentials or authority.

## Membership composition

The 0126 internal session envelope now requires the binding hash and checks it
before returning a membership observation. Its receipt includes that internal
binding. Existing same-instant switching tests are extended accordingly. This
tightens an uninstalled internal contract, not a deployed/public API or data schema.

Tests compose actual signed-token verification and the real broker directly with
the membership verifier; synthetic callback assertions are no longer the only
evidence for the composition. The bearer path additionally uses the Git grant
resolver. Source fixtures and provider transports remain isolated and synthetic.

No `BriefWriter` is installed. The eventual request-bound wrapper must retain the
existing exact-origin/CSRF, mixed-credential, request lifecycle and fresh-auth rules.
It must compose complete current Gate 2/provider/source proof and protected admission
at the expected head before any write. This increment does not implement that gate
verifier, claim qualified signers or infer fresh second-look approval from token `iat`.
