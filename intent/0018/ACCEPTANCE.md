# Development acceptance, not an independent Exam

| Requirement | Verification |
| --- | --- |
| Actual Keycloak code exchange into encrypted PostgreSQL | `pnpm test:auth:integration` |
| One callback accepted and one token exchange across apps | Concurrent route requests using separate stores/pools |
| Ciphertext-only payload, recovery and wrong-key denial | DB inspection plus shared tool HTTP result |
| Local logout invalidates both app instances | Durable row absence and two API 401 responses |
| Real provider negatives remain valid | PKCE/client-secret/disabled grant cases |
| Provider-only mode preserved | `pnpm test:identity:integration` |
| No production-layer or normal startup change | Root checks and manifest/import boundary test |
| Exact dependency versions and cleanup | Frozen install, scoped container/pool finalizers |
