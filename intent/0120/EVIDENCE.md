# Development evidence

Baseline f5be26fb0d2d626e46a857b8d6d7a6bc4253a417 plus this increment.
Forty-one focused groups pass: nine new retirement groups, 24 existing human-authority
groups and eight parent-history groups. The initial eight component-only groups
also pass. Final repository checks pass all 437 root controls (148.3 seconds),
88 prototype tests, 95 required kit artifacts, scope audit, typechecks and builds.
Unchanged package tasks use Turbo cache, not fresh package execution. A separate
full integration run passes all three groups (113.8 seconds) and matches its snapshot.

One initial repository attempt passed 436 of 437 controls. The CLI subtest returned
null status at its 30-second subprocess limit while other heavy verification jobs
overlapped; the expected fail-closed CLI exit was 2. After the separate integration
completed, that exact CLI test passed unchanged in isolation (58.7 seconds across
its modes), and the full repository rerun passed without overlapping verification
jobs. No timeout, assertion, fixture expectation or production behavior was weakened
to obtain the final result. Future full checks should avoid this extra overlap.

Commands use isolated Node 24.20.0: pnpm check; pnpm r5:coverage:test-full;
node --test tests/r5-retirement-decision.test.mjs tests/r5-human-correction.test.mjs
tests/r5-provenance-history.test.mjs; the targeted 0098 CLI test; and
scripts/run-r5-coverage.mjs --report / --full-report. Fresh quick is 393 passed /
3,643 uncovered; full is 409 passed / 3,627 uncovered, both zero failures. All 393
prior quick and 409 prior full observation hashes/counts/outcomes compare identical.
Only source fingerprints change. The shared schema import is fingerprinted, not
credited as retirement-profile execution; the new profile has no catalog hook.

Positive controls cover original and fresh 2033 decisions, empty prefix and truthful
active/released hold metadata. All nine human records are mandatory and corruptions
deny. Fully valid human proofs and signed events can still fail exact actor/source,
corpus/event/selector/predecessor/head/conditions/safeguards binding. Complete human
proof also cannot bypass signed head completeness/policy/chronology or reservations
after commit and CAS/replay snapshots after decision. Exact commit, expiry and
revocation nanosecond boundaries are checked. Old profiles reject retirement schema
substitution and preserve their prior behavior/policy outputs.

retirementAuthorityVerified=true describes evidence at the explicit observation,
not a human signature taken by this agent or later archive validity. All results
keep zero effects and false execution/deletion/live-provider/future-archive/qualified-
prior-history flags. Full qualified parent history and a fresh retained retirement
archive remain required before future lifecycle admission. No live retirement,
current-v7, actual deletion, independent/protected acceptance, gate signature,
release, deployment or spending is proved or authorized.

git diff --check passes. Frozen intent/0001, .github and pnpm-lock.yaml are untouched.
Candidate publication is separately verified against the remote after commit/push.
All five formal R5 findings and the unchanged lifecycle/migration/schema backlog
remain open. PLAN.md records the next unblocked local archive prerequisite.
