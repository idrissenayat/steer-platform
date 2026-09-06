# Development evidence

Baseline ff51abe49e2aa0bce6be981df41697d3ca498b9d plus this increment.
Four new focused groups exercise all 17 exact private-domain requests, working
public controls and cross-domain verification rejection. The current runner
records 293 passed, zero failed and 3,743 unmapped IDs. Schema and accessibility
are not credited by this increment.

A separate actual 0067 positive synthetic accessibility benchmark completed in
approximately 16.25 seconds: 32,900 raw rows, 2,664,900 expanded matrix cells,
six timed records, two observed-as-of records, zero effects, manualAuditComplete
and executionAuthorized both false. This benchmark is not a coverage snapshot,
performance SLA, browser/manual audit or live accessibility evidence.

Final pnpm check passed on 2026-09-06 UTC under isolated Node 24.20.0 /
pnpm 11.19.0: 95 required kit artifacts, workflow scope audit, typechecks,
88 prototype tests, 318 root controls, package suites and builds. Unchanged
package tasks reused Turbo cache; the synthetic root accessibility matrix ran
again. A fresh invocation exactly matched EXECUTION-REPORT.json. Diff checks
passed; intent/0001, .github and lockfile diffs are empty. The containing commit
identifies publication; earlier execution snapshots are unchanged.
No protected artifacts, real credentials, provider/store, deployment, spending,
independent verdict or gate signature changed. All five formal findings remain open.
