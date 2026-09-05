# Development acceptance

- Token request and returned permission/repository bindings are exact.
- Reads resolve a commit and verify tree/blob identity and full content digest.
- Path traversal, redirects, tree truncation, symlink, hash mismatch, oversized
  streams, invalid encoding and provider errors fail without content leakage.
- JWTs have the configured issuer, RSA signature and bounded lifetime.
- Authorization does not accept another organization, identity, path, revision,
  duplicate record or a head that moved during reading; no stale fallback.
- Existing OIDC/API/data/root checks remain passing. No protected Exam is edited.
