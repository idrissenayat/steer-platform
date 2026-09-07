# Plan

1. Reuse the existing job lifecycle for recorded receipts and inventory/path jobs.
2. Add current-identity/cancellation checks around readback and sink boundaries.
3. Test invalid/revoked/substituted agents, scope capture, failures, single-flight,
   draining shutdown and no rollback/retry after ingestion.
4. Connect the disposable browser-context status endpoint to the job and actual
   PostgreSQL ingestion. Verify human status-grant denial blocks that connection.
5. Run focused/type/browser/full checks, document limits, commit and verify push.

Next compose the job into an explicit owned runtime using existing source/database
adapters and a trusted receipt-readback binding, then verify the combined held
authoring-to-projection journey. Do not create a live trigger, install a writer or
infer lifecycle stages from projected Briefs. Revision-linked work-list remains
overnight stretch. Full write authority, real configuration, five R5 findings,
independent/qualified review and human gates remain outstanding.
