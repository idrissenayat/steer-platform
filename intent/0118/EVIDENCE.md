# Development evidence

Baseline 3f261f2f5f887cc689dc9761c47d653737257a0f plus this increment.
Twenty-five focused groups pass: nine new archive groups, eight retained-child
groups and eight historical-event groups. Full repository checks pass all 420 root
controls (144.5 seconds), 88 prototype tests, 95 required kit artifacts, security
scope audit, typechecks and builds. Unchanged package tasks use Turbo cache and
are not freshly executed package checks. The separate full integration process
passes all three groups (121.9 seconds) and matches the existing full snapshot.

Commands use isolated Node 24.20.0: pnpm check; pnpm r5:coverage:test-full; and
node --test tests/r5-archived-derived.test.mjs tests/r5-derived-disposition.test.mjs
tests/r5-historical-events.test.mjs. The new focused regression re-executes quick
coverage and matches intent/0117/QUICK-EXECUTION-REPORT.json exactly. Full integration
matches intent/0117/FULL-EXECUTION-REPORT.json. No mapped source or prior fixture
changes, new hook, copied report or added exact-ID credit are needed: quick remains
393 passed / 3,643 uncovered, full 409 passed / 3,627 uncovered, both zero failures.
This new component is separately tested, not credited by those ledger snapshots.

Synthetic 2027/2029/2033 audits and committed replay validate two children/four copies
with full retained proof and distinct current witnesses. Original verification at
the later audit clock still denies. Signature-valid current witnesses cannot cover
missing, digest-only, wrong-copy or reordered child proof, nor wrong archive/count/
observation/evidence/source/receipt semantics. All 18 original-domain revocations
deny at the current instant, including unused money and other domains; a revocation
one nanosecond later allows only the preceding instant. The original proof still
passes its original observation and fresh witnesses individually verify in these
revocation tests. Current-key revocation also denies.

An original-era witness cryptographically verifies at a valid original-key instant
but fails the archive independence rule. Key omission/replacement/window extension,
cross-role/era aliases, forged or wrong-domain proof, incomplete or misordered
retention, expiration/future times, closed-envelope and UTF-8 limits are covered.
The conservative unused-domain revocation denial is deliberate narrower admission,
not a claim of minimal revocation impact or complete normative acceptance.

git diff --check passes. Frozen intent/0001, .github and the lockfile are untouched.
Candidate publication is checked separately against the remote after commit/push.
No real archive/store/registry installation, seven-year observation, parent manifest
completeness, current action authority, actual deletion, gate signature, independent
acceptance, release, deployment or spending is proved or authorized. All five formal
R5 findings and the unchanged lifecycle/migration/schema backlog stay open.
