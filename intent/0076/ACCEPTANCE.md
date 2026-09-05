# Development acceptance

- [x] Explicit raw-v4/chain-v1/checkpoint-v2/batch-v3 version boundaries.
- [x] All 27 monotonic two-checkpoint partitions pass with original inputs unchanged.
- [x] Repeated/no-progress cuts and the 33-step nanosecond capacity boundary pass.
- [x] Missing/reordered/duplicate/forked predecessors and repeated head values deny.
- [x] Full current/predecessor reservation proofs bind every continuation.
- [x] Fresh inventory/history/hold/reference checks apply at every step.
- [x] Late, premature and known-held erasure receipts deny at nanosecond precision.
- [x] Omitted/forged proofs and tombstone approvals missing the chain binding deny.
- [x] Full repository checks and protected-diff verification complete.

No actual restart, durable store, terminal consumption seal or gate acceptance.
