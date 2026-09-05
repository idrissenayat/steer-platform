# Development checks, before implementation

These are Builder regression criteria, not a protected independent EXAM.

1. A generated RSA access token resolves a bounded principal and succeeds
   through the real Hono context route.
2. Wrong signature/key/issuer/audience/client, ID token, missing required
   claims, expired/future/overlong lifetime and unsupported algorithms deny.
3. Missing, disabled, stale, cross-tenant, wrong-subject/issuer/kind and
   revoked grants deny on the next request even if the token remains valid.
4. Token role/grant injection cannot expand current authority; agents cannot
   become human signers. Effective expiry cannot outlive either source.
5. Only the configured HTTPS JWKS URL is fetched, redirects are rejected,
   cached keys work and unknown keys fail. Remote failures disclose no claims.
6. Invalid configuration and malformed/oversized headers fail closed.
7. Root checks include this adapter, without real credentials or providers.
