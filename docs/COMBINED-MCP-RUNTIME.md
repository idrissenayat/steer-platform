# Combined browser and agent runtime

Increment 0035 mounts the 0034 MCP transport through the identity service and
gateway only when explicitly configured. In the public identity profile:

```json
{ "mcp": { "clientIds": ["your-approved-agent-client"] } }
```

This is an optional fragment of steer-identity-runtime/v1, not a complete profile
or a provisioning command. IDs must be unique, nonempty and bounded (100 IDs,
200 characters each). Do not put tokens in the profile. The issuer, JWKS URI and
audience come from the validated browser configuration, but MCP client IDs are
independent; the browser client is not implicitly permitted.

The runtime passes the same fixed Git source and optional curated projection
service to both transports. The gateway routes exact /mcp to identity even when
disabled, so it cannot fall through to the renderer. Disabled returns 404;
enabled requires bearer authentication. Browser cookies, including alongside a
bearer, deny. Protocol negotiation and limits remain in MCP-TRANSPORT.md.

## Resource ownership

With MCP enabled, shutdown stops service/MCP admission, waits for actual admitted
requests and per-request SDK cleanup, then closes owned session/read pools.
Pending projection reads may finish and revalidate current authorization before
their backing pool closes. New requests receive 503. Repeated shutdown returns
the same completion; failed cleanup remains failed, not stopped. An uncooperative
operation can delay shutdown; the service does not manufacture completion after
a timeout. Existing provider/database/listener budgets still apply.

Browser-only composition retains its prior eager resource-stop contract. MCP
status is included only when configured. No credentials or artifact content are
exposed in status. Running is not health readiness or an approval.

## Evidence boundaries

The combined harness uses actual generated TLS, production-source gateway and
identity service, real Keycloak tokens and disposable PostgreSQL. The same local
Git fixture authorizes human and agent; artifact bytes are compared to its pinned
revision. This is not a real GitHub network-backed combined service. The runtime
factory and local bootstrap have separate lazy/configuration/HTTPS wiring checks
with provider access deliberately denied.

No default CLI activation, OAuth client provisioning, real account/key use,
deployment, spending or gate approval occurs. Durable Temporal orchestration,
remaining agent/model services and full operating surfaces remain planned work.
Verification details: intent/0035/EVIDENCE.md.
