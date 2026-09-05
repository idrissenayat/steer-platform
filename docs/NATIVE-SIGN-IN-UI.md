# Native Next.js sign-in surface

The production-source landing page now contains STEER's pink/orange sign-in
surface. It is distinct from the Vite product prototype on the older preview.
The page makes no claim that the workspace or formal release gates are complete.

By default Sign in is disabled and no auth form exists. The server-side view
requires all three public, non-secret settings:

- `STEER_WEB_AUTH=enabled`
- `STEER_WEB_AUTH_ORIGIN`: exact HTTPS application origin, without path/query
- `STEER_WEB_IDENTITY_ISSUER`: fixed HTTPS identity issuer, without credentials/query

The installed Next.js 16.3.4 guidance calls for `connection()` before request-time
environment access; the page uses it instead of build-time NEXT_PUBLIC values.
No password/token/secret is passed to the renderer. These settings only enable
the view. A trusted same-origin listener and configured identity runtime remain
necessary to handle fixed `/auth/login` and `/auth/logout` POSTs.

## Form and security behavior

Native forms work without page JavaScript, send empty bodies and never choose a
return destination. Sign-out ends only the local STEER session. The page does not
infer or display a current identity without an authenticated API result.

The sign-in document should use `Referrer-Policy: same-origin` (or another
verified policy that preserves Origin). Applying `no-referrer` there caused
Chromium's native POST to present an unusable Origin and the API correctly
rejected it. Keep `no-referrer` on the code-bearing callback, and keep its fixed
root redirect. Do not weaken the API's exact-Origin/Fetch-Metadata validation.
Form CSP must allow self and the exact configured IdP destination.

## Local verification

`pnpm test:auth:browser` now builds the Next.js app before starting the isolated
test servers. Do not run another Next.js build concurrently against that output.
It starts actual production Next.js rendering on loopback; the owned HTTPS
gateway now uses the shared production-source factory from increment 0027, not
a second test-only proxy. It sends only root/static-asset requests to the renderer,
with no cookie/auth/query forwarding. Page scripts are disabled by its CSP, while the
native forms complete the real Keycloak/Git-fixture/encrypted-Postgres flow.

This verifies native SSR behavior, not client hydration, a production nonce
strategy, public ingress or future interactive components. Disabled configuration,
desktop/mobile, keyboard focus and automated axe checks are included. Optional
`STEER_UI_SCREENSHOT_DIR` captures only the pre-login page; never use it for a
credential-bearing provider screen. Reviewed snapshots: `artifacts/0026/`.

Remaining: actual local listener/profile loading, authenticated workspace/session
display, public TLS/ingress and secret approval, other browsers, manual specialist
accessibility, full workspace parity and formal gates. Evidence: `intent/0026`.
Shared routing/resource policy and newer verification: `docs/IDENTITY-GATEWAY.md`
and `intent/0027`.
Increment 0028 adds an opt-in local HTTPS runtime and moves the actual browser
flow onto its production-source listener. It does not load real secrets or
activate the default CLI. See `docs/LOCAL-IDENTITY-RUNTIME.md`.
