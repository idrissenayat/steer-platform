# Development acceptance

- Exact configured scope and strict committed receipts validate before source I/O.
- Recorded bytes and both hashes are verified; current HEAD is never substituted.
- Different selected revisions are preserved without source reads or writes.
- Original sink revision fences ingestion, including duplicate and race behavior.
- Aborted/failed reads never start late writes; post-write uncertainty is not rollback.
- Native Git/PostgreSQL/browser integration uses the production helper for ingestion.
- Focused/type/browser/full checks pass with live-composition and authority limits.
