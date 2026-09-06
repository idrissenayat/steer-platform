# Development acceptance

Not a protected Exam or independent gate decision.

- Actual ephemeral Ed25519 signatures are verified against exact expected facts.
- Payload tampering, wrong keys/protocol, scope/session/evidence substitutions and
  serialization ambiguity return null.
- Agent/qualification/approval-field injection cannot become human proof.
- Activation/expiry/revocation and all chronology boundaries preserve nanoseconds.
- Returned evidence is immutable and explicitly cannot authorize gate or writes.
- Gate-source composition binds the exact record digest; a later changed record
  rejects reuse of the earlier proof.
- Old provider-recorded metadata is not upgraded into a signed attestation.
- Focused/typecheck/full verification pass without real credentials, provider
  traffic, installed trust keys, protected edits or runtime activation.
