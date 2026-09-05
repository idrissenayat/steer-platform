# Specification

- Confidential-client authorization code with S256 PKCE, random state/nonce and
  a distinct browser-bound login cookie; atomic one-use server transaction.
- Trusted fixed HTTPS endpoints, same issuer origin, exact callback path and
  issuer-response validation; no request-driven discovery or redirect target.
- Validate ID-token signature, issuer/audience/azp, nonce, time and optional
  access-token hash. Independently validate access-token signature/profile and
  fresh grants; require a human with the same subject as the ID token.
- Opaque host-only Secure/HttpOnly/SameSite=Lax cookies; no provider token in
  returned browser values. Server storage is injected, never browser storage.
- Sessions cannot outlive the shorter ID/access/grant lifetime (at most five
  minutes). Reauthenticate on expiry; refresh-token storage/rotation is deferred,
  not simulated. Only request openid scope and discard provider refresh tokens.
- Recheck current grants on every request and local session existence after
  asynchronous verification. Logout removes the local session with exact-origin
  protection; provider-wide single logout remains separate.
- HTTP composition must enforce methods, Origin/CSRF on state-changing routes,
  no-store/referrer protection, cookie clearing and rate limits. These routes
  and durable encrypted storage are not enabled by this adapter increment.
