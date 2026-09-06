# 0102 · Public signing-capability execution mappings

GAP-01 continuation: map all 17 declared private-domain signing requests against
the actual public signer. Every request has a working ordinary-record control,
then the exact private domain must fail without returning a signed record.
This retained API boundary is not cryptanalysis or real key-custody evidence.

The current snapshot records 293 passed, zero failed and 3,743 unmapped of 4,036
required IDs. Read BRIEF.md, SPEC.md, PLAN.md, development ACCEPTANCE.md and
EVIDENCE.md. execution-hooks.mjs feeds the 0098 runner; EXECUTION-REPORT.json is
a historical snapshot, never trusted as input. Earlier snapshots remain intact.

All 15 schema and 16 accessibility IDs remain unmapped. Old schema conformance
must not be equated with corrected schema adequacy, and streamed accessibility
rows must be captured as actual input evidence. All five formal R5 findings remain open.
