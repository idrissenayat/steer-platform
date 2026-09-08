# Acceptance boundary

The existing clarification case must return needs-clarification with exactly one
synthetic model call, two encrypted observations and no Test Agent call. Its
question content remains in encrypted role records, not Temporal history.
Five repeated runs with a synthetic five-millisecond per-query delay must pass
without raising production deadlines or retrying an ambiguous dispatch.

Both encrypted stages must be bound to the same exact execution/source context.
Missing stages, foreign scope, current authority loss, holds, altered ciphertext,
changed rows, missing keys and close during pending access must deny a usable pair.
Request and response may use different historical keys; revocation at either
stage's final key check must still deny release and preserve caller key buffers.
The full suite and focused diagnostic evidence must be reported separately.

These are development tests, not an independent Exam, gate signature, semantic
quality evaluation or proof of live human completion. The earlier intermittent
failure's cause remains unconfirmed even if the controlled latency case is fixed.
