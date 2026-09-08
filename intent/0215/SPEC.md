# Spec

- Snapshots preserve exact original text, clarification turns and nullable
  Brief/Spec/Exam content. Reject lone surrogates, extra fields and author/review/
  signature/save claims. Empty editable source is allowed; readiness is separate.
- Append requires an actual server-owned lifecycle and fixed owner/org/product/
  home/configuration/policy. Caller supplies a stable mutation ID plus expected
  parent revision/digest; server selects the next revision. All earlier rows stay
  immutable. There is no blind update, merge, restore-overwrite or delete API.
- Same command returns the same acknowledgement. Changed reuse conflicts. Two
  different commands with one parent cannot both append. An old command replay
  after a newer edit returns its original reference and the current latest revision.
- Derive source revision only from original/clarification changes. Derive final
  scope from exact source and Brief/Spec bytes using the existing fingerprint
  contract; Exam-only changes preserve that scope but do not restore review/consent.
- Bind content, parent chain, mutation, configuration, lifecycle creation and
  scope digests into authenticated encryption metadata. Keys remain external;
  SQL contains ciphertext and bounded non-anonymous reference/digest metadata.
- Read exact revision or resolve latest to a fixed snapshot. Recheck current
  lifecycle, grants, historical key and immutable row before release; return
  latest revision separately rather than silently replacing an older selection.
- Force owner/org/product RLS, grant only SELECT/INSERT, enforce sequential parent
  chain and current lifecycle in the SQL trigger. Cap history at 1,000 revisions;
  cap serialized plaintext at 768 KiB. No silent truncation, pruning or cap reset.
- No authorization or key calls inside SQL transactions. Bound external/pool
  calls to five seconds and retain admission until timed-out work drains. Lost
  insertion acknowledgement or post-insert denial remains unknown.
- Compose stored revision readback with the candidate request and actual disposable
  Temporal/SQL/native-Git path. No API/UI bootstrap, paid generation, key provisioning,
  real migration, policy adoption or independent Exam provenance is added.
