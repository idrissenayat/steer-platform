# 0309 — Owned current and historical scope reads

## Contract

1. The trusted API factory may supply separate `scope.ownedReads.current` and
   `scope.ownedReads.history` bindings. Both require independently versioned
   metadata/record grants, existing-key services and the existing configured role
   profiles. A missing binding retains the established reader. An incomplete or
   invalid binding fails construction; a failed owned read never falls back.
   No public tool, profile/environment flag or browser input supplies these grants.
2. Metadata-only target discovery takes the exact review ID, preparation digest
   and current/history mode. Its independent current records grant binds the
   retained budget ID; configuration strings and corpus permission revisions are
   not records authorization. An execution-role/RLS query discovers draft ID and
   revision from the exact run. No placeholder operation ID is used. The complete
   subsequent metadata must match this discovery before any ciphertext is fetched.
   Decoding/SDK verification must bind the retained original to the same budget.
3. Every selected record and key purpose is authorized independently. The existing
   original, draft, review, batch, source and exact-profile policies still apply;
   historical access never calls an old execution grant. Source checks bracket
   verification and close after final key/records readback. All read-set work is
   read-only and ends before any admission, scheduling or publication effect.
4. Use canonical encrypted codecs and actual SDK/worker verification once per
   owned snapshot. Return the established current/history DTOs, not wire payloads,
   key material, private checkpoints or plaintext record copies. Only succeeded
   matching checkpoints contribute results. Pending/unknown responses never imply
   completed assessment, uniqueness, retry, execution, semantic quality or a gate.
5. Current expiry discovered before content retrieval excludes observations,
   batch states and reservations; it returns only the established expired result
   after authorized original/source validation. An initially unexpired current
   read carries its database/monotonic expiry through return. Retained history can
   display expired evidence but must not return a stale `reviewExpired: false`
   after expiry during its final caller check. Draft/candidate lifecycle, holds,
   immutable metadata and fresh key/record grants remain mandatory.
6. Four actual pending calls and the existing 30-second limit include discovery,
   policies, database work and consumer callbacks. Public cancellation does not
   release admission before actual work drains. Changed service/policy/provider
   identities reject; factory shutdown drains readers, including the private
   reader owned by development preparation, before resource shutdown.

## Verification and boundary

- Compare current and historical HTTP outputs against the established reader for
  pending, partial, completed, uncheckpointed, superseded and expired reviews.
- Exercise missing/changed discovery grants, wrong budget or owner, metadata
  races, record/key/source denial, late policy changes, hold, profile mismatch,
  final-caller expiry and cancelled in-flight discovery. Verify unchanged records,
  reservations and provider/model counts.
- Run the actual synthetic authenticated default and proposal-continuation
  journeys, including fixed workflows, lost acknowledgements, exact confirmation,
  idempotent native save and restart/reopen. Count every provider attempt.
- Run broad regressions, types and package-boundary checks. Evidence must
  distinguish fixtures from live authority and whole-action counts from latency
  acceptance. The 200-attempt ceiling, 20 ms delay, five-second p95, full
  warm/cold/concurrent protocol and all 25 acceptance checkpoints are unchanged.

The next integration is development originals/results/history and remaining
effect-separated action controls. Scope reading alone cannot close C22; live
records adoption, model quality, actual runtime saves and human UI acceptance
remain separate pending checkpoints.
