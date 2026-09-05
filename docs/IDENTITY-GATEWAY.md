# Native identity gateway

`apps/api/src/identity-gateway.ts` owns the reusable native SSR routing/security
policy previously implemented only in the browser harness. It accepts trusted
`publicOrigin`, `rendererOrigin`, `issuer` and an identity service with `fetch`.
Use the same public origin/issuer as the identity runtime and Next.js public
view profile. The composition owner must keep those bindings consistent; the
gateway cannot inspect an opaque supplied identity handler's configuration.

The public origin must be exact HTTPS. Rendering uses only an explicit-port
HTTP 127.0.0.1 origin, so Next.js stays behind the gateway. Do not expose that
renderer port or give it identity/database/GitHub secrets. The gateway does not
start either process, load profiles/secrets or establish TLS.

## Routing and isolation

- /auth/, /v1/, /health/ and /openapi.json go to the identity service unchanged.
- GET / and allowlisted /_next/static/ assets go to the fixed renderer.
- Page/asset queries, other paths and non-GET rendering are rejected.
- Anonymous/static renderer requests carry only a constructed Accept header.
  Increment 0029 adds a strict, verified session display header for signed-in root
  rendering only; browser-supplied versions of that header are discarded. Browser cookies,
  bearer/Host/forwarded/referrer headers, query strings and bodies never cross.
- Redirects, non-200 upstream status, wrong MIME and failed responses produce
  generic errors; renderer response cookies and arbitrary headers are discarded.

All gateway requests use existing global admission limits (32 concurrent, burst
120, refill 2/sec, URL/header bounds). Auth delegation retains its own limits.
Rendering buffers at most 1 MiB/16,384 chunks and has a five-second native-fetch
abort deadline covering headers/body. Client abort also cancels rendering.
The reader checks monotonic time to prevent immediate-chunk timer starvation.
Cancellation is verified against real Node HTTP sockets; it is not a claim about
an arbitrary transport that ignores AbortSignal or a universal process deadline.

Successful rendered responses are no-store/nosniff, use same-origin referrers
and disallow scripts. CSP permits self CSS/connect and self plus the exact issuer
origin for forms. Identity responses are untouched, including the callback's
no-referrer policy. This preserves native POST Origin while preventing the
authorization callback URL from leaking into root navigation.

## Verification and remaining composition

The browser harness now uses this production-source gateway with actual Next.js;
its renderer helper only owns process startup/shutdown. Run
`pnpm test:auth:browser` without another concurrent Next.js build. API unit tests
include a real owned HTTP renderer for stalled headers/body, disconnect,
credential isolation and redirect rejection.

This factory is not a complete production server. Trusted profile/secret loading,
public TLS/ingress and socket supervision remain separate. The outer listener
must stop admission and coordinate gateway requests, identity resources and the
renderer process; the gateway does not own those dependencies or claim readiness.
Default CLI startup remains closed/unconfigured. No hydration/nonces, SSE,
authenticated workspace, real membership or gate acceptance is implied.

Development artifacts and verification: `intent/0027/`.

Increment 0028 now supplies the explicit local listener/profile/lifecycle
composition described above, without activating public ingress or real secrets.
The browser suite uses both production-source gateway and HTTPS listener.
See `docs/LOCAL-IDENTITY-RUNTIME.md`; external renderer/process supervision and
real secret-provider loading remain separate.

The current authenticated display boundary, privacy/logging rules and refresh
semantics are documented in `docs/AUTHENTICATED-WORKSPACE.md`. This projection
does not grant authority, send credentials to Next.js or enable real user access.
