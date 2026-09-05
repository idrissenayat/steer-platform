# Service lifecycle contract

`createIdentityService` accepts fixed browser configuration, trusted reader/path,
optional provider transport/clock, and managed session resources. Their issuer,
client ID and redirect URI must exactly match the browser configuration before
construction. A resource provides the existing store contract and an owned,
awaitable shutdown operation. Capture the configured shutdown function/store;
do not resolve resource ownership from requests or token claims.

Compose `createGitBackedBrowserApi`; preserve its global admission/body bounds,
exact-source Git authority, OIDC and cookie policies. No new production package
dependency, environment loader, secret access, provider registration, listener
or public readiness setting is added. Default CLI remains closed to auth routes.

Internal lifecycle states: running, draining, stopped, failed. Running means the
dispatcher accepts requests, not that `/health/ready` or Phase 1 passed. Count
admitted request-handler work until actual completion; status is internal and
content-free. All requests after shutdown begins receive generic no-store 503
without dispatch or new cookies, including health routes on that stopped object.

Shutdown immediately stops service admission and invokes the managed resource's
shutdown once. Its active leases retain their own drain/eviction policy; an
admitted request needing a new resource lease during shutdown can fail closed.
Wait for BOTH all admitted handlers and resource cleanup to settle. Only then
report stopped; cleanup failure reports failed with a sanitized error. Repeated
calls share the same promise and never retry cleanup implicitly. There is no
forced promise timeout that reports success while work continues.

The caller owns resource construction and must clean up if service configuration
is rejected. The contract does not prove a caller-supplied implementation behaves
correctly; test the production pool-backed implementation separately. Current
responses are buffered; future streaming responses require a connection lifecycle.

## Verification

Unit tests cover binding mismatch, running-but-unready, denial during shutdown,
delayed resources, requests outliving resource cleanup, sanitized failed cleanup
and idempotence. The real Chromium harness must use this service for native
Keycloak login, Git membership, encrypted PostgreSQL, reconstruction and logout.
Finally stop all reconstructed service objects sharing that test-owned resource
lifetime, verify stopped/zero active requests, browser 503, no fresh runtime pool
after closure, and zero remaining synthetic auth rows. Test/admin inspection is
separate from runtime resources and remains available until harness cleanup.

No real runtime bindings, public ingress, production TLS, total request/network
deadline, production Next.js sign-in, manual accessibility, independent review
or gate acceptance is completed by this service factory.
