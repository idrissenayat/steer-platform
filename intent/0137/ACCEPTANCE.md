# Development acceptance

Not a protected Exam or independent gate decision.

- A real signed identity assertion must match the verified gate record's digest,
  configured identity issuer, human subject, session and authentication time.
- Valid provider signatures cannot launder mismatched or forged identity evidence.
- Exact chronology rejects pre-key authentication, expired signing, later/future
  receipts and current key expiry/revocation without rounding nanoseconds.
- Both Git identity sources and both human-hat sources remain mandatory.
- Current head/identity changes, corrupt or oversized sources and unlisted paths deny.
- All reader modes share bounded admission and shutdown; late work cannot resume
  additional authentication after its deadline or outlive grant/key validity.
- Native Git exercises exact history/current sources and subsequent revocation.
- Original modes are not silently upgraded; no result authorizes a gate or write.
- Tests/typechecks/builds pass without altering protected artifacts or live access.
