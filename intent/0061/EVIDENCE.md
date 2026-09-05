# Development evidence

Baseline ef88da4ad4be38fe41f82f72d14025a98d761bda plus this increment.
2026-09-05 UTC. Offline synthetic candidate evidence, no real keys or providers.

Six native groups pass. Two providers and two copies exercise three separately
protected actions, using actual 0058, 0059 and 0060 implementations. Immediate
record cleanup and raw working-copy crypto erasure each pass first-execution
and committed-replay cases; reversed operation-envelope order remains valid.

The frozen effects graph still reports deleted-tombstoned for its old surrogate;
that graph cannot enter this successor. A corrupted historical provider proof,
re-signed ordinary event and freshly rebound authoritative state is rejected.
Tests remove each of ten shared proof records from each copy and tombstone,
then test properly signed hostile roles/credentials/authority/resources/CAS and
substituted human sessions. Downstream links are rebuilt where appropriate so
failure is not merely a stale request hash.

Coverage includes original-copy exclusion, duplicate physical copies, incomplete
inventory/aggregate, missing copy, foreign provider account, contradictory hold,
wrong receipt binding/status/action/effect/time, duplicate transactions, human
provider proof/credential/reservation reuse, caller target substitution and replay
result drift. Raw policy revisions and temporary-copy constraints are checked.
On-time erasure remains valid when audited later; the exact +60 receipt boundary
passes and +61 fails with otherwise coherent later aggregate/tombstone times.
Ordinary cleanup with the same later schedule passes. Calendar-year/leap-day,
90-day, parent-cap, future scheduling and immutable retention are checked.

`pnpm check` passed with isolated Node 24.20.0 / pnpm 11.19.0: kit and workflow
scope checks, typechecks, 88 prototype tests, 56 root control/correction tests,
all seven package suites and prototype/production builds. Unchanged package
tasks reused existing Turbo cache; no new browser/integration run is implied.
`pnpm install --frozen-lockfile` passed without dependency changes;
`git diff --check` passed and the intent/0001 and .github diffs were empty.
Publication is identified by the Git commit containing this evidence.
No production/browser module, frozen review or protected Exam is modified.
No new live integration, browser/manual accessibility, future retention-key
coverage, complete matrix or independent-review success is claimed. All five
R5 findings remain formally open; see docs/GATE-2-CORRECTIONS.md.
