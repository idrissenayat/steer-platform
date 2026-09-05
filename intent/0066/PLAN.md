# Implementation plan

1. Inspect the direct public oracle rather than relying on 0060's separate scope.
2. Compose explicit-time verification, current authority, full observation and
   immutable request derivation before both first and replay branches.
3. Exercise all 32 original cases, all ten signatures/native time fields,
   coherent old-accept/new-deny counterexamples and currentness/input boundaries.
4. Run root/frozen-install checks, document evidence and publish the verified
   development branch without touching protected records.

Next: accessibility and complete public-oracle timing inventory, followed by
remaining lifecycle/migration normative coverage and independent/protected review.
