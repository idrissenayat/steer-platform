# Explicit local HTTPS identity runtime

The API composition root now exports startLocalIdentityRuntime. It connects
the real identity runtime, native SSR gateway and owned loopback HTTPS listener.
It is opt-in application code, not an environment loader or a change to
pnpm dev:api. The default server still has no login binding and remains unready.

## Inputs and ownership

| Input | Contract |
| --- | --- |
| Public profile | version: steer-local-identity/v1; identity: existing steer-identity-runtime/v1 profile; rendererOrigin: explicit-port HTTP 127.0.0.1 origin |
| Secrets, never Git/logs | identity: existing identity secret object; tls: supplied key/cert strings |
| Returned handle | shutdown() and content-free listener/identity/database status |

The application origin is derived from identity.browser.redirectUri, avoiding a
second independent origin setting. The listener requires HTTPS localhost or
127.0.0.1, with an explicit nondefault port, and binds only IPv4 loopback.
Configure the separately supervised Next.js process with the same public
origin/issuer view flags. The gateway forwards no browser credentials to it.

The caller must provide approved secret values through an appropriate trusted
provider. This increment implements no file/environment loading and accesses no
existing secret file. It does not provision Keycloak, issue real memberships or
start a renderer/production container. Tests use generated isolated credentials.

## Transport and lifecycle

The production-source listener uses node:https only in its exact transport file;
package-boundary tests reject that builtin elsewhere. It requires TLS 1.2+ and
supplied valid key/cert material. Client certificate validation must remain on.
TLS handshake/header deadlines are 5 seconds, request deadline 10 seconds,
keepalive 5 seconds, raw headers at most 16 KiB, connections 128 and requests per
socket 100. Header count is not silently truncated. Canonical Host/origin is
checked before dispatch; forwarding headers cannot select the public origin.
Gateway admission and renderer limits are still applied separately.

shutdown() closes application admission and the listener, starts the owned
identity-resource shutdown once, and waits for actual requests, resource cleanup
and transport close. After 5 seconds it closes owned connections and records
forcedConnections. It does not report stopped just because that timer elapsed:
work that ignores cancellation still keeps shutdown pending. Resource failure
stays failed and returns a generic error. A supervisor must handle permanently
stuck work; this function neither kills the process nor claims a universal OS
deadline. It installs no SIGINT/SIGTERM handlers.

Startup validation, TLS or port binding failure cleans the supplied owned
application. It does not close an unrelated process occupying a requested port.
A returned running/listening status is not health readiness; the current identity
runtime still returns 503 for /health/ready.

## Verified scope

Tests create temporary TLS keys with owner-only access and trust only their
generated certificate, never disable global TLS validation. Actual sockets
exercise Host rejection, certificate failure, header/TLS stalls, bind collision,
normal drain, resource failure and forced disconnect with work still pending.
The explicit full local bootstrap uses real lazy Git/data/session composition,
a synthetic renderer and blocked provider transports.

The browser suite now uses this production-source application listener alongside
actual Next.js, Keycloak, synthetic Git authority and encrypted PostgreSQL.
Attacker/bad-certificate test servers remain test-only. Listener shutdown is also
observed as a refused subsequent browser connection.

Run pnpm test:auth:browser, then pnpm check; do not overlap Next.js builds.
Evidence and development acceptance: intent/0028/. Remaining: real approved
secret-provider configuration, renderer/process supervision, public ingress,
authenticated workspace UI, full stack walking skeleton and applicable gates.

