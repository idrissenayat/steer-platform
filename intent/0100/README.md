# 0100 · Authorization, money and privacy-time execution mappings

GAP-01 continuation: 86 new exact required-ID mappings cover 32 authorization,
20 spending and 34 cost cases. The 19 already-mapped privacy graph IDs now use
the complete 0063 independent-time composition instead of the narrower 0056 path.
They are not credited twice. The current snapshot is 201 passed, zero failed and
3,835 unmapped of 4,036 required IDs. All five formal R5 findings remain open.

Read BRIEF.md, SPEC.md, PLAN.md, development ACCEPTANCE.md and EVIDENCE.md.
The closed synthetic execution-fixtures.mjs and execution-hooks.mjs feed the 0098
runner. EXECUTION-REPORT.json is a reproducible historical snapshot, never accepted
as input evidence; earlier snapshots stay intact. Supplemental source digests
identify these hook/fixture bytes, not the entire dependency graph.

Original authorization is not the separate 0060 lifecycle/migration shared-action
contract. Synthetic spending verification is not permission to spend. Original
one-line reconciliation cases do not resolve R5-004's multi-line counterexample.
