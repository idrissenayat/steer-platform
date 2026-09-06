# 0101 · Detector and multi-line reconciliation execution mappings

GAP-01 continuation: map 74 previously unmapped identifier/detector cases and the
single R5-004 multi-line counterexample. The current snapshot has 276 passed,
zero failed and 3,760 unmapped of 4,036 required IDs. The ten existing phone
detector cases are not counted again; 32 cost orderings remain observations
inside one counterexample ID, not extra required cases.

Read BRIEF.md, SPEC.md, PLAN.md, development ACCEPTANCE.md and EVIDENCE.md.
Closed synthetic execution-fixtures.mjs builds exact two-line evidence;
execution-hooks.mjs invokes actual detector/corrected cost code through 0098.
EXECUTION-REPORT.json is a reproducible snapshot, never trusted as runner input.
Earlier reports remain intact; supplemental source digests identify hook/fixture
bytes, not the entire transitive dependency graph.

Non-phone classification remains the unchanged component used by the corrected
privacy graph. Exact detector cases are not full corpus acceptance. R5-004's
counterexample execution is not formal closure: all five findings remain open.
