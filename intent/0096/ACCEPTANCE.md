# Development acceptance · not a protected EXAM

- Full two-slot sequences verify with all five signed observation records.
- A pending older sequence independently verifies, but a newer canonical head denies it.
- Every source requires its signature, correct domain, exact nonce and query/scope pins.
- Exact retained bytes and storage version are checked, not just caller digest claims.
- Changed heads during object read, unknown state and pre-commit outcomes deny.
- Nanosecond chronology and current expiry apply without renewing prior evidence.
- Closed context/envelope and a different factory-selected challenge reject substitution.
- Repeated readback stays effect-free and explicitly reports no real store query.

Synthetic source records do not establish live adapter behavior, global currentness,
production durability, manual accessibility, gate approval or formal R5 closure.
