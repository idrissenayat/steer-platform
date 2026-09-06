# Development evidence

Baseline `a43fd77bca877dc5952b6163080a1cd561263310` plus this increment.
Verified 2026-09-06 UTC under isolated Node 24.20.0 / pnpm 11.19.0.

Seven new terminal groups pass; the lifecycle file now contains 48 tests. The
first focused 47-test run passed before the seventh group was added; the complete
root run includes all 48, and the final seven-group terminal-only run also passes.
Twenty-four outcome/partition combinations pass (three terminal outcomes and
eight completed-copy subsets). Repeated immutable reads at later evaluation times
are no-ops. Original scope/result substitutions, omitted proofs, independent-key
forgeries, wrong domains, reused heads, forks and new reservations deny. Current
expiry is enforced at exact nanosecond boundaries even with extended terminal
proofs. Every test calls the complete original and current lifecycle composition;
no sealed request, receipt or human approval is re-signed for a successful retry.

Full `pnpm check` passed: 95 kit artifacts, workflow scope audit, typechecks,
88 prototype tests, 157 root control/correction tests, seven package suites and
builds. Unchanged package tasks reused Turbo cache. The root synthetic
accessibility matrix ran again; this is not a qualified manual audit.

`git diff --check` passes. Frozen intent/0001, .github and pnpm-lock.yaml have
no changes. The containing commit identifies this increment's publication.

Scope: synthetic offline terminal-consumption evidence. No fresh provider,
database, browser, Temporal or manual accessibility run is claimed. All five
R5 findings remain open, with independent/protected review still required.
No real atomic terminal commit, provider-result discovery or acknowledgment
transport was exercised. Missing terminal evidence fails closed. Long-term
archival replay and runtime current-authority integration remain unresolved.
