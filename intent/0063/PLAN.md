# Implementation plan

1. Inspect the original privacy/cost records and distinguish signed event times
   from validity intervals and genuinely absent issuance fields.
2. Add a closed composed audit using 0058, a trusted explicit evaluation clock,
   independent exact-byte observation and mandatory 0056/0057 checks.
3. Test original accepted counterexamples, every signature slot, time boundaries,
   observation substitution, permutations and the 64-line limit.
4. Run root checks/frozen install; verify protected files unchanged; update the
   delivery and correction ledgers and publish the development branch increment.

Next: finish non-reconciliation cost/spend and recovery/public-oracle timing
coverage, then the full lifecycle/migration normative inventory. No blanket R5
closure or new qualified-human ruling before independent/protected acceptance.
