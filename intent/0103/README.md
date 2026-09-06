# 0103 · Schema source reconciliation and execution mappings

SCHEMA-MAP.json preserves all 15 exact schema sources, digests and declared version
identifiers. Three cases execute the existing 0070 exact-time successors; eleven
execute retained record-format validators. The obsolete migration graph schema
remains unmapped instead of being credited as the corrected v2/v3 graph.

The current execution snapshot has 307 passed, zero failed and 3,729 unmapped of
4,036 required IDs. Read BRIEF.md, SPEC.md, PLAN.md, development ACCEPTANCE.md and
EVIDENCE.md. execution-hooks.mjs invokes actual validators through 0098. Old reports
remain intact; EXECUTION-REPORT.json is never used as runner input evidence.

These are structural checks only. Copied timestamp changes do not become valid
signatures, sample accessibility schemas are not a full/manual audit, and retained
formats are not every later profile. All five formal R5 findings remain open.
