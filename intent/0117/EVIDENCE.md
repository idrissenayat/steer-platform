# Development evidence

Baseline e36fd33b03969047cc1d8e10b3a696101dd7a0c2 plus this increment.
Sixteen focused groups pass: eight new component/regression groups and eight
prior release-profile groups. The initial seven component-only groups also pass.
The full repository command passes all 411 root controls (143.9 seconds), 88
prototype tests, 95 required kit artifacts, security scope audit, typechecks and
builds. Unchanged package tasks use Turbo cache; their output is not a fresh run.
The separate full integration process passes three groups (98.7 seconds), executing
the full synthetic matrix and matching its saved report.

Commands use isolated Node 24.20.0: pnpm check; pnpm r5:coverage:test-full;
node --test tests/r5-derived-disposition.test.mjs tests/r5-release-lifecycle-ledger.test.mjs;
and scripts/run-r5-coverage.mjs --report / --full-report. Quick records 393 passed /
3,643 uncovered; full records 409 passed / 3,627 uncovered, both zero failures.
All 393 prior quick and 409 prior full observation digests/counts/outcomes compare
identical. Snapshots refresh the changed shared fixture source digest, not case
credit. The 0117 component is tested separately and is not imported by the ledger.

Complete/replay controls validate two children, four copies and six protected
actions through original full child verifiers. Genuine signed wrong-parent,
wrong-class, wrong-source and premature events pass the event-only verifier but
fail this composition. Shared-object/shared-credential children individually pass
full verification and fail when combined. Omission, digest-only, partial, wrong-copy,
borrowed, reordered, extra-field, pin, time and byte-limit controls deny safely.

git diff --check passes. Frozen intent/0001, .github and pnpm-lock.yaml are untouched.
Candidate publication is verified separately against the remote after commit/push.
These are synthetic retained facts, not actual deletion, complete parent manifest
or history, future archival validity, current action authority, independent review,
protected acceptance, a gate signature, release, deployment or spending approval.
All five formal R5 findings remain open; the complete twelve-coordinate lifecycle
remainder and migration/schema backlog are unchanged.
