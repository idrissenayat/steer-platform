# Development evidence — 2026-09-08

Base: `43406901af9a1b1148c4f387419c566aebb8f90e`.

## Controlled reproduction

The existing Temporal clarification callback was repeated against actual disposable
PostgreSQL and Temporal, with synthetic SDK responses and authority. Before the fix,
20/20 repetitions without injected delay passed in 1,642–1,911 ms each. Each traced
4,716 pool acquisitions plus SQL calls. These include fixture setup and worker work,
but exclude direct pool/admin queries. They are not end-user latency measurements.

With two milliseconds injected before each traced query, the baseline passed once
in 13,951 ms (4,716 operations). At five milliseconds it reproduced attention-required
instead of needs-clarification: one model call, two observations and zero traced SQL
errors. A result insert was counted before failure. This establishes a controlled
latency-sensitive failure mode, not the exact cause of 0237's historical intermittent
failure or a proven specific timeout location.

After paired reads, the first five-millisecond run passed in 21,727 ms with 3,386
operations. A subsequent five-run repetition passed **5/5**, in 20,867–21,267 ms.
Each traced 297 connections, 296 commits, one rollback, two observation inserts,
one result insert, three execution writes and 2,786 other queries; zero SQL errors.
Compared with the healthy baseline, that is 1,330 fewer traced operations (28.2%)
and 121 fewer pool acquisitions. Existing assertions, deadlines and no-retry
controls were unchanged. The paired path still runs exact SDK verification.

Reproduce from the repository root with Node 24.19.0 on PATH:

```sh
node packages/data/test/postgres.integration.ts --clarification-repro 20
node packages/data/test/postgres.integration.ts --clarification-repro 5 --query-delay-ms 5
```

The runner explicitly says the full integration suite was NOT RUN. Focused counts
must never be substituted for full-suite results. Every completed focused run
removed only its own synthetic PostgreSQL container and tmpfs; no user data deleted.

## Verification

The final combined registry/data/adapter/agent/API/worker/web/domain and package/
migration-boundary regression suite passed **1,040/1,040** checks on Node 24.19.0.
The full disposable PostgreSQL suite passed **246/246** checks on PostgreSQL 16.14,
including actual isolated Temporal and native-Git fixture paths. All 27 migrations
apply twice without replay effects. No other full SQL suite overlapped this run.

Five new paired-read SQL checks cover exact stages/digests and caller key buffers;
missing stages, foreign configuration and current source/records denial or holds;
swapped ciphertext, late authorization denial and final-row mutation; wrong keys,
pending close and quarantined state; and separate historical request/response keys
with revocation at the final rotated-key check. Existing SDK, HTTP, clarification,
restart, cancellation, unknown-outcome and no-resend checks also pass. Two new unit
tests cover explicit bounded diagnostic selection and private-data-free traces.

Prototype and all eight packages pass typecheck. The optimized Next.js build,
Drizzle history check, kit validation (95 required artifacts), workflow token-scope
audit and whitespace checks pass. An earlier full run passed 245/245 before the
additional key-rotation case and final payload-limit review; the 246-check run
verifies the final behavior. No production timeout or existing assertion was relaxed.
Both completed full runs removed only their own synthetic containers/tmpfs data.

Protected SHA-256 values remain unchanged:

- Architecture: `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- Canonical Exam: `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- Accepted records policy: `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

No live runtime or UI acceptance is claimed. The user-owned untracked roadmap and
outputs are outside this increment.

## Limits

No new migrations or real policy/records activation. Current model/source/records
authority, approved first-test spend, scope success checkpoints and Temporal
composition, semantic quality and actual signed-in Git save/reopen remain open.
The API-key skill preserves the resolved credential decision; no credentials or
paid calls were used. D1 stays unsigned/inactive; no gate or deployment is enabled.
