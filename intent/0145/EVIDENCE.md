# Evidence

Development verification on 2026-09-06 with Node 24.20.0 / pnpm 11.19.0.

The focused runner-proof, complete gate-policy and package-boundary suites pass
37 groups, and adapter typecheck passes. Six pure cryptographic groups use newly
generated isolated synthetic Ed25519 keys and a test-only receipt issuer; no
runtime keys are loaded or generated. Four new integration groups cover actual
native-Git collection, mandatory configured proof and adverse sources, common
completion-time key validity, and startup path/identity admission.

The first focused run passed 36 of 37 groups: its before-expiry positive froze
`Date.now` while a child correctly used the advancing real Date clock, causing an
earlier common-validity rejection. The test now advances the real clock until the
runner proof is observed, changes its offset only for final completion, and asserts
that the intended proof-read boundary was reached. Its before-expiry positive and
exact-expiry/revocation negatives pass. Production clock/authority checks were not
relaxed. A targeted rerun and the subsequent complete focused rerun pass.

Full `pnpm check` exits zero: kit and workflow-scope audits, prototype typecheck,
88 prototype tests, 437 root assurance controls, all seven package typechecks,
and all workspace tests (237 adapters, 79 API, 81 registry, 29 web, 21 data,
18 worker, 13 domain) pass. Prototype and all seven package builds pass; Turbo
reused unchanged package results where shown. No architectural allowlist, protected
record or assertion was weakened. No browser or real provider run was performed.

All original protected sources remain unchanged. A successful synthetic runner
assertion is not actual provider integration, independent isolation evidence,
Gate 2, release qualification or live-write permission. All five R5 findings
remain open. Temporary native Git fixture directories alone are cleaned up.
