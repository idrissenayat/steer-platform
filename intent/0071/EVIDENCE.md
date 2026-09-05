# Development evidence

Baseline `7f5b1e2408c583b93d192c8bfdd3ac128c794e57` plus this increment.
Synthetic signed events only. Focused event/lifecycle suites pass: 24 groups.
Verified 2026-09-05 UTC. Four new root groups exercise 200 signed rank/UUID
pairings, the full ten-event tied sequence, all 17 unranked type denials,
signature/schema/scope/provider failures, UUID case-alias replay, time reversal,
mixed zero fractions and the 128-history bound. Actual composed graphs retain
active holds, accept matched release and reject unmatched release at the same
instant. Zero effects are asserted; no actual records operation is claimed.

Root `pnpm check` passed under isolated Node 24.20.0 / pnpm 11.19.0: 95 kit
artifacts, workflow scope audit, typechecks, 88 prototype tests, 121 root
control/correction tests, all seven package suites and builds. Unchanged package
tasks reused Turbo cache; the root accessibility matrix ran again. No fresh
real-browser/provider/storage/Temporal integration or manual audit is claimed.

`git diff --check` passes; frozen intent/0001, .github and lockfile diffs remain
empty. Publication is identified by the containing Git commit. Complete
retention/rotation/raw/reference/migration evidence and independent/protected
review remain open; no formal finding or gate is closed.
