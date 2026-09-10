# 0310 — Owned retained development-history service

## Contract

1. The actual API factory accepts an explicit trusted `development.ownedHistory`
   records/key binding only alongside `scope.ownedReads.history`. Absence preserves
   the established service. Invalid/partial bindings fail; an owned read failure
   never falls back. No environment flag, browser field or stored configuration
   supplies authority. Current generation, admission, scheduling and publication
   effects remain outside the history reader.
2. Metadata-only development discovery takes the exact operation ID/input digest.
   A separate, current records grant supplies its permission revision and retained
   budget ID. Execution-role/RLS metadata derives the real draft/revision; it must
   identify a development action and the exact subject/input. Full metadata must
   still agree before ciphertext retrieval. The decoded original must bind to the
   same budget; that binding is not spend approval.
3. Read only that development's original, results, observations and checkpoints.
   If its decoded direction names a recorded scope review, separately discover and
   read that exact review with independent scope grants and key purposes. Never
   invent a review ID or scan unrelated reviews. Legacy unbound originals do not
   trigger a scope read.
4. Join the already-authorized snapshots privately for the existing canonical
   SDK/worker/lineage verifier. Draft, revision set, lifecycle and budget must
   match. Shared rows must be identical. Reservations belong to disjoint exact
   operations and may not collide. This creates no merged grant, key lease or
   execution proof. Validate both role exchanges, predecessor/result/checkpoint
   digests, exact retained scope findings and the original source binding.
5. Recheck both actual records/key leases and existing original, result, source,
   scope-review and batch-history policies. Policy/service/provider replacement,
   revision changes, changed bytes, holds and incomplete verification reject.
   Final scope source authorization follows development source authorization and
   records/key readback. Return only the established public DTO and sanitized
   error; no wire payloads, secrets or raw record copies.
6. Preserve pending, partial, complete, clarifying and attention-required states.
   Only matching succeeded checkpoints produce outputs. Keep exact human-edited
   revisions distinct from original generation. Retained expired output remains
   historical and never grants execution/retry/semantic quality or a gate. A
   database/monotonic lifetime check prevents a stale unexpired flag at return.
7. Four-call admission and the existing 30-second bound remain. A private start
   handle distinguishes public result cancellation from actual drained work.
   Parent development work waits for its nested scope reader to drain, including
   a held key provider, before releasing admission. Factory shutdown drains both
   readers before closing their resources. No timeout increase or permission TTL.

## Verification

- Unit checks: exact development discovery, missing/changed grants, foreign action
  or subject, malformed/mutated metadata, no ciphertext before authorization,
  explicit factory binding, four held callers and actual SQL/key drain.
- Native SQL/SDK checks: owned/established DTO equality, separately revoked
  development/scope record/key/source policies, late revision/source loss, profile
  mismatch and nested key shutdown. Verify unbound pending/partial/complete,
  uncertain/clarifying and expired/superseded history without writes.
- Actual synthetic authenticated new-distinct and proposal-continuation journeys:
  separate recorded roles, durable corrections, exact confirmation, lost response
  recovery, fixed Temporal save, one native synthetic commit and exact reopen.
  Count all provider attempts; do not call undelayed smoke samples a p95 benchmark.
- Types, broad regression, architectural boundaries, kit and workflow scope audit.
  Retain failed iterations and distinguish final-source evidence from earlier runs.

C22 still requires every action, both directions, at most 200 provider attempts,
20 ms per attempt, p95 at most five seconds, 20 warm + 3 cold + 4 concurrent samples
and the negative cases. Next integrate remaining original/preparation/confirmation
read phases and effect-separated controls, then run that unchanged protocol.
Real records adoption, model quality, live saves and human UI acceptance remain
separate pending checkpoints; no new ETA or completion percentage is inferred.
