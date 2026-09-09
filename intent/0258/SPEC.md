# Specification

- S1: Read one retained operation/role snapshot with read-only SQL and explicit
  history authority, including pending roles, without changing existing ports.
- S2: Verify each completed SDK role and the exact predecessor result; recheck
  every role's current records/key/source permissions after all SDK callbacks.
  Reject changing source/latest-revision or operation/step snapshots.
- S3: Return only strict role output and inert digests. Do not expose raw wire,
  private source/profile packets, execution checkpoints or authority flags.
- S4: Register `intent.development.history` as one human-only, current-grant,
  no-store HTTP/MCP query. Validate exact scope, target, output hashes and linkage.
- S5: In the actual editor, explicitly read original documents and compare them
  with the selected preserved snapshot. No adoption, replacement, generation,
  automatic reads/retries or save effect. Clear stale/private views on context loss.
- S6: Preserve bounded server/browser admission and cancellation behavior. Do not
  cache authority, widen model budgets, enable records or change migrations.
- S7: Exercise actual SQL/recorded SDK and React graph with labeled synthetic
  authority; distinguish those checks from live browser/provider acceptance.
