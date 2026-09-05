# Development evidence

Baseline `b6015488189835cf3710a7f0c82e970a40427640` plus this increment.
Synthetic signatures only. No real keys, trust-window extension or provider calls.

Focused precision, human, lifecycle and protected-action suites pass (30 groups).
Verified 2026-09-05 UTC. Root `pnpm check` passed under isolated Node 24.20.0 /
pnpm 11.19.0: 95 kit artifacts, workflow scope audit, typechecks, 88 prototype
tests, 111 control/correction tests, all seven package suites and builds.
Unchanged package tasks reused Turbo cache; the root accessibility matrix ran
again. No fresh browser, real provider, storage/Temporal integration or manual
audit is claimed.

New tests establish 2,001 deterministic exact round trips, year/epoch limits,
calendar-year clamps, individual-nanosecond parent caps and key windows,
activation/expiry/revocation, strict malformed-input/overflow denial, and actual
Ed25519 signatures under isolated old/future keys. Future-key acceptance only
applies to freshly signed evidence within that key's own window. Old signatures
remain invalid at future evaluation; no archived-key authorization is created.
Legacy fractional lifecycle inputs still deny explicitly.

`git diff --check` passes. Frozen intent/0001, .github and lockfile diffs are
empty. Candidate policy digests change explicitly; no signed historical records
are upgraded. Publication is identified by the containing Git commit. Full
precision/schema adoption, archival/retention and independent review remain open.
