# Evidence

Verification on 2026-09-06, isolated Node 24.20.0 / pnpm 11.19.0.
Adapter typecheck and all nine focused groups pass. The ninth exercises the real
15-second wall timeout, late-result rejection and single-flight backpressure.
The first full repository attempt passed kit/security/typechecks and all 88
prototype tests, but stopped at 436/437 root controls: the unchanged 0098 report
CLI subprocess hit its existing 30-second timeout (`status: null` rather than the
expected uncovered-coverage exit status 2). No new membership check failed.
The focused unchanged CLI case and full suite are being rerun sequentially;
the timeout, assertions and frozen coverage expectations are not relaxed.

The isolated unchanged CLI case passes in 61.7 seconds across its three report
modes and bad-option check. The unchanged full retry again reaches the first
CLI subprocess's 30-second limit (436/437 controls pass). This host reports 12
available processors; the automatic parallel runner also launches nested report
processes. To avoid that contention, root `test:controls` now explicitly caps file
concurrency at four. It still runs all control files, keeps the same subprocess
deadline and changes no expected result or coverage requirement. The complete
check is rerun after this runner correction, not replaced by a focused pass.

Final `npm exec --yes --package=node@24.20.0 -- pnpm check` passes (exit 0):
95 kit artifacts, security scopes, seven typecheck tasks, 88 prototype tests,
all 437 root controls, eleven package-test tasks and seven build tasks. Root
controls took 238.6 seconds; the previously timing-out CLI case passed all modes
in 66.1 seconds total with its original per-subprocess deadline. All 85 adapter
tests pass, including nine new membership groups and the real wall timeout.
Turbo reused seven typecheck, seven package-test and five build tasks. No heavy
browser or integration job overlapped these runs.

`git diff --check` is clean. No application imports or installs the new verifier.
The existing login resolver was not altered. Source/Gate 2 authority, the real
session wrapper and runtime enablement remain explicitly unfinished.

Fixtures compute actual SHA-256/Git blob SHA over synthetic authorization JSON and
control head, authentication and timing through trusted test seams. This proves
adapter binding/denial behavior, not a live GitHub authorization read or real OIDC
session verification. No callback is composed into production here. Existing
native Git/browser evidence is not claimed as a new integration run.

The audit confirmed that the existing gate observer is provenance-only and the
policy evaluator operates on normalized facts. Neither supplies full Gate 2 proof.
This increment retains that gap: successful output explicitly says gateVerified/
writeAuthorized false and fails the full write-authority schema in the tests.

No protected `intent/0001`, `.github`, lockfile, key, permission, UI, browser profile,
production data, deployment, spending or release changes. No new R5 coverage or
independent approval is claimed. All five findings and remaining scope stay open.
