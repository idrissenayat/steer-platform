# Development evidence — 2026-09-08

Base: `ce0ab6b6344c4ba34ebff12638f1535503474b1b`.

## Implementation

Response-bound metadata checkpoints, two-pass verified completion outside SQL
leases, exact success replay and a composed encrypted-reader/SDK verifier. Successful
readback remains bound to the response digest; quarantine and failed states return
no completion reference. Migration 0027 adds no table or private result copy.

## Verification

The first actual SQL/SDK checkpoint and restart case passed. The following test
initially supplied a batch target to the strict review-only inspection API; it was
corrected to use the exact review/preparation target. Production validation was
not relaxed. The failed run removed only its own synthetic container/tmpfs data.

The new metadata-reference unit check and existing scope metadata/configuration
unit checks pass (3/3). The full regression suite passes 1,041/1,041 checks on
Node 24.19.0. The final, non-overlapping PostgreSQL 16.14 integration run passes
256/256 checks with all 28 migrations applied; it removes only its own synthetic
PostgreSQL container and tmpfs data after completion.

Ten new integration cases cover verified completion/restart/exact replay, missing
or incorrect proof, lost checkpoint acknowledgement, quarantine or known failure
during readback, current authority and lifecycle denial, restricted SQL privileges
and temporary-table shadowing, lifecycle lock contention, stalled verifier
admission and shutdown, simultaneous completion acknowledgements, and a hold
recorded after readback but before the checkpoint write. The preceding 254-check
run also passed before the final two concurrency cases were added.

Prototype and all eight package typechecks, the optimized Next build, Drizzle
history check, kit validation (95 artifacts) and scope audit pass. These are
development checks, not browser or live-provider acceptance.

Protected source SHA-256 values remain unchanged:

- `intent/0001/ARCHITECTURE.md`:
  `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- `intent/0001/EXAM.md`:
  `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- `intent/0001/reviews/domain/round-2/remediation/RETENTION-AND-RECORDS-POLICY.candidate.md`:
  `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

## Limits

All identity, source/records authority, budgets, keys and provider responses are
synthetic. The API-key skill preserves the existing credential decision without
exposing or recreating credentials. No actual migration, records-policy adoption,
provider call, model spend, runtime Git save, gate, release or deployment is enabled.
Completed-batch consumption, reference-only Temporal, expired observation access,
real authority, semantic evaluation and actual UI/save acceptance remain next.
