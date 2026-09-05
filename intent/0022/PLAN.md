# Execution route

1. Add strict runtime pool factory and bounded acquisition/status interface.
2. Reapply server query/lock/idle limits at tenant and auth transaction entry.
3. Exercise saturation, cancellation, contaminated reuse and recovery in isolated PostgreSQL.
4. Use the runtime pool in assembled Keycloak/Postgres/Chromium authentication tests.
5. Run root checks, document exact limits and gaps, commit/push candidate.

Next: trusted service/runtime composition and explicit failure/shutdown behavior
before production UI activation. Network failure, real bindings and public ingress
remain separate from the server-side SQL timeout evidence.
