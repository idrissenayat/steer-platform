# Implementation plan

1. Extract shared authorized projection lifecycle into the adapter layer.
2. Reuse it from the API and add the worker's explicit PostgreSQL composition.
3. Add worker runtime and shared-job denial/drain/failure regression tests.
4. Extend the actual Temporal harness with synthetic Git grants and disposable
   PostgreSQL; verify recreation, duplicate-safe readback, repair and revocation.
5. Run full checks, document exact evidence and remaining gaps, commit and push
   the verified candidate without changing signed or protected records.
