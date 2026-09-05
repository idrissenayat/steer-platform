# Development evidence

Baseline 646e647cb894eb824f778b88fc61ff196e0fe01d plus this increment.
2026-09-05 UTC. Synthetic offline signers, no real provider or restored data.

Seven native groups cover all eight original recovery cuts and all 25 corruption
classes. Each of six signed record slots is separately corrupted in every cut,
including the two legacy pre-ack early returns. Their valid outcomes remain
UNKNOWN_RECONCILE_PROVIDER, not a completed recovery. Observation by any existing
evidence domain is rejected; the separately pinned observer is required.

Fully re-bound identity and journal graphs demonstrate old RECOVERY_VERIFIED
with pre-key/future or out-of-order identity times and rejection by the new path.
The test helper rebuilds actual lineage, exported records, mappings, inventory
and independent verifier after source changes; failure cannot be attributed to
an accidentally stale signature. Historical journal records predating recovery
start remain accepted. Exact observation/evaluation/key-expiry boundaries are
exercised without introducing a default clock.

Independent elapsed time must match original numeric counters. Exactly one hour
passes; 3,601-second and two-hour recovery graphs, accepted by the old oracle
when their caller-supplied limit is enlarged, are rejected. Tests also reproduce
old acceptance of coherently propagated noncanonical base64 and invalid-UTF-8
decision bytes; the successor rejects both. Binary Git bytes containing NUL,
NFD and newline are preserved. Four-row graphs pass; five-row graphs deny.

All seven new groups and root `pnpm check` passed under isolated Node 24.20.0 /
pnpm 11.19.0: kit (95 required artifacts), workflow scope audit, typechecks,
88 prototype tests, 86 root control/correction tests, all seven package suites
and builds. Unchanged package tasks reused Turbo cache; this is not a new browser,
real provider or storage integration run. Frozen-lockfile install and
`git diff --check` passed; intent/0001, .github and lockfile diffs were empty.
Publication is identified by the containing Git commit.
No frozen record, protected Exam or production module is changed. This
does not establish real recovery, source-native issuance of untimed records,
complete runtime/normative coverage or independent Gate 2 acceptance.
