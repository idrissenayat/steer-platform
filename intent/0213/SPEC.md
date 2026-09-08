# Spec

- Store only schema-canonical immutable candidate requests for already admitted
  operations. Recompute the bundle/consent digest and verify current operation
  admission before storage and restored-content release. No allocation or Git call
  occurs through original verification. Changed bytes/revisions conflict.
- Encrypt before SQL with AES-256-GCM, random 96-bit nonce, 128-bit tag and an
  external per-draft 256-bit key lease. Bind owner/org/product, draft/revision,
  operation/input/payload/configuration digests and immutable clocks as authenticated
  metadata. Maximum serialized plaintext is 768 KiB. Never store key bytes here.
- Require trusted current authorization, exact original admission, authoritative
  server lifecycle and external key services. Configuration is not policy adoption.
  Separate `steer_draft_runtime` role plus forced owner/org/product RLS; ordinary
  runtime roles have no draft access. No deletion, content updates or hold release.
- Fix expiry to server-created plus 168 hours, or the earlier server-supplied
  publication/discard use deadline. Enforce database clock and a conservative
  monotonic return deadline. Latch observed holds/earlier clocks across the owner's
  stored revisions of the same draft; retries cannot renew or restore them.
- Read historical key IDs, revalidate restored bytes and current authority/key/
  lifecycle before returning them. Lost insertion acknowledgement remains unknown;
  reconstruction/repeated exact put recovers one row without rewriting ciphertext.
  Expired/held/missing/corrupt content is unavailable, not restored or deleted.
- Keep authority, key and lifecycle calls outside SQL; bound each to five seconds,
  hold single-flight admission while timed-out work drains, scrub pooled scope,
  enforce restricted DB identity and query limits, and withhold late closed results.
- Compose encrypted loading with the actual disposable Temporal/SQL/native-Git
  candidate tests. No bootstrap, UI route, production migration, real key/grant,
  provider access, signed-source mutation, policy acceptance or independent verdict.
