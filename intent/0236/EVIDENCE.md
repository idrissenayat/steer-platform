# Development evidence — 2026-09-08

Base: `c9cd53979131b12feb3f8592eea19e9e3a7b4938`.

## Implemented

Strict source-faithful scope originals, bounded authenticated multi-part encryption
and immutable admitted-review capture/recovery using current records, source and
draft-key authority. Recovery preserves historical configuration without renewing
execution. Exam and inherited role context are excluded from stored scope inputs.

## Verification

**1,038/1,038** combined registry/data/adapter/agent/API/worker/web/domain and
package/migration-boundary checks passed on Node 24.19.0. Both new focused contract
and envelope tests passed: exact manifest reconstruction, excluded Exam/credentials,
branch binding, large Unicode bytes, chunk count/order/duplication, wrong AAD/key,
bounded payload and preservation of the caller-owned key.

**230/230** disposable PostgreSQL checks passed on PostgreSQL 16.14, including
**eight new scope-original checks**: multi-batch input larger than the single-envelope
bound; concurrent capture/lost acknowledgement and immutable recovery; explicit
historical expiry without execution renewal; newer edits and rejected stale capture;
current owner/source/records/key/lifecycle denial; forced RLS and rejected metadata,
envelope extras, wrong roles and mutations; chunk reordering/transplantation and final
draft-key revocation; and shutdown during a pending key lookup. The fixtures verify
exact recovered scope/profile/manifest, excluded Exam and zero reservations during
original capture. Existing recorded development, native-Git fixtures and Temporal
paths remain compatible. Both migrations apply only inside the disposable database;
the harness verifies migration replay and removed only its own synthetic PostgreSQL
container/tmpfs data, never operational records.

Prototype and all eight packages pass typecheck. Optimized Next.js build, Drizzle
migration-history check, kit validation (95 artifacts), workflow token-scope audit
and whitespace checks pass. The existing real-local migration hold remains closed.

Protected SHA-256 values remain unchanged:

- Architecture: `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- Canonical Exam: `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- Accepted records policy: `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

## Limits

This is exact input recovery, not response/result checkpoint recovery. The original
is bounded to 2 MiB and eight encrypted parts; exceeding the bound fails explicitly.
All SQL, keys, approvals and source/access authority in checks are synthetic and
disposable. No real D1 records, migration, grant, key, model/provider call, runtime
Git save, gate, deployment, release or spending was enabled. The API-key skill leaves
the existing credential decision unchanged. Protected signed documents are not edited.

Next: immutable scope request/response observations, verified result checkpoints and
reference-only Temporal under real source/lifecycle/records/model authority, then
larger-corpus/semantic evaluation, actual UI save/reopen and I1–I6 human acceptance.
