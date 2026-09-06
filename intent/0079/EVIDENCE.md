# Development evidence

Baseline `2f950cf7928bfb371254df1586767047deddc891` plus this increment.
Verified 2026-09-06 UTC under isolated Node 24.20.0 / pnpm 11.19.0.
The corrected focused suite passes all 12 groups, six newly added for 0079.
One-/three-/seven-year dates require all nine fresh signed proofs. Every missing,
old, forged or wrong-role proof denies; original API/policy output is stable.
Trusted-clock mismatch/omission, key activation/expiry/revocation, old-anchor
mutation, policy/scope drift, qualification/assignment failure, provider-binding
drift and losing CAS cases deny. Nanosecond expiry boundaries remain exact.

Full `pnpm check` passes: 95 kit artifacts, workflow scope audit, typechecks,
88 prototype tests, 171 root control/correction tests, seven package suites and
builds. Unchanged package tasks reused Turbo cache; the root synthetic accessibility
matrix ran again. `git diff --check` passes; frozen intent/0001, .github and lockfile
diffs are empty. The containing commit identifies publication.

The first focused run exposed a test-helper default that supplied a clock in the
missing-clock case. The test was corrected to call the verifier without a clock;
no runtime time check was loosened. The corrected run also explicitly exercises
wrong-role signatures for every signed evidence field.

Synthetic offline evidence only. No new real approval, key provisioning,
browser/provider/storage integration or independent review is claimed. All five
R5 findings and full future-lifecycle composition remain open.
