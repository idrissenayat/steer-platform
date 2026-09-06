# Development evidence

Baseline `dadc0a3114a0781573b6370b3334f3afb0dfb69c` plus this increment.
All 24 human test groups pass, including six new reference-profile groups.
Final `pnpm check` passed on 2026-09-06 UTC under isolated Node 24.20.0 / pnpm
11.19.0: 95 kit artifacts, workflow scope audit, typechecks, 88 prototype tests,
213 root controls, seven package suites and builds. Unchanged package tasks
reused Turbo cache; the root synthetic accessibility matrix ran again. The full
check was rerun after the final tombstone-ID hardening, so the earlier run is not
used as evidence for those final bytes. `git diff --check` passed; frozen
intent/0001, .github and lockfile diffs are empty.

The new groups cover future dates, every truthful hold/reference-state combination,
all cross-profile substitutions, missing and human-provider-unbound fields,
exact one-record/class selectors, all nine omissions and signature forgeries,
current clock/key independence, qualification, freshness and nanosecond expiry.

Synthetic owners/keys only. No actual signature, reference inventory retrieval,
retained verification-bundle retrieval, provider mutation, live archive/IdP call,
manual accessibility audit or independent gate review occurred. The containing
commit identifies publication. All five formal R5 findings remain open.
