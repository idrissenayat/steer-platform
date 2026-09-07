# Spec

Extend the disposable no-network GitHub transport with commit parents, bounded
operation-path history and exact base-to-head comparison derived from native Git.
Retain strict origin, repository, read-only token scope and query validation.

Seed exactly one canonical Brief plus its operation marker in a new native commit
with the expected single parent. Use exclusive creation and verify the exact staged
paths. Marker hashes and receipt revision must be computed from actual test bytes
and Git objects. Mark this explicitly as test history, not a platform save or human
approval; a synthetic request digest is not provenance or execution authority.

Compose the existing identity service with the production request-owned GitHub
writer factory and actual status store. Reuse the existing encrypted PostgreSQL
session and real Keycloak identity. Each status invocation must close its owned
writer; reconstructed services must not close the parent harness's shared store.
Use an always-denying gate verifier and direct-dispatch denial. Add no real write
grant, provider binding, runtime profile option or production writer installation.

Through the existing browser controls, verify exact committed receipt readback,
absent operation, later unrelated branch commits, service reconstruction and current
status-grant denial/restoration. No intercepted browser response may satisfy these
checks. Preserve draft facts/digest and empty web storage. The recorded receipt
must remain separate from the different current draft. Existing broad browser
security, expiry and shutdown checks must continue to pass.
