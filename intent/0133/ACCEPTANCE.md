# Development acceptance

Not a protected Exam or independent gate decision.

- Both reproduced partial rollback cases reject rather than return observations.
- Equal timestamps remain valid; invalid starts and exact deadlines fail closed.
- Gate-source reads stop at checked boundaries after clock/timeout failure.
- A real fifteen-second timeout rejects the caller without admitting overlap.
- Shutdown waits for the actual outstanding dependency; late completion starts no
  additional source reads and cannot return valid evidence.
- Existing source-integrity, identity, API-shape and no-authority tests pass.
- Focused and full repository checks pass with protected files and runtime access
  unchanged; evidence distinguishes synthetic dependencies from production proof.
