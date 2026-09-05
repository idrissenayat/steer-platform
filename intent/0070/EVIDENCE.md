# Development evidence

Baseline `1f2deac2e2ee4470962b113a851e41ebf30eea4a` plus this increment.
Synthetic signed evidence only. No real provider, key or disposition operations.

Verified 2026-09-05 UTC. Focused human/event/lifecycle/action tests pass; the final
focused schema/action/lifecycle selection has 25 passing groups. Six new root
groups cover composed precision, exact deadline/cap denial, hostile chronology,
seven-action lifetime/earliest-expiry behavior and explicit schema validation.

Complete first/replay graphs pass with fractional offsets and with individual
event/action steps separated by one nanosecond. They retain two provider copies,
separate human/tombstone authorities and three full shared actions. One-nanosecond
late raw erasure, premature capped requests, reversed chronology, receipt before
reservation and aggregate/tombstone timing substitutions deny with zero effects.
These synthetic raw positives do not satisfy the separate full three-key and
pre-terminal-grant policy obligations.

Every shared action returns the true earliest expiry when whole-second and
fractional timestamp strings sort differently; expiry at the exact instant denies.
A 300-second credential lifetime passes, while 300 seconds plus one nanosecond
denies. Both explicit schemas and all six human time fields (including embedded
raw authority) reject impossible dates/unsupported precision. Original schema
registries remain unchanged and still reject fractional source records.

Root `pnpm check` passed under isolated Node 24.20.0 / pnpm 11.19.0: kit (95
required artifacts), workflow scope audit, typechecks, 88 prototype tests, 117
control/correction tests, all seven package suites and builds. Unchanged package
tasks reused Turbo cache. Root accessibility matrix tests ran again; no new real
browser/provider/storage/Temporal integration or manual audit is claimed.

`git diff --check` passes; frozen intent/0001, .github and lockfile diffs are
empty. Source/successor schema and policy digests identify the changed candidate
semantics. No old signed evidence is upgraded. Publication is identified by the
containing Git commit; all five formal findings and independent review remain open.
