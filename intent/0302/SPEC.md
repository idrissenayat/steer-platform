# Monotonic read-set lifetime

- Validate database clocks and lifecycle timestamps before deriving a use deadline;
  missing, nonfinite, malformed, fractional or negative clock values deny.
- Bind the earliest draft/candidate deadline to the actual snapshot object in a
  private test-only identity map. Copies or fabricated metadata cannot extend it.
- Check all retained snapshots against their original monotonic clock before/after
  current-caller and policy checks and before returning the combined result.
  A later snapshot must not extend the first one's lifetime. Regressing or invalid
  monotonic readings permanently invalidate that snapshot.
- Preserve both role transactions, full row readback, key and source checks, and
  the existing hold/revision/source-denial tests. No new provider request is needed
  for elapsed-time checks. Measure this, do not assume the previous 52 count.
- Verify deadline boundary, candidate-specific earlier expiry, forged/copy proofs,
  clock invalidity/regression and late combined-read expiry with deterministic
  test-local clock input. Never alter the host clock or real user records.
- Keep actual policy/lifecycle changes, hold ownership, owner drainage, independent
  production authorities and effect-boundary integration distinct from elapsed-time
  validity. This helper is not production authorization or an installed service.
