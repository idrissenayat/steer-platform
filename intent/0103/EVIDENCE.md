# Development evidence

Baseline 206f9bb9774bdb7c3e98a4efee13aba62acd8b70 plus this increment.
Six new groups cover source/version reconciliation, actual structural validators,
fixture fidelity, all declared precision fields, fractional policy numbers and
scope limits. The runner records 307 passed, zero failed and 3,729 unmapped IDs.
An initial observation serializer rejected the detector registry's fractional
thresholds; ordinary JSON serialization now preserves those schema input numbers
without loosening the integer-only signed-record helper. This was a runner input
representation issue, not a source-policy or semantic-oracle change.

Final pnpm check passed on 2026-09-06 UTC under isolated Node 24.20.0 /
pnpm 11.19.0: 95 required kit artifacts, workflow scope audit, typechecks,
88 prototype tests, 324 root controls, package suites and builds. Unchanged
package tasks reused Turbo cache; the synthetic root accessibility matrix ran
again. A fresh invocation exactly matched EXECUTION-REPORT.json. Diff checks
passed; intent/0001, .github and lockfile diffs are empty. The containing commit
identifies publication; earlier execution snapshots are unchanged.
The migration schema remains unmapped, as do all 16 full accessibility cases.
No frozen artifacts, real credentials/providers, manual audit, independent verdict,
gate signature, deployment or spending changed. GAP-01 and all five formal findings
remain open; structural validation is not semantic acceptance.
