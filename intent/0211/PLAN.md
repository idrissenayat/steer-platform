# Implementation plan

1. Add deterministic reference/result contracts and a one-attempt Temporal workflow.
2. Add a dedicated worker and activity that retrieves/validates original bytes
   outside history, enforces current authority and handles cancellation/deadlines.
3. Verify the actual disposable SQL/Git/Temporal chain and existing workflow
   regressions; record results, preserve signed sources and publish owned changes.

Next: compose authorized original-payload retrieval, current source/lifecycle/full-
corpus evidence and receipt checkpoint reconciliation. Then extend durable role
execution and actual UI scheduling/save/reopen. Live persistence, spending and
runtime provider access retain their separate approval requirements.
