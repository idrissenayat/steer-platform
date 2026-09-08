# Spec

- Historical reading is opt-in through a separate required-current
  `authorizeHistoricalResult` port. Omitting it denies before I/O. No automatic
  fallback from normal `read`, `put` or `verifyCheckpoint`.
- A separate `createExpiredDevelopmentStepReader` exposes only `inspectExpired`
  and `close`. It uses REPEATABLE READ READ ONLY SQL, exact original config/owner/
  input/role bindings and actual DB expiry. Active jobs cannot take this route.
- History authority is checked outside SQL and outside pool leases before and
  after metadata reading. Old execution/budget grants are never used as current
  historical-read authority; an inactive budget neither grants nor prevents an
  otherwise authorized read-only historical inspection.
- `readHistorical` restores exact original bytes under current draft/source/key
  and historical authority. Preserve original/latest draft revisions separately.
  Remove checkpoint continuation references and return historical=true with gate,
  execution and retry authority false.
- No state, result, budget, reservation, operation expiry or source edit is changed.
  Unknown/known-failed/undispatched outcomes stay denied, even historically.
- Current holds, lifecycle expiry, permission loss, scope drift, corrupt/wrong
  historical keys and close still deny release. Five-second bounded callbacks and
  retained admission suppress timed-out or late work.
  Recheck draft-read authority after result-key I/O, independently of history authority.
- Historical read metadata is not a renewed execution configuration, provider
  provenance, model authorship or a human/agent acceptance verdict. Real D1/policy,
  current identity/records authority and key/all-copy controls remain prerequisites.
