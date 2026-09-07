# Spec

Extend the existing explicit `pnpm test:auth:browser` integration. Keep the actual
Next production build, local HTTPS gateway, isolated Chromium, Keycloak, encrypted
PostgreSQL 16 store and normal ingress limits. Only generated credentials and owned
temporary repositories/databases may be used; no account or live provider changes.

After actual browser sign-in and draft preview, temporarily route the gateway to
the actual destination runtime profile using the same encrypted session namespace.
Use a strict read-only GitHub HTTP fixture backed by the existing native Git source.
Verify the production-generated App JWT and exact read-only installation token
scope. Reject all other methods/routes rather than forwarding to a real provider.
Use actual commit/tree/blob objects, preserving blob bytes for production hashing.

Exercise the rendered destination button and response with no injected session,
clock, mocked browser response or production permission changes:

1. Observe the configured path, repository/branch and current source head.
2. Reconstruct the destination runtime, advance Git and observe the new head with
   the same real browser cookie and PostgreSQL session.
3. Remove its grant in native Git, verify HTTP 403 and cleared displayed metadata;
   restore the grant and verify a fresh successful observation.
4. Wait for the real 15-second display expiry and verify metadata disappears.
5. Confirm the authoring title and preview digest are unchanged, web storage is
   empty and readiness remains closed.

Restore the original composed service and grants even on failure, and shut down
all owned runtimes before the shared database is removed. Keep the rest of the
browser suite intact. Existing 0151 separately covers login callback reconstruction;
this increment consumes a session created through the composed login service.

These checks do not prove a live GitHub binding, actual provider approval, manual
accessibility, gate readiness, write authorization, deployment or spending.
