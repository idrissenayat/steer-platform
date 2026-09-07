# Development acceptance

- Real runtime profile construction is lazy and uses the existing destination binding.
- PostgreSQL 16 persists encrypted login/session state across actual service rebuilds.
- Original callback transactions are one-use; logout remains revoked after rebuild.
- The existing GitHub signer/reader verifies source heads with read-only permissions.
- Current Git grant removal/revocation and wrong scope/origin fail closed.
- Every owned runtime and the exact labeled disposable database are cleaned up.
- Explicit integration, type/full checks pass without relaxing architecture/gates.
- Provider HTTP, browser and real pilot limitations remain explicit.
