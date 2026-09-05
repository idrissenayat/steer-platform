# Development acceptance

- Duplicate and concurrent delivery produces one immutable ingestion reference.
- Current-revision CAS refuses stale application without appending an event.
- Same source identity with different content is rejected without overwriting.
- Older duplicates never regress current state; missing/drifted projection
  repair restores source value without rewriting ingestion history.
- Invalid digest, wrong tenant, human principal and missing grant fail before SQL.
- Source read failure or moving Git head causes no ingestion call.
- All transaction outcomes are verified against real PostgreSQL with RLS.
