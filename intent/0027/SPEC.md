# Native identity gateway contract

Provide an explicit factory in API production source. Trusted composition supplies
an exact HTTPS application origin, fixed HTTPS issuer and explicit-port HTTP
127.0.0.1 renderer origin, plus the configured identity service. No environment,
file access, socket opening or implicit profile is introduced.

Check the actual request URL origin; do not use forwarding headers as authority.
Delegate only /auth/, /v1/, /health/ and /openapi.json to the identity service,
preserving the original request and response. Identity method, body, cookie,
callback, CSRF and current Git-authority checks remain there.

Render only GET / or allowlisted /_next/static/ asset paths. Reject queries and
unsupported paths/methods. Forward only the fixed origin/path and a constructed
Accept header; never cookies, bearer headers, Host, forwarded headers, referrers,
queries or bodies. Fetch with credentials omitted and redirects rejected.

Buffer at most 1 MiB and 16,384 chunks before returning. Use a five-second
AbortController deadline spanning headers/body, check monotonic time while
reading, and propagate browser aborts. Native fetch must honor cancellation;
an injected trusted test transport is subject to the same contract. This is not
a universal OS shutdown deadline. Cancel/discard incomplete bodies and sanitize
failures. Require status 200 and expected content type; do not copy upstream
Set-Cookie, Location, CORS, CSP or other arbitrary headers.

Apply no-store, nosniff, same-origin referrer policy and a script-disabled native
SSR CSP with self CSS/connect and exactly the issuer origin for form actions.
Callback/API security headers remain untouched, including callback no-referrer.
Use existing request admission limits around all routes, including rendering.

The browser fixture starts only the renderer process and real test dependencies;
it must use this gateway, not maintain a second page proxy/security policy.
No client hydration, streaming, authenticated workspace, production TLS/profile
loader or real account activation is claimed.

