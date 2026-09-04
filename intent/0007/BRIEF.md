# Brief: One entry point for human and agent tools

The Next.js shell and domain package lack a production API boundary. Adding
separate rules for UI, agents and future MCP clients would introduce drift.

Establish one typed, transport-independent registry and a runnable Hono API.
Prove the tenant, grant, expiry and validation rules with a read-only context
query before connecting identity or persistence providers.
