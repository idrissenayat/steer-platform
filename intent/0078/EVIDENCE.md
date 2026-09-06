# Development evidence

Baseline `e6bf3e122de13a307fc586d92d286c92d06c5d13` plus this increment.
Verified 2026-09-06 UTC under isolated Node 24.20.0 / pnpm 11.19.0.
All eight focused historical-event groups pass, including 2027/2029/2033 current
attestations, all 27 closed event kinds, the full 129-event capacity, exact expiry
and revocation boundaries, independent key checks and tampering/omission cases.

Full `pnpm check` passed: 95 kit artifacts, workflow scope audit, typechecks,
88 prototype tests, 165 root control/correction tests, seven package suites and
builds. Unchanged package tasks reused Turbo cache; the root synthetic accessibility
matrix ran again. No fresh manual audit or runtime integration was performed.
`git diff --check` passes; frozen intent/0001, .github and lockfile diffs are empty.
The containing commit identifies publication.

Synthetic offline evidence only: future witnesses are test-owned keys under a
separately supplied test registry. No old key material/window or signed source
was changed. No actual archive service, current trust publication, qualified
attestation, deletion, browser or provider integration is claimed. Full future
lifecycle disposition and all five R5 findings remain open.
