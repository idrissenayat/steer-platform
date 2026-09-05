# Execution route

1. Extract the provider fixture's session operations behind a test-only contract.
2. Add explicit durable mode and isolated PostgreSQL lifecycle/migrations.
3. Run the same real provider flow with encrypted storage and cross-instance
   callback, key mismatch, reconstruction and logout checks.
4. Re-run provider-only mode to verify fixture refactoring, then root Node 24
   checks and frozen dependency installation.
5. Record evidence and limits; commit/push candidate. Actual browser validation
   and authoritative membership configuration remain the next work.
