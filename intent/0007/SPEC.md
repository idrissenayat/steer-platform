# Spec: Shared registry and HTTP adapter

- `@steer/tool-registry` owns Zod input/output contracts, tool metadata,
  authorization and dispatch; it imports no network/provider SDK.
- The initial `session.context` query takes only an organization ID and returns
  the verified principal's organization, subject, type, hats and tool grants.
- Trusted identity arrives through an internal authentication adapter, never
  through caller-supplied role or organization headers. Identity must have a
  current expiry, matching organization and an explicit tool grant.
- Input and output are validated. Unknown tools, extra input properties and
  cross-organization requests fail without executing a handler.
- OpenAPI 3.1 request/response schemas are generated from the same Zod objects.
- Hono maps errors to stable, content-free JSON and rejects malformed JSON,
  unsupported content types, and bodies larger than 16 KiB.
- `/health/live` reports process liveness. `/health/ready` reports the remaining
  identity/projection dependencies with 503. Neither implies release readiness.
- Default startup binds loopback, uses port 8787, and installs no mock identity
  resolver. OIDC, database, Git writes, MCP and Temporal are later increments.
- Typechecks, tests and build checks participate in root `pnpm check`.
