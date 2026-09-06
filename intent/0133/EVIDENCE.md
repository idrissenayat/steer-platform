# Evidence

Development verification on 2026-09-06, Node 24.20.0 / pnpm 11.19.0.

- Before correction, the two new partial-clock regression cases both fail with
  `Missing expected rejection`: existing membership and source collection each
  return an observation after the test clock advances and then partly rolls back.
- After correction, the same targeted cases pass 2/2 without assertion changes.
- The complete focused membership/gate-source set passes 24/24, preserving the
  original 19 groups and adding five groups. Adapter typecheck passes.
- The new collection timeout actually waits 15.00 seconds; it checks active
  ownership after caller rejection, denied observe/collect overlap, pending
  shutdown and exactly one source call after release. The existing membership
  real-timeout group also passes. Equal-clock and legacy-shape positives remain.
- Full `pnpm check`: exit 0. All 88 prototype tests, 437 root controls, seven
  package typechecks, eleven package test tasks and seven builds pass. The adapter
  suite passes 131/131 tests. Root controls take 233.33 seconds. Unchanged tasks
  reuse cache where applicable; no assertion, test deadline or concurrency limit
  was weakened to obtain the result.

Synthetic identities, sources and test clocks exercise actual adapter code; the
existing read-only GitHub-reader composition test remains included. No live
provider is called and no signature, trust key, source record or user data changes.

No browser/manual-accessibility rerun is claimed: browser source is unchanged.
This is correction of development prerequisites, not a completed full authority
verifier, R5 closure, Gate 2 decision, production write, deployment, release or
spending authorization. Existing provider-record compatibility and all five R5
findings remain open.
