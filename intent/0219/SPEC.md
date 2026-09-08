# Spec

- Derive a domain-separated operation input digest over exact source, configuration,
  evidence, direction and both instruction profiles. Preserve strings verbatim.
- Recompute source scope and evidence content/blob digests. Bind direction to the
  snapshot; linked targets must occur in included pinned evidence. Incomplete
  coverage remains incomplete. Structural integrity is not semantic clearance or
  proof of a real human decision.
- Retain role instructions and nonsecret profile/runtime revisions, model route and
  output limit. Unknown settings and credential fields are rejected. Generic text
  is not secret detection; callers must not supply credentials inside source text.
- Capture against the actual admitted operation and exact decrypted source revision.
  Current original-record, evidence/profile/direction, operation, draft and key
  authority are trusted required ports, never caller booleans.
- Store one immutable encrypted row per organization/operation. Forced owner/product
  RLS and insert-only runtime grants apply. Lost commit acknowledgement is unknown;
  current readback reuses the original with no new reservation or dispatch.
- Restore using scoped records configuration and operation/input reference, without
  an in-memory execution config. Restored configuration remains old data, never a
  renewed execution grant. Current evidence/draft/key access and lifecycle apply.
  Return original/latest versions separately and all execution/retry/gate flags false.
- Compose restored config with the separate historical-result reader's current
  authority; do not fall back to expired execution grants.
- External authority/key work stays outside SQL. Holds, expiry, close and late
  revocation deny release. Timeouts retain admission until callbacks drain. No
  deletion, expiry extension, key/all-copy disposal or backup acceptance claim.

Rendered per-role requests, actual provider response/usage provenance, durable
activities and real editor/API integration remain required separate work.
