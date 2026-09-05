# Explicit identity runtime bootstrap

`apps/api/src/runtime.ts` is the API composition root. It constructs the actual
GitHub signer/restricted reader, bounded authentication pool, encrypted session
store and identity service. It does not load environment variables, files,
external secrets or real account configuration, and it opens no network listener.
Default `pnpm dev:api` remains unauthenticated with no browser-login routes.

Supply two separate trusted objects:

| Input | Contents |
| --- | --- |
| Profile, version `steer-identity-runtime/v1` | public browser endpoints/client/audience; GitHub App ID, fixed org/install/repo/branch/path; DB host/port/name/transport; current session key ID |
| Secrets | browser client secret, App PEM, database password, session key bytes |

Only the profile is a candidate for version control. Never put the secret object,
real PEM, password or session key bytes in Git, logs, browser responses or test
artifacts. Runtime secret-provider loading is still separate work. The bootstrap
requires `steer_auth_runtime`; it cannot accept an administrative database role.
All existing adapter URL/key/path/transport checks still apply. Extra profile or
secret fields fail, including client secrets injected into the profile.

Construction performs validation and allocates a lazy pool but makes no provider
call or DB connection. If startup fails, it closes allocated resources; errors
are generic, and unconfirmed cleanup is distinguishable without leaking details.
Only fetch, shutdown and content-free service/database status are returned.
Running status is not health readiness, a signature or authorization to deploy.

Optional identity/GitHub transports are trusted infrastructure/test seams, not
caller-selected providers. A bootstrap integration creates and verifies an
encrypted login transaction in disposable PostgreSQL with all provider network
access blocked. That proves actual local storage composition, not a live GitHub
membership lookup. Live runtime App evidence remains in `GITHUB-RUNTIME-APP.md`.

## Architecture boundary

This implements the signed architecture's API application/data-adapter split;
it does not revise its stack or signed snapshots. API production dependencies
now declare `@steer/data` and existing Zod 4.5.4. Import enforcement permits them
only in `src/runtime.ts`, rejects them in routes/service/default startup, and
continues to forbid vendor SDKs in domain/tool-registry. pg/Drizzle remain inside
the data adapter. No dependency-age exception or new dependency version is added.

Before a real service is enabled: complete trusted listener/TLS/ingress and secret
loading, approved membership/key bindings, supervision, transaction/network
budgets, UI/accessibility verification and applicable gates. This module does not
authorize any of those actions. Evidence: `intent/0025/EVIDENCE.md`.

Increment 0028 adds a separate opt-in startLocalIdentityRuntime entry in this
composition root: strict local profile plus separately supplied identity/TLS
secrets, gateway and loopback HTTPS listener with coordinated shutdown.
It derives the public origin from the validated callback and still loads no
files/environment or real credentials. Default CLI behavior is unchanged.
See `docs/LOCAL-IDENTITY-RUNTIME.md` and `intent/0028` for current evidence.

Increment 0030 adds startLocalIdentityFromSecretProvider as a separate explicit
entry, reading a supplied provider's pinned encrypted bundle and clearing its
temporary byte/key inputs. Filesystem access stays in the dedicated adapter,
not this API file. Base/default startup still does not discover secrets or enable
real bindings. Contract and evidence: `docs/ENCRYPTED-SECRETS.md`, `intent/0030`.

Increment 0031 optionally pairs profile readModel.database/paths with the separate
readModelDatabasePassword secret (also supported by encrypted bundles). It owns
a second bounded lazy pool using steer_app, never the auth login/password by
default. Fixed org/repository come from the existing GitHub binding. Both pools
close on service shutdown or startup failure. No reader is enabled without the
complete explicit pair. See `docs/ARTIFACT-PROJECTION-READS.md` and `intent/0031`.

Increment 0032 adds a separate createProjectionRuntime entry with its own strict
profile/secrets, explicit agent authenticator and steer_projector pool. It offers
one bounded runOnce plus shutdown, not identity routes or automatic scheduling.
See `docs/REPOSITORY-RECONCILIATION.md`; identity/default CLI startup is unchanged.

Increment 0035 optionally mounts MCP through profile mcp.clientIds, an explicit
independent client allowlist using the same issuer/audience and fixed Git/service
bindings. Combined shutdown drains both transports before closing shared pools.
Default CLI remains unchanged. See `docs/COMBINED-MCP-RUNTIME.md`.
