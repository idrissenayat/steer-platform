# Development acceptance

- Real synthetic Ed25519 verification binds every selected scope and report/run field.
- Re-signed substitutions, tampering, wrong key/domain and malformed profiles reject.
- Independence contradictions and shared Builder/reviewer identities or runs reject.
- Exact-time activation, expiry, revocation and event ordering remain mandatory.
- Actual native Git collection retains source hashes and original review bytes.
- Missing configured proof or stale final-time key cannot fall back to raw review.
- Invalid startup source aliases and missing run identities reject before reads.
- All tests/builds pass without changing protected artifacts or architectural boundaries.
- Results remain non-authority; no live provider or runner configuration is created.

