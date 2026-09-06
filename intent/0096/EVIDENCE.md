# Development evidence

Baseline `e562cf405cc943b69e6716d062c1537541e2ef5f` plus this increment.
All seven focused 0096 groups pass. Final `pnpm check` passed on 2026-09-06 UTC
under isolated Node 24.20.0 / pnpm 11.19.0: 95 required kit artifacts, workflow
scope audit, typechecks, 88 prototype tests, 285 root controls (all 51 migration
groups), seven package suites and builds. Unchanged package tasks reused Turbo
cache; the synthetic root accessibility matrix ran again. `git diff --check`
passed; intent/0001, .github and lockfile diffs are empty.

The stale-sequence test first verifies the older pending sequence independently,
then denies a separately signed source head reporting its successor. Other tests
exercise all five source signatures/domains/challenges, exact retained bytes,
head changes during readback, unknown/pre-commit outcomes and precise expiry.
The existing sequence and original-slot factories are unchanged in this increment.

All keys, signatures, object stores, queries and client/database state are
synthetic. No real provider was queried or mutated; no migration, checkpoint,
approval, browser/manual accessibility, deployment or independent review occurred.
All five formal R5 findings remain open. The containing commit identifies publication.
