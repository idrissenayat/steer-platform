# Spec

When a browser-only identity service has a configured Brief destination reader,
shutdown must close admission, await already admitted requests (including final
identity revalidation), and only then close owned session resources. Preserve the
legacy eager-close behavior for the original browser-only composition without this
capability. Existing MCP, scheduler and writer drain requirements remain unchanged.

New requests during draining receive the existing sanitized no-store 503 response.
Success, authority revocation during source I/O and source failure must all drain
and close resources once. A read admitted before shutdown is not a new write or a
grant extension: current authorization still decides whether its data may return.

The isolated integration uses actual authorization-code callback/cookie handling,
RS256 access/identity token verification, Git-backed authorization lookup, shared
registry handlers, the actual GitHub read adapter over native temporary Git, and
the production destination display controller/transport. Only the test harness
simulates provider HTTP, a browser cookie jar, time and in-memory session storage.
Do not substitute a caller-supplied principal or bypass server authentication.

Verify branch advancement, current-grant revocation, cross-tenant and caller-target
injection, forged role headers, missing tool grants and cross-origin cookie calls.
Only read-scoped installation tokens may be requested, with zero repository write
dispatches, authority callbacks or configured writers. Failed refreshes must replace
prior observed display state with unavailable state. Formal readiness stays closed.

This does not establish real Keycloak/provider access, PostgreSQL durability, actual
runtime-profile login, browser cookie policy/rendering, manual accessibility or
gate approval. Those remain separately required evidence.
