# Development evidence

Baseline 50532ff86878cc5a861e8060523eadd35d5d1302 plus this increment.
2026-09-05 UTC. Synthetic offline evidence, no real keys, SQL or providers.

Six native groups pass. Each of three phases covers first/replay execution and
none/before-effect/after-effect interruption (18 combinations); each phase also
covers the three declared restoration modes (9 combinations). Expected fixture
rows are constructed independently rather than by calling the candidate transform.
Every accepted result reports zero execution and journal effects.

The frozen target-free, boolean-winner graph still returns journaled; it is
rejected by this closed successor. Each of the ten shared proof records is removed
for every phase. Properly signed hostile credentials, roles, authority, resources,
losers, stale heads, request drift and ordinary-domain replay/CAS proofs deny.
Freshly re-signed provider chains cannot hide changes to any of six source-byte
payloads, lost/reordered/changed rows, an out-of-batch backfill or wrong schema.
NFD text, newline and NUL source bytes are preserved through canonical base64.

Contract tests cover missing cleanup, wrong plan/method/scope/provider/safeguards
and changed human session without a replacement full provider proof. Preparation,
snapshot, journal and result proofs have domain/time/schema/lineage negatives.
Backup/rehearsal/rollback byte drift, wrong approval pins, replay-result drift,
caller overrides, arbitrary SQL operations, prototype-sensitive columns and
oversized/malformed inputs all deny with fixed content-free zero-effect results.

`pnpm check` passed with isolated Node 24.20.0 / pnpm 11.19.0: kit and workflow
scope checks, typechecks, 88 prototype tests, 62 root control/correction tests,
all seven package suites and prototype/production builds. Unchanged package
tasks reused existing Turbo cache; this is not a new browser/integration run.
`pnpm install --frozen-lockfile` passed without dependency changes;
`git diff --check` passed and the intent/0001 and .github diffs were empty.
Publication is identified by the Git commit containing this evidence.
No production/browser module, frozen review or protected Exam is changed.
No full 3,614-row migration matrix, actual compatibility/concurrency/checkpoint
continuity, live atomic execution or independent-review acceptance is claimed.
All five R5 findings remain formally open; see docs/GATE-2-CORRECTIONS.md.
