# Development acceptance

Not a protected Exam or independent gate decision.

- Require a current matching human session and all three save-related grants.
- Bind exact issuer, session, expected head, source path and both source hashes.
- Deny malformed/extra/uncurated input, duplicate/cross-tenant membership, inactive
  grants, moved head, source failure, switched sessions and expired observations.
- Reject unsupported time precision, backward/nonfinite clocks and stale fallback.
- Bound hung/concurrent work and withhold late results.
- Successful membership explicitly denies gate/write authority and cannot satisfy
  the full write-authority schema.
- Preserve login/runtime, protected files and actual provider scope; record the
  missing full proof/composition rather than implying it is complete.
