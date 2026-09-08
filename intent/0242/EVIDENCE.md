# Development evidence — 2026-09-08

Base: `7959a81ca386b6d4abb7f646c779740c60421c27`.

## Implementation

An explicit one-review worker composition connects existing SQL batch ownership,
shared budget reservations, encrypted originals/request/response observations and
the actual pinned recorded SDK. Each request needs a fresh dispatch ACK and a newly
inserted request ACK. Recovery verifies the exact completed response without a
dispatch grant, gateway credentials, new reservation or provider call. Nothing is
installed in the real application by this factory.

## Focused verification and correction

`pnpm --filter @steer/data test:integration --scope-runtime` passes **14/14 scope
runtime checks**, plus the existing idempotent migration check, on disposable
PostgreSQL 16.14. This explicit focused command is not the full integration suite.

Cases cover 34 sources/two actual recorded SDK batches and API-reader recovery;
pre-/post-dispatch authority loss; competing workers; final identity revocation;
invalid/failed provider output; lost dispatch/checkpoint/request/response ACKs;
human edits before, immediately before and during dispatch; timeout, signal and
shutdown; key/source/profile/hold denial; a cancelled slow key; response-body cleanup;
abandoned pre-dispatch lease takeover; unknown/expired work and invalid gateway.
All provider responses, budgets, identities, keys and records/source grants are
synthetic. SQL roles/encryption/transactions and the pinned SDK code are real.

The added body-cleanup test first failed: after cancellation, another call returned
attention-required rather than busy while body cleanup was still pending. SQL
ownership still prevented resend, but the per-runner resource-admission promise was
wrong. The worker now tracks actual body reads/cancellation, including the SDK's
fire-and-forget cleanup; a late header response is cancelled while its transport
slot remains held. The same test then passes without a longer deadline, automatic
retry, rewritten response metadata or another model call.

Earlier test-fixture corrections supplied missing API owner-scope fields and used
a 100 ms rather than 1 ms abandoned lease so the initial synthetic claim could
commit before expiring. Neither changed production authority, deadlines or lease
rules. An intermediate full suite passed 284 checks before the final body-cleanup
case/fix; it is not the final corrected verification total.

## Final regression and build verification

- Full regression: **1,054/1,054 passed**, Node 24.19.0, including four new worker
  unit checks. Focused diagnostic/worker/dependency checks pass 16/16 and overlap
  that full total.
- Final full PostgreSQL 16.14 integration: **285/285 passed**, including all 14 new
  scope-runtime checks and the response-body cancellation correction. All 28
  existing migrations apply idempotently. Existing actual disposable Temporal
  development/save tests also pass; no new scope Temporal workflow is claimed.
- Prototype and all eight package typechecks pass. Optimized Next.js 16.3.4 build
  passes; no frontend code, preview, authentication or live binding was changed.
- Existing Drizzle migration history, kit (95 required artifacts), workflow scope
  audit and whitespace checks pass. No schema migration was added.

## Boundaries

No new migration/table/private result copy, real records adoption, key provisioning,
paid model call, runtime Git save, gate, deployment or release. The API-key skill
preserves the resolved credential choice without inspection or recreation. D1 is
unsigned/inactive and the first-test model budget is unapproved.

Reference-only scope Temporal, source preparation and actual editor integration,
real source/lifecycle/records/model authority, semantic quality and I1–I6 human
save/reopen acceptance remain open. Synthetic structural findings are not evidence
that the model correctly detects real-world duplicates or partial overlap.

Protected source SHA-256 values remain unchanged:

- `intent/0001/ARCHITECTURE.md`:
  `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- `intent/0001/EXAM.md`:
  `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- `intent/0001/reviews/domain/round-2/remediation/RETENTION-AND-RECORDS-POLICY.candidate.md`:
  `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

Each integration run removed only its own synthetic PostgreSQL container and tmpfs
data. Real application records and user-owned files were not migrated or deleted.
