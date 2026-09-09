# Specification

- S1: Add an explicit `readHistorical` method to the immutable generation-original
  store, accepting only the exact operation/input-digest reference.
- S2: Require separate present historical-read authority before SQL and before
  release, with current source/draft/key/lifecycle checks. Do not reuse old execution
  permission, accept nonvoid acknowledgements or renew expiry/retention.
- S3: Verify the captured assessment through the distinct history reader against
  the original owner, repository, review, draft revision/digests, source commit,
  snapshot, exact inventory and combined results. Permit changed latest revision
  and expired execution only as historical metadata.
- S4: Preserve complete empty-corpus and legacy-without-assessment behavior without
  fabricating scope findings or making a model call.
- S5: Retain current-only ordinary reads, puts, admission, worker rendering and
  result consumption. Return no checkpoint or execution/retry/gate capability.
- S6: Test reconstructed multi-batch SQL/SDK history, expiry, source edits, present
  authority loss, missing/substituted history, key loss, holds and timeout admission.
  Verify no changes to originals, operations, draft revisions or reservations.
- S7: Keep the primitive server-only and uninstalled. Do not claim historical
  generated-output verification, human-facing lineage or live journey completion.
