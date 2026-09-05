# Identity service composition and lifecycle

`apps/api/src/identity-service.ts` composes the verified Git-backed browser API
with explicitly owned session resources. Pass fixed browser/reader/path settings
and a managed resource containing the store, exact issuer/client/callback binding,
and an awaitable shutdown function. Binding mismatch fails construction.

The service layer deliberately does not import `@steer/data` or read configuration
from the environment. The dedicated `runtime.ts` composition root now assembles
actual resources from explicit profile/secret inputs; see
`IDENTITY-RUNTIME-BOOTSTRAP.md`. Listener/TLS configuration and secret loading
remain separate work; the loopback harness supplies synthetic owned resources.
Do not use the test-owned memory store or Git fixture as a runtime fallback.

| State | Meaning |
| --- | --- |
| running | Accepts requests through existing auth/admission checks; readiness remains 503 |
| draining | Rejects new requests; waits for admitted handlers and resource cleanup |
| stopped | Both request work and managed cleanup finished successfully |
| failed | Cleanup failed; requests stay closed; no automatic retry |

`status()` exposes only state and active-handler count to trusted operational
wiring, not a public endpoint. `shutdown()` is idempotent and shares actual
completion. It closes admission immediately and begins owned resource shutdown;
current requests that need a new resource lease can fail closed. A resource's
five-second pool grace does not give the service a universal five-second deadline.
The service does not report stopped while an admitted handler is still pending.
External supervision must detect/report a genuinely stalled drain, not turn it
into invented success. Streaming response lifetimes are not covered yet.

The Chromium test uses real Keycloak, Git-derived synthetic memberships and
encrypted PostgreSQL through this factory. Reconstructed service objects share
one test-owned resource lifetime and are all stopped at the end. Runtime pools
close while the separate test/admin inspector verifies zero auth rows; then the
harness removes its owned containers and generated files. This is not a real
deployment, user session, TLS/ingress approval or production UI acceptance.

Evidence: `intent/0024/EVIDENCE.md`. Related limits: `API-RESOURCE-LIMITS.md` and
`DATABASE-RUNTIME-LIMITS.md`. Gates, real bindings and spending remain separate.
