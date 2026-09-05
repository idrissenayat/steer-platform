# Development acceptance

- PKCE challenge matches a private verifier; state/nonce/browser values differ.
- Expired, duplicate, wrong-browser and wrong-issuer callbacks never exchange.
- Replayed concurrent callbacks can exchange at most once.
- Invalid ID token, access token, subject pairing or agent identity cannot create
  a human session. Response-size bounds are enforced on actual streamed bytes.
- Browser output contains only opaque cookies/expiry, never provider tokens.
- Current revocation, tenant changes, expiry and logout deny session reuse.
- Invalid origins/configuration/store/provider failures deny safely.
- Existing API default-deny and production package boundaries remain unchanged.
