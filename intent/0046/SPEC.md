# Specification

1. projection.snapshot.read is a shared read-only registry/HTTP/MCP tool with
   organization/repository input, explicit independent grant and fixed binding.
2. Read current projection references and stream head/generation in one SQL
   statement snapshot using the steer_app role and forced tenant RLS.
3. Return all references only when the inventory has at most 1000 records. Query
   1001 to detect overflow and fail unavailable rather than return partial data.
4. References contain record key, source revision and content digest, not content.
   Validate fields, scope, unique keys and cursor. Preserve full bigint precision.
5. A null cursor truthfully means no stream exists. On subsequent stream creation,
   the consumer must resnapshot before treating a new generation as resumable.
   No read operation creates a stream or performs a migration/reset.
6. Reauthorize same subject/type before and after I/O, including overflow handling.
   Missing grants, foreign scope, expiry, revocation and malformed outputs deny.
7. Opt-in readModel.changes: true composes both snapshot and change readers into
   the existing read-only pool. Each tool still needs its distinct current grant.
8. No SSE UI, complete business model, source-proof approval, governed write,
   live deployment, operational deletion/reset or provider permission is added.
