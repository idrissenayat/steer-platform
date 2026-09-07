# Implementation plan

1. Define separate budget/reservation schema, migration privileges and owner binding.
2. Implement a fail-closed durable reservation adapter with serialized admission.
3. Exercise real disposable PostgreSQL concurrency, reconstruction, RLS, mutation
   denial, stale/expired bindings and lost-acknowledgement behavior.
4. Record evidence and push verified changes; leave real budgets and models disabled.

Next connect this adapter through explicit startup configuration only after verified
approval and conservative request-cost bounds. Continue independent source-read,
semantic review and durable-draft work while the model-test budget remains unapproved.
