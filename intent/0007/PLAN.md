# Execution route

1. Record the item and development acceptance cases.
2. Add the provider-free registry, typed principal and Zod schemas.
3. Implement dispatch and generated OpenAPI from one definition list.
4. Add Hono routing, bounded JSON handling, uniform errors and Node startup.
5. Test real in-process HTTP requests plus direct registry calls; verify denial
   precedes execution, malformed output is rejected, and default startup denies.
6. Run frozen install, root checks and a loopback HTTP smoke test.
7. Update delivery status, commit and push the increment.

Scope is two new packages plus documentation and workspace integration. No
external service is connected. Rollback removes this additive slice and restores
the lockfile; no authoritative data or schema is changed.
