# Specification

1. The strict identity profile optionally accepts mcp.clientIds: 1–100 unique
   nonempty strings, each at most 200 characters. No implicit browser-client
   allowlist reuse. The MCP verifier uses the configured issuer/JWKS/audience.
2. Only explicit configuration mounts exact /mcp. The gateway routes that path
   to identity, never the renderer. Disabled composition returns 404; missing
   bearer returns 401. Cookies remain forbidden, even with a bearer.
3. MCP uses the same fixed Git reader/authorization path and ToolServices as
   browser HTTP. Caller metadata cannot change authority or storage bindings.
4. Shutdown closes service and MCP admission, awaits actual requests and MCP
   cleanup, then closes shared resources. Cleanup failure remains failed/closed.
   Preserve browser-only eager resource-stop behavior for existing callers.
5. Content-free status includes MCP lifecycle only when enabled. Configuration
   remains lazy, opens no provider connection and does not change readiness.
6. Actual isolated TLS/Keycloak/Git/PostgreSQL evidence must cover agent artifact
   bytes, foreign tenant denial, committed revocation/restoration and browser
   regression. Runtime factory wiring is separately tested without provider access.

Non-goals: OAuth provisioning/discovery, new business tools, MCP streaming,
automatic worker scheduling, real runtime activation, gate or release approval.
