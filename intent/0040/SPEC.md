# Specification

1. Add a managed wrapper around the fixed Temporal scheduler client. It owns a
   caller-supplied connection closer, admits at most eight actual operations,
   and exposes only scheduler, operational status and idempotent shutdown.
2. Failed construction attempts owned cleanup and reports generic initialization
   or cleanup failure. Shutdown closes admission immediately, waits for actual
   start/inspect completion, then invokes the closer once. Failed closure stays
   failed and closed to new work; no automatic replay, force-close or fake drain.
3. The identity runtime profile optionally declares scheduling with exactly
   itemId, maxRounds and minIntervalMs. An explicit createScheduler dependency
   must be present if and only if the profile opts in. No provider discovery,
   secret/environment loader, SDK dependency or default activation is added.
4. The factory owns allocations until it resolves. On success, the runtime takes
   ownership and validates scheduler org/repository against its Git binding and
   item/limits against the profile. Failed binding/startup cleans owned scheduler
   and pools. A rejecting factory is responsible for its own partial allocation.
5. The service passes scheduling and optional projection reads through the same
   ToolServices to browser/HTTP and MCP. With scheduling enabled, even browser-
   only service shutdown waits for admitted requests before resource closure.
   Existing browser-only behavior without scheduling remains unchanged.
6. Runtime cleanup attempts all owned pools and scheduler; one failure cannot
   skip another resource. Errors are generic and never credentials/provider text.
7. Verify scope/config mismatch, denied factory invocation, failure/drain races,
   and a separate actual Temporal connection closed by the identity runtime
   without stopping the server or another client's connection.

Non-goals: live connection configuration/ACLs/TLS certification, all-in-one real
OIDC-to-Temporal deployment, cancellation of running workflows, gate waits,
multi-item scheduling, distributed leases, production readiness or gate closure.
