# 0104 · Streamed accessibility execution and explicit coverage profiles

The full runner now executes all 16 original synthetic accessibility cases. The
positive consumes 32,900 raw rows and verifies 2,664,900 matrix cells. Every negative
requires that exact positive execution from the same run. Actual consumed prefixes
are length-framed and hashed, with iterator closure and exhaustion recorded.
Neither metadata nor a saved report substitutes for row execution.

The v2 report has two fixed profiles. Quick records 307 passed and 3,729 uncovered,
explicitly leaving the 16 heavy cases unexecuted. Full records 323 passed and
3,713 uncovered. Both have zero failures and incomplete coverage. All five formal
R5 findings remain open; manualAuditComplete and executionAuthorized stay false.

Read BRIEF.md, SPEC.md, PLAN.md, development ACCEPTANCE.md and EVIDENCE.md.
QUICK-EXECUTION-REPORT.json and FULL-EXECUTION-REPORT.json are historical snapshots.
Run `pnpm r5:coverage:report`, `pnpm r5:coverage:full-report` and
`pnpm r5:coverage:test-full` for fresh evidence. No imported report is accepted.

The default/require-complete command fails early with explicit quick-profile
evidence when unmapped full-profile cases already prevent completion. Once every
full-profile case has a hook, it executes the full profile before it can succeed.
This preflight cannot waive cases or authorize any action.
