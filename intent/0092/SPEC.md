# Specification · development candidate

## Separate staged profiles

0062 createStagedMigrationGraphVerifier uses steer-migration-context/v3 and
steer-migration-graph/v3 through the same complete exact-time verifier body.
Expand/contract must change schema; backfill must keep schemaFrom=schemaTo.
Original v1/v2 policies, grammar and outputs remain unchanged.

0091 createStagedMigrationCompatibilityVerifier uses explicit context/envelope
v2 with a separate policy and manifest. For each model family v1 or v2, expand
moves schema N→N+1, backfill stays at N+1, and contract moves N+1→N+2 while the
old/new app pair stays N/N+1. Every original executable model check remains.
These model coordinates are not production application binary verification.

## Independently approved chain

createMigrationChainVerifier accepts a closed steer-migration-chain-context/v1:
chainId, exact initial/final truth digests and 3–16 ordered steps. Every step names
unique stepId and batch/checkpoint coordinates plus its exact staged compatibility
context. The order is one expand, one or more backfills and one final contract.
All contexts share exact scope, implementation, database/schema/provider/runner
and column mapping. Approved definition/before-state pins remain per step.
Trusted selection/provenance is not established by caller-chosen matching hashes.

The closed envelope binds context/policy and contains 1–64 ordered attempts.
Every attempt supplies the step ID and complete staged compatibility bytes,
which in turn contain the full signed migration graph. No checkpoint, compatible,
CAS-winner or successful boolean substitutes for actual evidence.

## Continuity, coverage and time

For a new request, the current expected step must match the exact approved
phase/batch/checkpoint. Its complete before-truth bytes equal the predecessor's
complete after-truth bytes, including all six governance payloads and actual data.
The initial and final boundaries match trusted pins. App family is constant;
execution/plan IDs cannot move between steps. The successor before observation
must follow the predecessor/failed-attempt final result. Current result/replay/
reservation observation time is monotonic across supplied attempts.

Each successful backfill contributes a disjoint exact row set. Before contract,
their union must equal the entire original row inventory. A null-valued row still
requires coverage: unchanged bytes alone do not prove that its batch occurred.
Overlaps, gaps, reordered/skipped steps, changed before bytes and early snapshots
deny even when each supplied step independently passes.

## Interrupted attempts and replay

A signed refused-before-effect or independently restored/rolled-back attempt
must leave exact before-truth unchanged. It remains the current pending step.
A new complete attempt may retry using fresh request/idempotency/credential/CAS/
transaction identities and causally available before-state evidence. Successful
commit advances one step only. No caller flag can skip the complete verifier.

Request IDs, idempotency keys, credential IDs, CAS head pairs, reservation IDs and
provider transaction IDs belong to one immutable request across the entire chain,
including replay. Repeated evidence requires a committed replay record, exact
original request bytes, result digest and byte-identical non-action graph fields.
Fresh replay reservations cannot borrow another request's identity. Replay is
admitted only for the current or most recently completed step; it never advances
progress twice. A first observed record may itself be a fully verified committed
replay; it establishes its observed result without requiring a prior delivery.
replayCount counts repeated requests within this supplied chain, not unseen history.

## Results and bounds

An incomplete valid prefix returns verified-migration-chain-pending; only all
approved steps plus exact final truth return verified-migration-chain. Both
states are fact-only with executionAuthorized=false, liveCompatibilityVerified=false,
zero effects and journalEffects=0. The result binds every actual graph, executed
compatibility trace and result in an ordered evidence digest. No execution or
durable workflow-state authority is emitted.

Context is bounded to 524,288 UTF-8 bytes and envelope to 33,554,432, with 16 steps
and 64 attempts. Tighter nested migration/model limits remain. Empty/malformed
envelopes, unlisted stages and missing clock deny with content-free errors.

## Remaining boundaries

This verifies supplied complete signed step evidence with synthetic clients. It
does not implement durable chain-level CAS, database transactions, real app
concurrency, provider transport, historical long-lived migration proofs or every
crash cut. Failed/unknown partial provider states still block rather than becoming
completion. Full normative/source/class/trust-era coverage and independent
protected review remain; all five R5 findings stay formally open.
