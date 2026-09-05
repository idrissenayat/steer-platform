# Development evidence

Baseline `d3cece25ec41f6f59e5d9cb7d1871620d81d2b1e` plus this increment.
Verified 2026-09-05 UTC. Synthetic local verification only.

The actual 0061 fixture now supplies raw-v2 with one pre-terminal human enrollment,
three exact shared copy actions and separate human/shared tombstone authority.
Raw per-copy-human negatives were explicitly migrated: nine missing grant proofs
are tested at the shared enrollment; all 30 missing shared copy proofs still deny
individually. Legacy human/raw copy fields deny, not silently disappear. Frozen
fixtures are unchanged; historical 0072 evidence retains its original meaning.

Eight new groups cover pass/fail/cancelled, unchanged original grant/plan/opening/
receipts across replay, complete proof omissions and signed hostile bindings,
request/scope transplants, losing reservations, exact opening/deadline chronology,
holds/inventory, 1/32 copies, forged/wrong-domain signatures for all seven batch
records, separate tombstone recovery and mixed partial-copy denial. The focused
lifecycle suite passes 28 groups. These are offline decisions, not database
concurrency, live erasure, provider completeness or actual human approval.

Root `pnpm check` passed under isolated Node 24.20.0 / pnpm 11.19.0: 95 kit
artifacts, workflow scope audit, typechecks, 88 prototype tests, 137 root
control/correction tests, all seven package suites and builds. Unchanged package
tasks reused Turbo cache; the root synthetic accessibility matrix ran again.
No fresh browser, Keycloak, storage, Temporal or provider integration and no
manual accessibility audit is claimed for this increment.

`git diff --check` passes. Frozen intent/0001, .github and lockfile diffs are
empty. Publication is identified by the containing Git commit.

All five R5 findings remain formally open. No frozen policy/Exam, trust registry,
key window, protected control or signed historical artifact is modified. No
provider mutation, release, deployment or spending is authorized.
