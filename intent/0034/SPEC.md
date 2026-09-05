# MCP transport contract

Pin @modelcontextprotocol/server 2.0.0 in API production dependencies and the
official client 2.0.0 in tests; lock core/transitives through pnpm-lock.yaml.
Keep SDK imports restricted to API src/mcp.ts and outside domain/tool-registry.
Use the official low-level Server binding to forward schemas and dispatch from
the canonical registry; this advanced binding avoids a second implementation.

Expose explicit createMcpEndpoint(publicOrigin, trustedDependencies), no listener
or default CLI activation. Serve only POST /mcp at one exact HTTPS origin, with
exact Host when present, no query/userinfo/fragment, and same-origin Origin/Fetch
Metadata when supplied. Require a bearer header and independent authentication;
reject all cookies, MCP session IDs and replay IDs. No CORS, implicit OAuth or
ambient-session fallback. Authentication failure never reads tool input first.

Pin protocol 2026-07-28 in both the HTTP header and official SDK modern envelope
handling, with legacy reject. Permit request IDs and only server/discover, ping,
tools/list and tools/call; deny batches, notifications, subscriptions and legacy
initialization. Reuse actual-byte/time body bounds (16 KiB/5 seconds) and existing
URL/header/rate controls, with eight actual in-flight requests. The registered
server emits no notifications; SDK auto response mode is required to produce JSON
and any unexpected non-JSON response is rejected. No persistent SSE/session state.

tools/list uses describeTools, canonical input schemas and an object envelope
whose result property is the exact canonical output schema. tools/call invokes
invokeTool, returns text JSON plus structuredContent.result, and carries canonical
safe ToolError codes in isError responses. Reauthenticate before dispatch and
reject identity switches/expiry; asynchronous projection reads retain their own
post-I/O revalidation. SDK protocol errors use fixed safe messages. Client _meta,
scope, hats and tenant headers never create authority.

Each request owns its SDK handler/server and closes it after the completed JSON
response. Endpoint shutdown closes admission, waits for actual admitted operations
and never claims completion while a tool remains active. It owns no shared pool.
The caller must manage database/provider resources separately. No fake timeout,
detached tool, automatic retry or cancellation-as-rollback claim.

createGitBackedMcpEndpoint composes the existing OIDC verifier with the fixed Git
authorization resolver and explicit tool services. It cannot accept an untyped
override authority resolver. Verify official-client schema/result parity, denials,
revocation during I/O, capacity/shutdown and actual HTTPS/Keycloak/Git revocation.

This is not combined browser/gateway runtime mounting, OAuth resource metadata or
dynamic registration, legacy-client compatibility, stdio, resumability, streaming
notifications, durable workflows or a production/regulated profile. Those remain
explicit integration work. The artifact tool's real PostgreSQL path is separately
verified; no real database-through-MCP claim is made by synthetic service tests.
