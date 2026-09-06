# Brief

The per-request writer hook exists, but current Git membership must be composed
into its implementation instead of assumed from a plausible principal or gate
callback response. Join the real membership verifier, GitHub reader and writer
behind a session factory while keeping full independent gate verification required.

Demonstrate exact confirmed save/readback through HTTP and MCP using native
disposable Git. Preserve single-commit recovery, session/source rechecks, authority
expiry and default-closed runtime behavior. This does not replace existing gate
approvals, authorize production access or change the signed implementation scope.
