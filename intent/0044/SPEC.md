# Specification

1. Add versioned Drizzle stream/change tables with FORCE RLS, organization USING
   and WITH CHECK policies, read-only app grants and restricted projector writes.
2. Projection insert/change triggers append a reference in the same transaction.
   A repository stream row lock serializes positions through commit. Rollback
   consumes no committed position. Exact no-op updates and duplicate ingestion
   emit nothing. Repairs that actually change the projection emit a reference.
3. Projection organization/repository/key cannot move between streams. Runtime
   deletion remains unauthorized; no tombstone or removal policy is introduced.
4. Feed references contain only position, record key, source revision and digest.
   Cursors bind organization, repository, generation UUID and exact decimal
   bigint position. Scope is fixed by trusted composition, not request routing.
5. Internal reads require projection.changes.read, a current tenant principal and
   the read-only app role. Limits are integers 1–100. One SQL snapshot binds the
   generation/head/page; sequence gaps, future or replaced cursors require reset.
6. A null cursor explicitly requires an initial snapshot. Migration does not
   backfill existing records. Consumers must capture a delivery checkpoint before
   their snapshot and replay thereafter; full snapshot/stream transport composition
   remains future work. Generation rotation cannot silently skip a reset.
7. No public tool, SSE endpoint, gate approval, provider write, production migration,
   retention deletion or automatic operational reset is enabled.
