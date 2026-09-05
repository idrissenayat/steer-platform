# One tool boundary for external agents

STEER exposes authenticated HTTP tools but external agents need the architecture's
MCP transport. Add that protocol without copying business behavior or trusting
client-provided identities, grants, cookies or request metadata.

Success means the official MCP v2 client discovers canonical schemas and calls
the same tools/results as HTTP, with tenant/grant denial, current revocation and
honest resource lifecycle. Prove a real local TLS/Keycloak/Git path using isolated
synthetic identities. No paid deployment, live credential or governed write.
