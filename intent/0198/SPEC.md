# Development specification

1. Actual signed-in page uses free-text intent conversation; remove the separate
   preview entry from the primary route. Keep manual Brief tools secondary.
2. Use the existing authenticated typed registry command, not a direct browser
   model call. Require an explicit drafting grant, matching organization and current
   human identity. Recheck access around each model operation.
3. Architect returns up to three focused questions OR candidate Brief/Spec. A new
   Test Agent context generates the Exam only when the candidates are complete.
   Reject malformed, contradictory and incomplete output; never fabricate success.
4. Mastra implementation goes through an explicitly configured LiteLLM-compatible
   local endpoint. Pin dependencies; reject direct providers and redirects; never
   log credentials or source content. Keep provider response storage off.
5. Require a budget-reservation dependency for each call. No automatic retry or
   implicit spend permission. Real session ledger and activation remain pending.
6. UI shows response, questions, three readable candidates, loading and errors.
   No saved/approved/test-passed claims; no model output executed as HTML or media.
7. Preserve session expiry/hidden-page cleanup and request/response bounds.
   No migration, deletion or automatic sending of existing browser-local drafts.
8. Document implemented versus pending work and verify actual components, registry,
   HTTP dispatch, runtime composition and real Mastra with a synthetic transport.
