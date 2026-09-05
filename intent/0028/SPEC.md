# Local runtime contract

Add startLocalIdentityRuntime in the existing API composition root. Accept a
strict steer-local-identity/v1 profile containing the existing identity profile
and rendererOrigin. Accept secrets separately as identity secrets plus TLS
key/cert strings. Derive the public origin from the validated identity callback;
compose the real lazy identity runtime, native gateway and HTTPS listener.
No implicit environment/files, secret provider or default CLI activation.

The listener accepts exact HTTPS localhost/127.0.0.1 with an explicit nondefault
port and binds only 127.0.0.1. It never selects authority from forwarding headers
or accepts an alternate Host origin. Require supplied valid TLS key/cert; TLS
1.2 minimum, handshake/header deadlines 5 seconds, request deadline 10 seconds,
keepalive 5 seconds, parser headers 16 KiB, 128 connections and 100 requests per
socket. Disable silent header-count truncation. Existing gateway admission/body/
renderer limits remain separate and intact.

The transport owns only the supplied application's shutdown and its listener,
not the renderer process, signal handlers or external services. Closing must
immediately deny application dispatch and stop listener admission, invoke owned
resource shutdown once, and await actual requests, resources and socket close.
After 5 seconds force-close owned connections. Record that event, but do not
claim stopped while application work or cleanup remains unsettled. Repeated
shutdown shares one promise. Resource/transport failure stays failed and generic;
no automatic retry. Invalid TLS or bind collision cleans the owned application
without closing unrelated listeners. Startup errors do not expose secret values.

Allow node:https only in src/identity-listener.ts with an exact-file regression
guard. No new package/version, vendor SDK in a route or signed architecture edit.

Verify actual TLS trust, wrong Host, parser/header/handshake limits, bind failure,
drain/failure/idempotence and real socket cancellation. Verify the full runtime
with synthetic TLS and a blocked provider transport, then run the actual Next.js/
Keycloak/Git/Postgres browser suite through the production-source listener.

Real secret-provider loading, configured membership, public TLS/ingress,
authenticated workspace UI, manual accessibility, remaining stack components
and formal approvals remain separate. Running/listening does not mean ready.

