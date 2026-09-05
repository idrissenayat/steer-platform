# Development evidence

Baseline 0e7f8c9e692441ab2c6a846a1d6fcabb17cb2902 plus this increment.
2026-09-05 UTC. Synthetic offline signers only, no actual gate credentials.

Six native groups preserve all 32 original authorization case outcomes and the
exact ten consumed record IDs for first/replay acceptance. All ten signatures
and every native timestamp field are independently corrupted on both paths.
Tests reproduce old ALLOW with pre-key resource, replay, head and authority
times; updated authority/request signatures remove stale-digest explanations.
The new audit rejects each example despite a fresh independent observation.

A fully re-signed replay graph gives delegation, reservation and replay records
the same fabricated immutable request digest, updating their request references.
The original oracle returns REPLAY_NOOP; the new path recomputes the actual
request digest and denies. Current evaluation, exact expiry, 300-second resource
freshness, observation-domain/scope/inventory drift and malformed/oversized
inputs are tested. Original hypothetical write counters are explicitly not
reported as actual effects: every new result is zero-effect/no-execution.

All six new groups and root `pnpm check` passed under isolated Node 24.20.0 /
pnpm 11.19.0: kit (95 required artifacts), workflow scope audit, typechecks,
88 prototype tests, 92 root control/correction tests, all seven package suites
and builds. Unchanged package tasks reused Turbo cache; no fresh browser,
real provider or storage integration run is claimed. Frozen-lockfile install and
`git diff --check` passed; intent/0001, .github and lockfile diffs were empty.
Publication is identified by the containing Git commit.
No frozen record, protected Exam, production route or provider policy is
changed. This does not complete real authorization, stored replay-result proof,
accessibility/public timing coverage or independent Gate 2 acceptance.
