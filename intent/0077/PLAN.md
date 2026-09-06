# Plan

1. Compose original and current full lifecycle audits without changing signed bytes.
2. Bind an explicit terminal seal and independent original/current store proofs.
3. Require completed readback to be a no-op, never a fresh reservation.
4. Exercise retry, substitution, omission, fork, expiry and malformed-input cases.
5. Run repository checks, document evidence limits, commit and verify branch push.

## Next

Finish future-retention/key-rotation/reference coverage and make archival versus
current-authority behavior explicit without extending frozen keys. Then cover
remaining auxiliary-time and migration compatibility/checkpoint/crash-cut cases,
assemble the normative requirement-to-evidence inventory, and obtain independent
review before protected incorporation. Real terminal storage and transport recovery
remain integration work; do not report offline assertions as those results.

All five R5 findings remain open. No gate, signature, release, provider mutation,
deployment or spending is authorized.

