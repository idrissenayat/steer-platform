# Development evidence

Baseline 099b2be4d626ba6061dcd6e45c3e029fc3322562 plus this increment.
2026-09-05 UTC. Synthetic offline evidence only; no real keys or providers.

All eight new native test groups passed. The suite independently builds the expected inventory rather
than asking the candidate for a self-accepting observation. It tests privacy's
10 records and two-line reconciliation's 14 records, including the nested
authorization proof. Every record signature slot is corrupted separately.
Native timestamp slots receive pre-key and future signed values. A price proof
dated before key validity and a future raw receipt reproduce acceptance by the
older corrections and rejection by the new composition.

Missing/default/malformed/overridden clocks, decision-after-evaluation, exact
source-use expiry and key notAfter boundaries are checked. Fresh observations
with changed graph/policy/registry, missing/reordered inventory, wrong time basis,
wrong count, ordinary signer or invalid signature deny. All 32 independent cost
array permutations pass with unchanged aggregate. 64 lines/324 signed records
pass; 65 lines deny. Re-signed Unicode-phone source graphs, original privacy
integrity failures and missing cost lineage remain denied after observation.

`pnpm check` passed using isolated Node 24.20.0 / pnpm 11.19.0: kit (95 required
artifacts), workflow scope audit, root and package typechecks, 88 prototype tests,
the root control/correction suite including these eight groups, all seven package
suites and prototype/production builds. Unchanged package tasks reused Turbo
cache; this was not a new browser, real Keycloak or storage integration run.
`pnpm install --frozen-lockfile` passed with no dependency change.
`git diff --check` passed; intent/0001, .github and lockfile diffs were empty.
Publication is identified by the Git commit containing this evidence.
No frozen review, protected Exam or production route is edited.
This does not establish cryptographic issuance time for untimed legacy records,
live provider observation, other public-oracle timing, full normative matrices,
independent acceptance or Gate 2. See docs/GATE-2-CORRECTIONS.md.
