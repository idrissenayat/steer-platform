# Development evidence

Baseline `1b5be97`. Verified 2026-09-05 UTC under Node 24.20.0.

## Results

- Eleven new adapter tests pass, bringing adapter tests to 36. They cover
  browser/state/nonce separation, confidential S256 exchange, concurrent replay,
  callback and issuer restrictions, ID/access-token pairing and signature,
  human/agent distinction, fresh grants, session expiry/deletion races, logout,
  duplicate cookies, storage errors and actual streamed response-size limits.
- Root `pnpm check` passed under the isolated pinned Node runtime. Changed
  adapter/API typechecks and tests executed uncached; unchanged package checks
  reused prior verified cache entries. Prototype tests/build and 20 control/
  dependency checks passed. No browser UI was modified or visually revalidated.
- No real provider, credential, principal, realm or Git record was used in
  these tests. Provider tokens are signed synthetic fixtures. The fixture
  memory maps are test-only; there is no default production memory store.

## Integration contract and remaining work

The storage driver must enforce atomic consume across processes, TTL, capacity,
and encryption/access controls for stored provider credentials. Session records
are short-lived authentication state, not authoritative business/Git records.
The complete adapter output is suitable only for server use: route handlers
must emit cookies as Set-Cookie and never serialize the server store.

HTTP routes, persistent storage, browser/client registration and real human
authorization-code evidence are still missing. Start/logout must be same-origin
POST routes; callbacks must be GET with response-query handling, no-store and
no-referrer, clear transient cookies on errors, and rate limiting. Cookie-based
tool mutations must enforce Origin/CSRF independently of bearer-only APIs.

This increment intentionally requests no offline access and retains no refresh
token. Sessions expire within the shortest validated ID/access/grant lifetime,
never more than five minutes; reauthentication is required. Refresh rotation,
provider-wide logout and prolonged sessions need their own verified increment.
The default API remains deny-all and readiness remains 503. Gate 2's five R5
findings and all independent review/signature requirements remain open.

References: [OAuth security BCP](https://www.rfc-editor.org/rfc/rfc9700.html),
[OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html).
