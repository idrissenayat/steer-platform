# Specification

1. Export a lazy scoped reader with only `scope`, `read` and `close`. Read takes an
   exact review ID and preparation digest plus a mandatory current-identity/query
   revalidation callback. Reject extra private, model, budget or authority input.
2. Restore the immutable encrypted original under current records/source/key/draft
   authority. Recompute and match the saved preparation manifest. Reading uses only
   historical key IDs; it must not mint keys, admit, claim, reserve, mutate a
   checkpoint, schedule, dispatch, retry, save or delete.
3. Inspect the complete batch set. Only succeeded steps can contribute findings.
   Each must restore a response through the actual encrypted observation reader
   with mandatory pinned SDK verification. Compare its full checkpoint reference
   and payload digest to the exact completed step, owner, fence, reservation,
   configuration and preparation. Captured but uncheckpointed or quarantined
   observations cannot contribute a successful result.
4. Combine verified assessments with the existing whole-target result validator,
   recomputing the plan from the retained complete evidence. Preserve pending batch
   IDs, all inventory/context/access gaps, exact citations and model abstentions.
   Completed batches with no-match findings never erase incomplete corpus coverage.
5. Reinspect the batch snapshot and restore the original again before release.
   Reject a changed batch set rather than mixing old and newly completed work. No
   read retry or result cache is added. A newer human draft returns `superseded`
   while the retained result remains bound to its original revision.
6. Status precedence is expired, superseded, attention-required, pending, then
   review-available or incomplete according to structural assessment coverage.
   Expired reads return records-authorized source metadata only: no batch details,
   observations or combined findings and no execution authorization check/renewal.
7. Every asynchronous authority, historical-key and codec callback is surrounded
   by current identity/query-grant checks. Reject non-void authority/codec ACKs.
   Keep four concurrent reads, a 30-second total deadline and child-store limits.
   Timed-out dependencies retain admission until drained; close withholds late
   private results. No database lease is held across external authority callbacks.
8. Results always deny semantic-quality verification, authoritative clearance,
   execution, retry, saved-to-Git and gate-signature flags. `review-available`
   means verified recorded structured findings, not their semantic correctness or
   permission to create/update an intent. Errors are unavailable, never no-match.
9. No schema, migration, persisted private-result copy or runtime installation is
   added. The service still needs query/API/UI and reference-only Temporal wiring,
   real current authority bindings, approved activation and semantic/live human
   acceptance. Empty-source admission is not introduced by this reader.
