# Development evidence

Baseline `e35604cf0fd40198a285a32e5e808fead8182da3` plus this increment.
Four new focused groups pass. Final `pnpm check` passed on 2026-09-06 UTC under
isolated Node 24.20.0 / pnpm 11.19.0: 95 required kit artifacts, workflow scope
audit, typechecks, 88 prototype tests, 271 root controls (all 37 migration groups),
seven package suites and builds. Unchanged package tasks reused Turbo cache;
the synthetic root accessibility matrix ran again. `git diff --check` passed;
intent/0001, .github and lockfile diffs are empty.

Tests preserve the original failed contract prefix at its retained audit clock,
verify a separately identified retry at a later current clock, and reject aliases
that individually pass the complete current graph. Changed original replay bytes
remain rejected after temporary clock rebinding. Original-as-of validity and
expired-current-proof denial are independently checked in the fixtures.

All source keys, signatures, client/database rows and store identities are
synthetic. No stored byte, real approval, SQL, provider request, checkpoint,
browser/manual accessibility, deployment or independent gate review was changed
or performed. All five formal R5 findings remain open. The containing commit
identifies publication.
