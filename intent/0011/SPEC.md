# Specification

- Validate source organization, repository, path, commit, blob and content
  digest before database acquisition. Derive deterministic projection/event
  keys from scoped source identity, not untrusted delivery IDs.
- Require an active scoped agent principal with `projection.ingest` grant;
  PostgreSQL runtime permissions remain an independent boundary.
- Serialize each organization/repository/path in a transaction; use expected
  previous revision to reject racing stale writers. Ingestion reference and
  projection update commit atomically.
- Exact duplicates do not append events. Conflicting bytes at an already
  recorded immutable source identity fail. A duplicate older event cannot
  regress a newer projection.
- Missing/drifted current projections can be repaired from the same verified
  source while preserving ingestion history. Data remains derived, not authority.
- Reconciliation obtains current head, reads exact source bytes, rechecks head
  and applies with the observed projection revision. Source drift/failure has
  no database effect. No authoritative grant is read from a stale projection.
- Real PostgreSQL tests exercise duplicates, CAS races, conflict denial,
  tenant/grant denial, atomic rollback and synthetic projection-loss recovery.
