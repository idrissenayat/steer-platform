# Specification

- S1: Add separate read-only retained-step and retained-result ports usable before
  and after expiry. Preserve existing expired-only and current execution contracts.
- S2: Add historical exchange recovery with separate observation/input/result
  permission, 0256 exact originals, succeeded role/result bindings and exact
  predecessor reconstruction for the Test Agent.
- S3: Verify both immutable stages against their original source, rendered packet,
  recorded SDK profile/model/output/usage and result digests. Recheck keys, access,
  lifecycle, rows and role/result references before release.
- S4: Expose a server-only verified factory with read/close only. No gateway,
  transport, default binding, checkpoint or execution capability. Raw exchanges
  remain private; no combined-bundle or provider-attestation claim.
- S5: Preserve denial for incomplete/uncertain roles, tampering, absent historical
  authority, nonvoid verification, key/profile/source revocation, holds and closure.
  Keep bounded dependency admission and original records/reservations unchanged.
- S6: Remove recursive duplicate source-context reconstruction in response
  acknowledgement while retaining request permission, keys, ciphertext/lifecycle
  checks and caller source/step revalidation. Do not increase deadlines.
- S7: Verify composed 34-source assessment, both recorded roles, later human edits
  and historical recovery. Distinguish focused SQL evidence, full regression
  evidence, disabled implementation and still-required real human acceptance.
