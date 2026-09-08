# Specification

1. Add strict portable contracts and a current-human `intent.scope.start` command
   through the common registry, HTTP, tool discovery and generated OpenAPI. Require
   an explicit grant, current identity and exact owner/organization/product/repository.
   Input contains only review/preparation and draft/revision references. Reject
   caller text, queue, namespace, expiry, batches, profile, budget or authority.
2. The explicit data service restores the acknowledged encrypted original and
   verifies the latest draft ID, revision and digest, current lifecycle and review
   manifest. It is read-only: no original admission, draft mutation, batch claim,
   reservation, model dispatch, Git save or gate. Require separate execution
   authority over the exact retained original before and after scheduling.
3. Recheck human/records/source authority around each awaited boundary and expiry
   after the final authority wait. Changes withhold acknowledgement without undoing
   already scheduled work or resending an uncertain model operation. Sanitize errors.
4. Use an explicit server-bound Temporal client namespace and queue. Verify a
   registered namespace with at least 24-hour retention against the existing
   maximum 24-hour execution authority. Invalid or expired bindings cannot start.
5. Recover only the exact retained workflow: expected ID, UUID run, workflow type,
   queue, supported status, first start event, strict reference-only input, 30-minute
   execution timeout and no retry, cron, parent or continuation policy. Read the
   initial event for the described run; do not expose or decode result history.
   Missing or mismatched initial history must not become permission to start anew.
6. Only a genuinely absent description permits the existing one-shot starter with
   conflict FAIL and reuse REJECT_DUPLICATE. Reinspect after start/concurrent conflict.
   Lost scheduling responses remain unknown; a subsequent authorized request
   recovers the same run. Completed workflow status is not semantic clearance.
7. Return only exact request bindings and bounded acknowledged/unknown/unavailable
   receipts. Semantic completion, clearance, execution, retry, save and gate flags
   remain false. Results still come from the separately authorized scope reader.
8. Bound both services to four active operations and 30-second outer deadlines;
   use five-second Temporal RPC deadlines. Keep admission until underlying work
   drains, close owned stores and prevent late scheduling after timeout/shutdown.
9. Keep factories uninstalled by default, with no environment fallback, credential
   inspection, new dependency, table or migration. Verify actual HTTP/SQL/Temporal
   recovery under synthetic authority/model responses without claiming live UI use.
