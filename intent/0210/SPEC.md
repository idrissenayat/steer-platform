# Spec

- Validate configured owner/product/repository/branch/item, complete bundle rules
  and exact consent before durable admission. Reject caller-selected operation IDs.
- Hash the schema-canonical complete submission plus publication/provider profile
  in a versioned admission domain that excludes the not-yet-minted operation ID.
  Reuse the SQL operation on exact resubmission; changed input or profile conflicts.
  The eventual server ID remains part of the final v2 step/receipt digest.
- Require the exact admitted operation before any provider access. Reconstruct the
  plan from original input, never a caller's proposed file list or plan object.
- Validate current lifecycle/full-corpus/source, consent, grant/gate and time proof
  from trusted ports before claiming. Atomically consume the existing SQL one-way
  dispatch permission; only unambiguous acknowledgement releases the proof to Git.
- Once the dispatch boundary is recorded, use read-only provider recovery even
  through a new adapter instance. Receipt absence remains unknown; duplicate calls,
  provider rejection and lost SQL/Git responses never unlock another send.
- Keep current authorization on recovery and preserve exact saved bundle bytes.
  Bound/close work using the existing SQL and provider adapters, with no automatic
  retries, new operation on failure, refund or bypass of the local migration hold.
- No runtime bootstrap, paid model, real GitHub call, new grant or records adoption.
  Real authority services and original-payload persistence remain required ports.

This increment does not implement Temporal binding, encrypted draft/result storage,
unknown-outcome resolution or receipt-to-SQL-success checkpoint promotion. The
dispatch journal and verified provider observation remain distinct evidence.
