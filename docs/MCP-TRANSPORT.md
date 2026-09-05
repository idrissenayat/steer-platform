# Shared MCP transport foundation

The explicitly composed POST /mcp endpoint uses official TypeScript SDK v2
server/core 2.0.0 and the same describeTools/invokeTool registry as the HTTP API.
The client 2.0.0 is a test dependency. Package integrity is in pnpm-lock.yaml;
docs/stack/mcp.json records this component's protocol/profile, not a complete
platform stack lock. The SDK import is permitted only in apps/api/src/mcp.ts.

## Client profile and tool results

Use Streamable HTTP with protocol 2026-07-28 and an explicitly obtained bearer
token. For the official v2 client, set versionNegotiation.mode to
{pin: '2026-07-28'} as well as transport protocolVersion. The client's default
legacy handshake is intentionally rejected; no silent compatibility fallback.

The endpoint accepts server/discover, ping, tools/list and tools/call. Discovery
advertises the canonical input schema. MCP output is wrapped as an object:
structuredContent.result contains the unchanged canonical HTTP result, including
null for an absent projection. Its result property has the canonical output
schema. A text JSON representation is also included. Tool denials use isError
with the canonical safe error code/message; transport/protocol failures are
separate. No business implementation or signer exists in the protocol adapter.

The official low-level Server is deliberately used for the advanced shared-
registry binding. Protocol framing/validation stays in the SDK; STEER forwards
registry descriptions and calls. This does not permit vendor SDKs in the registry.

## Authentication and isolation

createGitBackedMcpEndpoint composes the existing OIDC verifier and current fixed
Git authorization source. Valid issuer/audience/client/signature/expiry and fresh
explicit grants remain mandatory. Before a call, identity is checked again;
async projection reads also revalidate after storage I/O. Client _meta, hats,
tenant headers and protocol capabilities cannot create authority.

Require the exact configured HTTPS origin/path and Host when present. Origin
and Fetch Metadata, when supplied, must be same-origin. Cookies, session IDs,
replay IDs, query strings and non-POST methods deny. No CORS/ambient browser login
or OAuth discovery/registration route is exposed by this increment. Clients must
already possess an appropriately provisioned token; provisioning remains separate.

## Resource and lifecycle bounds

Existing URL/header/rate checks apply with eight actual in-flight requests and
16 KiB/5-second request bodies. Batch messages, notifications and subscription
methods are rejected. The server emits no mid-call notifications; SDK auto mode
therefore yields terminal JSON, and unexpected non-JSON output is rejected.
This is a Streamable HTTP profile using its JSON response form, not an SSE or
resumable-stream implementation. No SDK session state is retained between requests.

Each request owns/cleans its SDK handler; the endpoint drains admitted work on
shutdown before reporting closure. It does not own supplied database pools, cancel
an uncooperative tool by pretending completion, or retry failed tools. Callers
must coordinate their own backing resources. Long operations retain admission
until they actually settle; existing provider/database budgets still apply.

## Evidence and remaining integration

In increment 0034, the official client passed canonical schema/result parity and authorization,
capacity and shutdown tests. A separate actual local TLS listener verifies a real
Keycloak token against synthetic Git grants, observes committed revocation and
restoration, compares MCP/HTTP results and confirms listener closure. Browser/
Postgres regression was separate and passing; that increment does not claim a live
provider account or database artifact read over MCP.

Increment 0035 adds opt-in combined browser runtime/gateway mounting and shared
resource lifecycle, with actual PostgreSQL artifact read evidence described in
COMBINED-MCP-RUNTIME.md. Default CLI still does not mount /mcp.
OAuth metadata/onboarding, stdio, wider client
compatibility, any future streams, Temporal workflows and actual runtime binding
remain open. No spending/deployment/gate approval is inferred.

Official serving reference used for implementation: [SDK HTTP serving guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/http.md).
The installed 2.0.0 declarations/source were checked for the exact factory,
legacy-rejection and client negotiation APIs. Evidence: intent/0034/EVIDENCE.md.
