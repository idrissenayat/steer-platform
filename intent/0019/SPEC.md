# Browser verification contract

## Isolated setup

Add explicit `pnpm test:auth:browser`. Launch the matched Chromium from pinned
Playwright 1.62.1, selected within the existing dependency-age policy. No policy
exemption or new production dependency is permitted.

Use a temporary browser profile, headless mode, enabled Chromium sandbox,
`ignoreHTTPSErrors=false` and no blanket certificate-error bypass. Local HTTPS
uses a generated short-lived self-signed certificate: limit the browser's
test-only certificate exception to that certificate's exact SPKI hash. Verify
an unrelated generated self-signed certificate is rejected. This is scoped
test-exception behavior, not evidence of a publicly trusted certificate chain.
No OS/keychain/browser trust settings are modified.

Serve the test application at `https://localhost:<random-port>` and Keycloak
at `https://127.0.0.1:<random-port>` to exercise distinct schemeful sites. Bind
all services to loopback. Register the actual callback origin exactly in the
synthetic client before Keycloak starts. Browser requests are allowlisted to
the specific application, issuer, cross-site test server and negative TLS server.

The app uses real Node HTTPS, Hono request adaptation, production browser routes
and the production encrypted session store. Only the small form page and grant
resolver are fixtures. Test forms have no app script and web storage is unused.
The sign-in page's CSP `form-action` must permit both self and the exact configured
IdP origin: Chromium applies the form policy to the redirect as well. Do not use
a wildcard. The callback's no-referrer policy must prevent its query from becoming
the referrer on the final root navigation.
No trace/video/HAR/screenshot or callback/credential logging is introduced.

## Browser checks

1. The generated-key test origin loads; an unrelated certificate fails.
2. Native POST login navigates to the real Keycloak page. Filling its synthetic
   username/password and submitting returns through the actual callback. The
   browser sends the login cookie on cross-site top-level GET, and the granted
   session-context tool returns the expected human subject/hats.
3. The only STEER cookie after login is an opaque `__Host-steer-session` with
   Secure, HttpOnly, host-only localhost, Path=/, SameSite=Lax and bounded expiry.
   JavaScript cannot see it; localStorage/sessionStorage contain no token/state.
   Database ciphertext inspection remains mandatory.
4. A native form from the cross-site test origin submits logout. Chromium must
   omit the Lax session cookie and STEER must return 403 for foreign Origin.
   The existing durable session remains usable from the application origin.
5. Reconstructing the app/store keeps the browser session valid. Fresh grant
   revocation returns 401 and restoration returns 200 through actual browser fetch.
6. Navigating to a consumed callback fails generically without replacing or
   destroying the valid session.
7. Native same-origin logout redirects to the fixed root, clears STEER cookies,
   deletes the durable session and leaves browser tool calls unauthenticated.

## Limits and cleanup

Only the pinned Chromium engine is covered, not Firefox, WebKit or Safari.
No real user, Git-derived membership, production Next.js screen, public ingress,
manual accessibility review or provider-wide logout is claimed. Runtime/public
activation remains closed pending the remaining configuration and gate work.

Close the browser and test HTTPS servers, then owned pools, labeled containers
and temporary TLS/realm files. Standard downloaded Playwright browser binaries
may remain in its cache; they contain no test credentials or user profile.

References: [Playwright browser launch](https://playwright.dev/docs/api/class-browsertype),
[Chromium scoped SPKI exception](https://chromium.googlesource.com/chromium/src/+/8402d3c5bc13e018fa75eba650ed881755e0223b),
[Hono Node adapter](https://hono.dev/docs/getting-started/nodejs).
