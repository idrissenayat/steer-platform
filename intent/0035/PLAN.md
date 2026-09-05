# Implementation plan

1. Add explicit profile/service MCP configuration and gateway routing.
2. Coordinate admission, actual request drain and shared-resource closure.
3. Verify disabled/enabled/configuration/credential boundaries and lifecycle.
4. Extend the real browser harness with a separately scoped Keycloak agent,
   official MCP client and PostgreSQL artifact read through the same HTTPS service.
5. Run full checks and isolated integration, document exact evidence and remaining
   gaps, then commit/push the candidate branch without changing protected records.
