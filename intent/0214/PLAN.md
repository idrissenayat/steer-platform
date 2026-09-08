# Implementation plan

1. Implement server-owned immutable creation and monotone lifecycle restrictions.
2. Test concurrency, exact retries, expired/held state, provider/qualified authority,
   role isolation, unknown acknowledgements and bounded calls in disposable SQL.
3. Replace the candidate Temporal test's synthetic lifecycle loader with this SQL
   service and verify a queued job observes a later durable hold without saving.
4. Run regressions, preserve the real migration hold, document and publish evidence.

Next: encrypted versioned draft and generation-checkpoint storage, current source
and development-role composition, plus actual UI integration. Qualified D1 adoption,
real hold/publication evidence binding, key/all-copy recovery controls and separately
approved live model/save authority remain prerequisites, not inferred completion.
