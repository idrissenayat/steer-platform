# Spec

Add an explicit `pnpm test:destination:integration` command, separate from ordinary
unit checks because it requires Docker and a pre-existing immutable test image.
Reuse the disposable authentication PostgreSQL harness, verify PostgreSQL major 16,
apply existing migrations, and retain dedicated least-privilege runtime/session
roles. Do not use an external database or change migrations/schema policy.

The harness may create actual `createIdentityRuntime` instances with its own
database/encryption credentials and an explicit destination path configuration.
Callers must supply both provider transports; never fall back to real providers.
Track these instances for cleanup and drain all before disposing shared test data.
Use the verified local image ID matching the existing pin with `--pull=never` and
verify that exact ID before launch. No floating tag, automatic pull or replacement
image is admitted. Local image acquisition remains an explicit prerequisite.

Exercise these consecutive phases in one isolated flow:

1. Construct the real runtime lazily without provider requests or SQL connections.
2. Start login, store the transaction in PostgreSQL, stop and recreate the runtime.
3. Complete the callback with actual RS256 token verification and the original
   transaction; reject callback replay without another token exchange.
4. Confirm stored session values are encrypted and do not contain plaintext token,
   subject or organization values.
5. Read the destination using the resulting cookie through the actual GitHub reader.
6. Reconstruct the runtime again, advance native Git and observe the new head using
   the same persisted session, without a projection/read-model binding.
7. Deny caller-selected branches, foreign tenants/origins, removed tool grants and
   revoked membership; restoring a removed grant must be read from current Git.
8. Log out, confirm database removal, reconstruct again and reject the deleted cookie.

Generate synthetic issuer and GitHub App keys. Verify actual runtime-generated App
JWTs at the synthetic transport boundary before mapping to the existing fixture
sentinel. Assert read-only token permissions, zero write mutations/authority calls,
and unchanged closed readiness. Simulated provider HTTP, callback and cookie jar
are not actual Keycloak, browser security policy or live GitHub evidence.
