# Development evidence — 2026-09-08

Base: `1dec0de51b0185b78e55934aa7ecf254e2e35ed6`.

## Implementation

A read-only combined scope consumer restores immutable originals and successful
exact response checkpoints, runs the existing whole-corpus result validation and
rechecks the source and batch snapshot. There is no new table, migration, result
copy, model send, API/UI binding or runtime activation.

## Verification

- Full regression suite: **1,043/1,043 passed** on Node 24.19.0, including the two
  new reader contract and timed-out-admission unit checks.
- Full PostgreSQL 16.14 integration suite: **265/265 passed**, including nine new
  reader cases. Existing 28 migrations apply idempotently; no migration was added.
- Prototype and all eight package typechecks, optimized Next production build,
  Drizzle history check, kit validation (95 required artifacts), workflow token
  scope audit and whitespace checks pass.

The new actual SQL/recorded-SDK cases cover a 34-source, two-batch review from
pending to partial to full results and exact reconstruction without another model
send or reservation; exclusion of uncheckpointed/unknown/failed work; no-match
findings with incomplete inventory/access coverage and model abstention; newer
human corrections; expired metadata-only access; current identity/source/records/
key/codec denial; a second batch completing mid-read; holds and close; and read-only
SQL with corrupted checkpointed ciphertext rejection. A reader is recreated for
recovery checks; no in-memory result map substitutes for durable observations.

The completed integration runner removed only its own synthetic PostgreSQL
container and tmpfs data. It did not migrate or delete real application records.

Protected source SHA-256 values remain unchanged:

- `intent/0001/ARCHITECTURE.md`:
  `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- `intent/0001/EXAM.md`:
  `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- `intent/0001/reviews/domain/round-2/remediation/RETENTION-AND-RECORDS-POLICY.candidate.md`:
  `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

## Boundaries

Source and records authority, identity, keys, budgets and provider responses are
synthetic. The API-key skill preserves the existing credential decision; no key
inspection, creation or paid call occurs. D1 remains unsigned/inactive, and the
proposed first live model test budget is unapproved.

No real migration, records adoption, gate, runtime Git save, deployment, release or
spending is enabled. Actual query/UI and reference-only scope Temporal composition,
expired observation access, real source/lifecycle authority, semantic quality and
I1–I6 human/save acceptance remain open. Protected signed sources remain unchanged.
