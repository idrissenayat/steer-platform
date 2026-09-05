# Assembled authentication harness

Add explicit `pnpm test:auth:integration`, separate from ordinary unit tests and
the provider-only harness. Require both pinned images locally; never substitute
a real connection string, provider realm or stored secret on failure.

1. Reuse the isolated Keycloak provider profile, actual synthetic password-form
   driver and code-exchange cases from 0017.
2. Start a uniquely named/labeled loopback PostgreSQL 16.14 container with tmpfs
   data and a 512 MiB memory ceiling. Generate a disposable password and 32-byte
   encryption key in the harness. Provision the three non-elevated runtime roles
   and apply the existing four migrations. No migrations run outside this DB.
3. Construct `createPostgresBrowserSessionStore` with the exact broker identity
   binding. Every reconstructed store uses a separate `steer_auth_runtime` pool
   and the same synthetic keyring. No Map fallback is allowed in durable mode.
4. Start login on one app instance, reconstruct another app/store, and race the
   same real provider callback through both. Require statuses 303/400 and exactly
   one provider token exchange. Confirm the consumed transaction is absent and
   only one session exists.
5. Inspect stored envelope format and confirm the actual provider access token,
   subject and organization are not plaintext in the stored JSON. Verify the
   session through the production store, not a parallel in-memory authority.
6. A wrong-key app/store must deny with 401; a newly constructed correct-key
   instance must recover the session. Reuse the same fresh-grant/tenant cases.
7. Logout through the current app must delete the durable session and deny calls
   from both the original and reconstructed instances. Preserve real bad-PKCE
   and bad-client-secret tests. Fault injection consumes/reinserts only synthetic
   login transactions through the store contract.
8. Close all harness-owned pools and clean up only exact verified container IDs
   and temporary TLS/realm files. Keep credentials/claims/callbacks out of logs.

Provider-only mode keeps an explicit test-only Map harness and its original
twelve checks. Durable mode adds the reconstruction/wrong-key/ciphertext check
and strengthens the existing callback/logout cases. New data/PG/Drizzle imports
are test/dev dependencies only; production package-layer rules remain intact.
The import guard also rejects relative production imports of the package's own
test directory, preventing accidental reuse of the Map/grant fixtures.

This test uses Hono requests in-process and a scoped HTTPS provider form driver,
not a browser engine or a public TLS ingress. Reconstruction means new app/store
objects and pools, not an OS-process restart (cross-process store behavior was
separately verified in 0015). Grant records remain synthetic; no real Git-backed
membership, browser cookie policy, deployment or gate evidence is implied.
