# Development evidence

Baseline `f3a7f034ab0bfff60e8ad6c15a44eddadcbb94cb` plus this increment.
Verified 2026-09-06 UTC under isolated Node 24.20.0 / pnpm 11.19.0.
The final seven-group focused run passes. Full `pnpm check` passes: 95 kit
artifacts, workflow scope audit, typechecks, 88 prototype tests, 178 root controls,
seven package suites and builds. The lifecycle file now contains 55 tests.
Unchanged package tasks reused Turbo cache; the root synthetic accessibility
matrix ran again. The selected-runtime policy description was finalized and its
seven affected groups rerun successfully after that full run.

The original 48 lifecycle tests passed after shared-body extraction. The first
new negative groups and first full run failed because their exact expected result
omitted the new executionAuthorized=false field; actual results correctly denied.
The expectation was made explicit without loosening denial checks. Six focused
groups then passed. Review added a seventh group for exact selected provider keys,
archive-before-state chronology and unsupported hold-release claims; final checks
include those additional restrictions.

Eight full first/replay combinations cover four classes at one-/three-/seven-year
dates, with two copies/providers and a separate tombstone in each. Additional
cases cover one-nanosecond pre-boundary scheduling/denial, every copy/tombstone
proof omission, current holds/references/expiry, archive drift, known revocation,
provider identity/key mismatch and unsupported runtime classes. A different
still-valid original provider key cannot replace the selected successor key.
All actual results are zero-effect; candidate completion is not a real erasure.

`git diff --check` passes; frozen intent/0001, .github and lockfile diffs are empty.
The containing commit identifies publication.

Synthetic offline evidence only. No original key was extended, no real approval
or new provider access was obtained, and no erasure, trust deployment or archive
service was run. All five formal R5 findings remain open.
