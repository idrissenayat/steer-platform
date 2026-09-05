# Implementation plan

1. Trace all six accessibility record signatures and the raw matrix consumer.
2. Add explicit-time/provider binding preflight, current qualification/assignment
   and bounded row chronology without replacing original matrix verification.
3. Exercise the complete synthetic matrix, all 16 original cases, pre-key old
   acceptance, signature/currentness failures, iterator cleanup and input bounds.
4. Inventory every original public oracle and verify source/export/test coverage
   and production isolation, without calling that inventory formal acceptance.
5. Run root/frozen-install checks, preserve protected records and publish verified
   code, evidence and documentation on the development branch.

Next: complete lifecycle retention/compound/reference/parent/future-key coverage,
then migration compatibility/concurrency/checkpoints and the normative package.
Do not extend frozen keys merely to make long-retention tests pass; resolve the
archival/current-authority trust distinction explicitly before accepting them.
