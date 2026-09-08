# Spec

- Trusted-worker-only `put`; scoped `read`, `verifyCheckpoint` and `close`.
  No public authoring tool, model call, claim, dispatch, editor update or delete.
- Strict role-specific output preserves exact Unicode and whitespace. Architect
  returns either at most three questions with null documents, or both Brief/Spec
  with no questions. Test Agent returns only its Exam. Reject extra authority fields.
- Inspect the actual operation/step, verify the owner/fence, and restore the actual
  encrypted draft revision. Deny undispatched, known-failed or quarantined steps.
  Authenticate step/input/configuration/reservation, predecessor, original revision/
  scope and result digests with the ciphertext.
- One immutable result per organization/operation/role, with server-minted result
  UUID. Exact duplicates converge; changed reuse conflicts. Lost COMMIT remains
  unknown; the same command recovers the original row without another model call.
- Bounded, non-anonymous metadata; external per-draft keys; forced owner/org/product
  RLS; SELECT/INSERT-only grants; actual source/step foreign keys; current-lifecycle
  and exact-metadata insert guards. No external calls inside SQL transactions.
- Recheck current grants, historical key, source integrity, immutable result and
  step state before release. Report the original and latest draft revision
  separately; never revive review, signature or execution/retry authority.
- Checkpoint verification reconstructs actual encrypted bytes. Five-second
  external bounds and retained single-call admission suppress late work.
- The original operation config must remain valid (maximum 24 hours); seven-day
  draft retention does not imply seven-day result access. Historical authority
  beyond operation expiry remains open and must not reactivate old jobs.
- Capture is not proof of model authorship, provider delivery, fresh-context
  execution or content/Exam adequacy. Prompt/evidence originals, provider provenance,
  durable role activities, evals and actual UI acceptance remain separate.
