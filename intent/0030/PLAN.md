# Execution route

1. Add strict encrypted-file provider and portable wrapped-data-key interface.
2. Constrain filesystem imports to that adapter and keep defaults closed.
3. Add explicit secret-backed local runtime entry with strict decoding/buffer cleanup.
4. Test path/digest/permission/crypto failures and actual in-flight limits.
5. Verify real isolated TLS/Postgres runtime after input cleanup and browser regression.
6. Record evidence, update current guides and push the verified development increment.

Next: tenant-scoped authenticated read-model tools and repository projection
ingestion, then the remaining Phase 1 components. Live KMS/secret binding remains
an explicit provider/approval task, not a reason to stop isolated implementation.

