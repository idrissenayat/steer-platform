# Implementation plan

1. Implement the provider-free controller against canonical snapshot/feed schemas.
2. Test snapshot replacement, atomic page application, reset/capacity/malformed
   input, large decimal cursors, bounded catch-up and reentrant close races.
3. Compose the controller with the actual MCP client in the isolated
   Keycloak/Git/PostgreSQL harness; verify committed revocation clears state.
4. Verify repository checks, document exact limits, publish and verify remote.

Next: browser transport and production UI binding, followed by operating business
models/surfaces while canonical gate proof and remaining services stay open.
