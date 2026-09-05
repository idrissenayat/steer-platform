# Browser route contract

- Explicit `createBrowserApi` composition accepts the confidential broker
  configuration and injected trusted store/grant resolver. Default CLI is
  unchanged. The callback path is fixed at `/auth/callback` on configured HTTPS.
- Every request uses that exact canonical origin. Ignore forwarded headers;
  trusted ingress must preserve the correct HTTPS request URL. Do not derive
  trust from arbitrary Host/X-Forwarded-* values or relax HTTPS for tests.
- POST `/auth/login` and POST `/auth/logout` require the exact Origin, plus
  `Sec-Fetch-Site: same-origin` when supplied. Reject missing/null/foreign Origin,
  same-site sibling origins, query parameters, Authorization headers and actual
  nonempty bodies. Wrong methods, including HEAD/OPTIONS, must not change state.
- Login responds 303 to the broker's fixed authorization endpoint with PKCE and
  browser-bound state. Only its secure HttpOnly host-only login cookie is set.
- GET `/auth/callback` permits the expected cross-site top-level navigation;
  security comes from the one-use state/browser cookie, PKCE, issuer/nonce and
  token/grant verification. All query validation stays in the broker. Success
  sets separate login-clear/session cookies and redirects 303 to the fixed app
  root. Error clears only the login cookie and returns a generic error, never
  echoing provider descriptions, codes, tokens or exception text.
- Logout deletes the server session before clearing cookies and returning the
  same fixed root redirect. Failure does not claim server revocation succeeded.
  This is local logout, not provider-wide logout or refresh-token revocation.
- Cookie-authenticated tool POSTs require the same Origin/Fetch-Metadata checks
  and fresh broker authentication before the existing typed/granted registry.
  Bearer-only calls retain normalized OIDC verification. Mixed session-cookie
  and Authorization credentials deny; never fall back from an invalid session.
- No CORS grant. Every response is no-store/no-cache with no-referrer and a
  restrictive API Content Security Policy. No HTML, script or callback payload
  reflection. Cookies never enter JSON. No configurable user return URL.
- No access/request logging is added. Future ingress, tracing and analytics must
  redact callback queries and cookies, not merely rely on browser response headers.
- Composed OpenAPI adds auth routes, cookies and conditional Origin requirements
  while reusing every tool schema from the shared registry. The default API
  document remains bearer-only; no client secret or provider token is documented.

This increment verifies HTTP contracts with synthetic RSA-signed token responses
and test-only in-memory stores. 0015 separately verifies real encrypted Postgres.
It does not prove browser cookie behavior or a real Keycloak human-code flow.
Public route activation also requires approved secrets, database/grant wiring
and ingress resource/rate limits. No service is deployed by these changes.

References: [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html),
[OAuth security BCP](https://www.rfc-editor.org/rfc/rfc9700.html),
[Hono response headers](https://hono.dev/docs/api/context).
