# Specification

1. Add read-only intent.brief.catalog to the shared HTTP/OpenAPI/MCP registry.
   Strict input is organizationId and canonical repository scope ID. No arbitrary
   path list, URL, caller query or paging selector is accepted.
2. Require intent.brief.catalog, intent.brief.read and projection.artifact.read
   grants before I/O and after reading. Fixed runtime scope, current identity,
   expiry, agent/hat rules and clock monotonicity are preserved.
3. Extend the existing ArtifactProjectionReader with optional catalog capability.
   The supplied PostgreSQL reader implements it using the existing steer_app
   pool and immutable curated path binding. No additional role, credential,
   table, migration, wildcard discovery or live activation is introduced.
4. Only curated BRIEF.md and intent/<at least four digits>/BRIEF.md paths qualify.
   Compute their existing projection keys privately. One MVCC metadata statement
   selects exact organization/repository and parameterized keys, at most 1001 rows
   as an overflow sentinel. Since the curated binding is at most 1000 unique
   paths, valid output is complete, not a silently truncated page.
5. Return kind=brief-catalog with scope and at most 1000 unique path/revision/
   contentDigest records sorted by path. Missing projections are absent; an empty
   result is not proof that Git has no Briefs. No content, title, status, signer,
   count of uncurated files or policy claim is returned.
6. Bound corrupt database scalar extraction before transport (path 500 bytes,
   revision 40 bytes, fingerprint 64 bytes). Validate strict shapes and exact
   key-to-path/allowlist mapping. Invalid/duplicate/oversized rows fail as a whole.
   Never skip a corrupt selected row and silently call the remainder complete.
7. Use forced organization RLS and actual steer_app login, not projector/admin.
   Post-read expiry denies. At the registry, missing capability is unavailable,
   scope/grant failures deny, and private backend errors remain generic.
8. Catalog fingerprints are projected references, not verified content or current
   Git/approval proof. Feed the selected tuple into intent.brief.read, which checks
   byte consistency and current dual grants. No browser polling is introduced.
9. Verify native contracts, SQL resource/scope controls, real PostgreSQL isolation/
   corruption/repair, HTTP/MCP parity and actual agent catalog-to-Brief/browser
   discovery with committed catalog-grant removal and recovery.
10. Rendered backlog/detail binding, authoritative business lifecycle, five R5
    findings and formal/manual/operational/release requirements remain open.
