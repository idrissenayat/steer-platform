# Specification

1. projection.changes.read is a query in the canonical registry; HTTP, internal
   invocation, OpenAPI and MCP share its schemas and handler.
2. Move cursor/page schemas into the provider-free registry as the sole contract;
   data imports them and preserves compatibility re-exports. Keep exact decimal
   bigint positions, strict fields and bounded pages of 1–100 references.
3. Bind input, service and cursor to the same organization/repository. Require
   the explicit projection.changes.read grant, current human/agent identity and
   configured reader/revalidation. Agents may not carry human hats.
4. Fresh same-subject/type authorization must pass before and after async I/O.
   Revocation, expiry, identity switch, clock regression or source failure denies.
5. Return page or reset-required. Only the typed cursor-loss condition produces
   reset-required, after reauthorization; other failures are generic tool errors.
6. Validate returned scope, generation, bounded length, contiguous positions,
   next cursor, snapshotRequired and hasMore consistency. Reject foreign data,
   hidden fields, skipped positions and silently changed generations.
7. Identity runtime wiring is opt-in through readModel.changes: true, using its
   existing bounded read-only database pool and exact GitHub repository binding.
   Artifact paths remain separately curated; feed permission covers repository
   reference metadata and is not implied by artifact-read permission.
8. No SSE, initial snapshot handshake, business write, gate approval, production
   deployment/migration or live credential/provider binding is added.
