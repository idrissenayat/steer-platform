# Development evidence — 2026-09-08

Base: `8a6de5f42e452b3af9b20f178ca9bbc6c37a209f`.

## Implemented

Exact per-batch private scope-review preparation, a distinct pinned semantic role
at the existing recorded Mastra/LiteLLM edge, and a provider-free exchange verifier.
Current scope, corpus and complete profile policy bind every request. Validated
results compose with 0233 coverage without asserting semantic quality or authority.

## Verification

**1,034/1,034** combined registry, data, adapter, agent, API, worker, web, domain,
package-boundary and real-migration-hold tests passed on Node 24.19.0. The final
**17/17** focused request/scope-SDK/drafting-SDK tests also passed.

New cases cover exact current Brief/Spec and clarification context; 50-source
multi-batch preparation; deterministic identities; changed edits/head/profile/model
allowlist; omitted inherited Exam/history; UTF-8 request byte limits; exact SDK
serialization and raw receipts; cross-batch/stale-policy readback; fabricated
citations; invalid model/refusal/tool/usage output; missing acknowledgements;
cancelled/late responses; and incomplete aggregation after omissions, abstentions
or access gaps. The existing drafting-role serialization/error tests remain green.

**209/209** disposable PostgreSQL integration checks passed on PostgreSQL 16.14,
including the existing encrypted originals, recorded model, request/result recovery,
HTTP service and Temporal paths. This verifies compatibility of the shared
transport refactor with existing durable drafting/saving fixtures; it is not a new
durable scope-review workflow test. Cleanup removed only that run's own synthetic
PostgreSQL container and tmpfs data, never operational records.

Prototype and all eight packages pass typecheck. Optimized Next.js production
build, kit validation (95 required artifacts), workflow token-scope audit and
whitespace checks pass. No UI or active runtime configuration changed.

Protected SHA-256 values remain unchanged:

- Architecture: `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- Canonical Exam: `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- Accepted records policy: `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

## Limits

All provider responses, findings, gateway credentials and acknowledgement/authority
hooks are synthetic. The SDK serialization is real; no live provider or paid model
was called. The existing credential decision was left untouched under the API-key
skill. No real D1 records, migration, grant, key, runtime service, Git save, gate,
deployment, release, spending or signed artifact changed.

The new adapter is uninstalled. Distinct durable scope batches, encrypted
observations, approved per-call reservations and Temporal/current-authority binding
remain next, along with live semantic evaluation, UI/save integration and I1–I6.
An adapter that enforces acknowledgement hooks is not evidence those hooks are
backed by real durable records or authorization. Tests clean only their own fixtures.
