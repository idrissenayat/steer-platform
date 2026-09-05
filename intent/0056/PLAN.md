# Implementation route

1. Verify pinned Unicode data and reproduce the exact frozen R5 counterexamples.
2. Implement a bounded portable normalizer/detector with complete decimal coverage.
3. Add an explicit policy-bound correction around the unchanged privacy graph;
   preserve all base validation, signed bytes and zero-effect behavior.
4. Test exact graph acceptance/rejection, every prompt position, encoding and
   length boundaries, all prior privacy cases, and frozen-package integrity.
5. Update the delivery ledger and publish only after relevant/root checks pass.

Next targeted correction is R5-004 multi-line cost reconciliation, followed by
the shared-authority/lifecycle/migration corrections. Review and protected
incorporation follow the complete corrected candidate; no repeated broad loop.
