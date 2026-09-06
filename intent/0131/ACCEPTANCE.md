# Development acceptance

Not a protected Exam or independent gate decision.

- Current agent authorization, exact head, configured trust pin and proof digest
  are required before returning provider evidence.
- Every source coordinate, both hashes, UTF-8 and size/canonical bounds are checked.
- Missing/corrupt/changed sources and fresh revocation never use cached evidence.
- Key revocation/expiry remains enforced after a source pin update.
- Head movement, backwards/invalid clocks and final-read expiry discard results.
- Timeout rejects without accumulating overlapping work; shutdown drains owned work.
- Immutable output is explicitly no gate/no write authority.
- Focused and full checks pass without real provider access, trust keys or runtime
  activation. Original approval records and protected evidence are unchanged.
