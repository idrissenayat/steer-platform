# Bootstrap contract

`createIdentityRuntime` takes a strict `steer-identity-runtime/v1` profile and a
separate strict secret object. Profile fields: public browser/provider endpoints,
client/audience, GitHub App ID and fixed installation/repository/branch/org/path,
database host/port/name/transport, current session key ID. Secret fields: browser
client secret, App PEM key, database password and session key bytes. Reject extra
fields, including secret-bearing fields such as clientSecret in the public profile. Downstream adapters
retain their stricter URL, role, path, key-length, TLS and binding validation.

Construct the actual App signer and restricted GitHub reader, fixed-role
`steer_auth_runtime` bounded pool, encrypted store and identity lifecycle service.
No arbitrary grant/reader/store substitution exists in the bootstrap interface.
Optional transport functions are trusted test/transport seams, never selected by
requests. Construction is lazy: no listener, provider call, database connection,
environment lookup, secret file read or remote secret fetch. A real login request
can create its encrypted pending transaction; provider navigation remains a
separate operation. No startup-ready claim or deployment authorization is implied.

If construction fails, close an allocated lazy pool before reporting a generic
configuration error. A cleanup failure gets its own generic unconfirmed-cleanup
error. Never reflect profile, PEM, password, key bytes or provider error messages.
Return only request dispatch, awaitable shutdown and content-free service/pool
status. No secret material or raw store/driver is exported from the runtime.

## Dependency decision

The signed architecture makes `apps/api` the transport application and prohibits
vendor SDKs in domain/tool-registry. Its composition root must assemble the data
adapter without putting driver dependencies into route handlers. Declare
`@steer/data` and the existing pinned Zod 4.5.4 as API production dependencies,
but permit their imports ONLY in `apps/api/src/runtime.ts`. Add exact-file boundary
tests rejecting both from routes, service logic and default server startup.
Keep pg/Drizzle behind `@steer/data`; do not modify signed architecture snapshots
or change the selected stack. No dependency-age exemption or version upgrade.

## Development proof and limits

Test strict malformed profile/secret/downstream rejection, no implicit provider
access or DB connection, readiness 503, unauthenticated tools 401 and actual
shutdown. In the disposable PostgreSQL harness, bootstrap real components with
generated secrets, POST login, observe one encrypted transaction, independently
read/consume it with the matching store/key binding, then verify stopped/zero
connections. Reject any provider network call in this bootstrap check. Continue
the existing real browser/provider/Git-fixture flow afterward.

The bootstrap check does not prove a live GitHub membership read, because its
App identity is synthetic and transport is deliberately blocked. The existing
read-only live App evidence remains separate. Secret-provider loading, trusted
listener/ingress, production TLS, real membership, public activation, production
Next.js sign-in and formal gates remain open.
