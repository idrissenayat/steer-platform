# Implementation plan

1. Add a read-only bounded Git observer with fresh authority and provenance checks.
2. Compose it behind the existing fixed worker activity target and lifecycle.
3. Cover absent/stale/mismatched records, changed artifacts, integrity/head faults,
   revoked authority, overlap and drain with native tests.
4. Add real isolated Git/Temporal record-commit and revocation/recreation checks.
5. Run repository/frozen-install checks, document evidence and policy limits,
   commit and verify the candidate push without changing protected records.
