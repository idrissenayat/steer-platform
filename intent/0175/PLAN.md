# Plan

1. Reuse current registry authorization patterns and the 0174 structural client port.
2. Add exact schemas and separate dispatch/status definitions; no provider imports.
3. Test grants, role/identity/clock changes, scope/configuration drift and uncertain
   results; exercise official MCP/HTTP parity and denial/default-closed behavior.
4. Extend actual local Temporal/Git/PostgreSQL integration through these tools.
5. Run regression/builds, document limits, commit/push and verify exact remote state.
