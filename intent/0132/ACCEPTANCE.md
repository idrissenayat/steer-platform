# Development acceptance

Not a protected Exam, independent review or gate signature.

- The shared registry can preview, confirm, create and recover the exact Brief
  using the actual request writer and storage adapter in isolated native Git.
- Human scope, session binding, current grants and expiry are checked around reads
  and proof evaluation; agents/foreign or revoked identities cannot mutate.
- New commits require fresh authority again after write-token issuance.
- Status-only access, duplicate confirmation and restart recovery do not create
  additional commits or substitute a new signer/session.
- Stale/mismatched proof, closed sessions, backward clocks and hung dependencies
  fail closed. Post-dispatch revocation/lost acknowledgement stays uncertain until
  authorized source readback, never a rollback or automatic retry claim.
- All existing storage groups are preserved; focused and full checks pass.
- No protected documents, provider permissions, keys, gate decisions or live
  writer configuration change.
