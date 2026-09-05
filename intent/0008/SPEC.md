# Development specification

- Verify RS256 access tokens against a configured HTTPS issuer and pinned HTTPS
  JWKS endpoint, exact audience and allowed client IDs. Do not discover keys
  from token headers or follow JWKS redirects.
- Require signature, subject, issuer, audience, issued-at and expiry. Enforce
  not-before, maximum token age and lifetime, future issued-at denial, and
  Keycloak access-token `typ: Bearer` (reject ID tokens).
- Normalize signed `steer_org`, `steer_kind` and `steer_hats` protocol-mapper
  claims. Raw Keycloak realm roles and token tool grants confer no authority.
- After verification, resolve current authorization from a trusted source by
  exact issuer, subject and organization. Require an active unexpired record,
  exact identity/kind binding and valid-after cutoff. Re-resolve per request.
  Missing/stale/unavailable grant sources deny. Effective hats are the
  intersection of the token and current record; tool grants come only from
  that current record. Agents may not acquire human hats.
- Principal expiry is the earliest token or authorization-record expiry.
- Missing/malformed/oversized bearer tokens and any failed validation return
  null; API emits its existing content-free 401. No token or private claim is
  logged. Invalid configuration fails startup rather than loosening checks.
- Keep the default CLI disconnected and deny-all until real provider and grant
  source composition is complete. Successful local cryptographic tests are
  not live-login evidence or a completed M2 claim.
