# Spec

- Add optional `recordedRecovery` containing only item ID, save-operation ID and
  failed original run ID. Anchor organization/repository to the configured Git
  reader. No request-selected routing, identity, receipt or trust configuration.
- Require exactly paired `createRecoveryScheduler`. No factory/profile pair means
  no recovery service; an incomplete or malformed pair rejects startup before
  provider work. The explicit factory transfers ownership on success and must clean
  its own failed allocations if it rejects.
- Parse the factory scheduler's complete closed plan using the shared portable
  schema. Validate every scope/operation/failed-run coordinate, derived workflow ID
  and required methods before exposing the service. Dispose a mismatched transferred
  resource; do not bypass the shared current-grant checks.
- Keep recovery separate from ordinary dispatch and the worker's parent connection.
  The identity runtime owns its recovery scheduler and lazy session pool, not the
  shared Temporal server, worker or external guard connection.
- A recovery-only runtime must drain real in-flight requests before closing
  resources even without MCP. Deny new work once stopping, close all independently
  owned resources if one shutdown fails, and sanitize failure messages.
- Preserve 0182's distinct recovery/status grants, exact target revalidation,
  one-attempt client, retained duplicate rejection and post-read authorization.
  Construction does not authenticate, connect the session database or start a job.
- Exercise native Git current authorization and signed JWT validation. Join actual
  HTTP runtime dispatch, an owned SDK connection, fixed original failure, exact
  receipt/source projection and SQL event idempotency. Use separate recovery and
  projector subjects/grant files; revoking one cannot grant or revoke the other's
  unrelated permissions.

The integrated issuer responses and receipt provenance remain synthetic. A signed
JWT test is not actual Keycloak recovery acceptance. Shared grant checks are not a
durable lease across asynchronous parent observation/start/SQL; accepted effects
cannot be rolled back by later revocation. No live profile/grant, write permission,
reset, new save, human signature, release, deployment or spending is authorized.
