# Development evidence — 2026-09-08

Base: `178c3706ecf42c82c9e79202e7b62f2020b2c191`.

## Implemented

Provider-free whole-target planning, exact batch/result validation and planning
metadata in the actual recorded-review service and production editor. All declared
provided bytes are verified; missing context and results remain incomplete.
The legacy generation gate and all live authority boundaries are unchanged.

## Verification

**1,023/1,023** combined registry, data, adapter, agent, API, worker, web, domain,
package-boundary and real-migration-hold tests passed on Node 24.19.0. The eight
new batch tests cover 50-source planning, stable ordering, changed scope/source/
permissions, canonical/amendment grouping, missing/blank/oversized context, the
eight-batch cap, incomplete aggregation, wrong profiles and fabricated citations.

The native-Git/HTTP review test verifies the new plan metadata alongside exact
Brief/Spec source bytes. The production React component test exercises the actual
editor and transport graph under synthetic HTTP responses, checks the named plan
section and zero-call explanation, and preserves the existing review/clarification/
recovery/adoption journey. Browser transport tests reject altered planning digests
and fabricated started-call counts. This is component/DOM evidence, not visual or
live signed-in acceptance.

**209/209** real disposable PostgreSQL integration checks passed on PostgreSQL
16.14, including recorded-review HTTP/SQL paths and the existing durable
preparation, recovery and Temporal fixtures. Only the run's own synthetic
PostgreSQL container and tmpfs data were removed by its cleanup. No operational
database or records were used or migrated.

Prototype and all eight packages pass typecheck. The optimized Next.js production
build, kit validation (95 required artifacts), workflow token-scope audit and
whitespace checks pass. The required review metadata field is updated consistently
in the server, portable verifier and web fixtures; stored original formats and
legacy generation eligibility are unchanged.

Protected SHA-256 values remain unchanged:

- Architecture: `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- Canonical Exam: `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- Accepted records policy: `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

## Limits

Planning is not model execution or semantic quality. Citation fixtures use synthetic
findings; current source/access/lifecycle authorities in integration tests are
synthetic. No live models, provider authority or real saved-repository acceptance
is claimed. D1 remains inactive and the proposed first-test model budget remains
unapproved. Larger source fetches/context, durable semantic execution/evaluation,
real authority binding, authorized save/reopen and I1–I6 acceptance remain open.

No real records/configuration/key/grant/migration, runtime Git save, gate,
deployment, release, spending or protected artifact was changed. User-owned files
are preserved. Disposable tests may clean up only their own synthetic fixtures.
