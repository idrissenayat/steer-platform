# Development evidence

Baseline `5b6de2e5c300b2857f49bce35738b7a1dc9f3efa` plus this increment.
All 19 migration groups pass, including seven new model groups and the 6,656-case
128-row bound. Final `pnpm check` passed on 2026-09-06 UTC under isolated Node
24.20.0 / pnpm 11.19.0: 95 required kit artifacts, workflow scope audit, typechecks,
88 prototype tests, 253 root controls, seven package suites and builds. Unchanged
package tasks reused Turbo cache; the synthetic root accessibility matrix ran
again. `git diff --check` passed; intent/0001, .github and lockfile diffs are empty.

Concrete counterexamples: an approved/signed contract whose replacement column
is null passes the lower-level exact transformation but loses the logical value;
the new composition rejects it. A stale non-null mirror and an unlisted model
version also pass the lower-level graph but fail this stricter compatibility path.

All keys, source snapshots, signatures, database rows and client adapters are
synthetic. Client code is actually executed against in-memory data; no real app
binary, database, SQL, journal mutation, provider access, signature, deployment,
browser/manual accessibility review or independent gate review occurred.
All five formal R5 findings remain open. The containing commit identifies publication.
