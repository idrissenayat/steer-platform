# 0068 · Source-faithful lifecycle retention rules

Corrects two mismatches with the exact accepted retention policy: rebuildable
records select the earliest supersession/rebuild event, and corpus provenance
waits for retirement and every derived-record deletion, not item closure.

The implementation remains in `intent/0061/lifecycle-graph.candidate.mjs`; its
policy digest changes, so earlier candidate graphs are not silently upgraded.
The regression suite is `tests/r5-lifecycle-graph.test.mjs`.

Read BRIEF, SPEC, PLAN, development ACCEPTANCE and EVIDENCE. Sixteen-class
retention-outcome coverage is not sixteen-class completed-disposition coverage.
All five R5 findings and independent/protected review remain open.
