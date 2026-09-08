# Acceptance boundary

Development acceptance requires actual HTTP handler-to-encrypted SQL round-trips,
not an in-memory service alone. Conflicts and uncertain acknowledgements remain
explicit; only the same exact mutation may recover its idempotent acknowledgement.
No cross-owner content release, retention reset or regenerated document is allowed.

Tests use synthetic identities, records grants and keys. They are not actual
signed-in UI usage or adoption of D1. Real database migrations remain held; no live
model/Git-saving permission, gate signature, deletion, deployment or spending is
authorized. Editor integration and I1–I6 user acceptance remain open.
