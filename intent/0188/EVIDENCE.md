# Evidence

Baseline `e7f53cee8a2097f986a0b96806979b096d9398a6` was verified locally.
The separate untracked `docs/REAL-USER-ROADMAP.md` is preserved outside this item.

## Verification — 2026-09-07

Focused selection/identity suite passed all 46 tests, including eleven new selector
identity tests and the existing human-only gate identity regressions. The held-writer
test and integrated HTTP test passed separately; adapter typecheck passed.
Full `pnpm check` exited successfully: kit validation (95 required artifacts),
workflow-scope audit, all typechecks, 88 prototype tests, 438 repository controls,
all workspace tests and production builds. Adapter tests: 326; API tests: 108.
Workspace test tasks completed 11/11 (7 cached); builds completed 7/7 (5 cached,
including Next.js). Cached output is not a fresh browser/visual run.
The explicit grant-only-to-identity downgrade case was added while repository
controls ran; its focused test and adapter typecheck passed again, and the final
workspace suite executed the latest case. `git diff --check` passed.

The first documentation patch failed context validation and made no changes; the
corrected patch applied. No runtime assertion, production control or failed test was
weakened. Remote equality to the baseline was checked before the candidate commit;
post-push equality and the remaining unrelated untracked file are checked at handoff.

Native Git integration uses actual retained commits and exact source bytes with
generated synthetic Ed25519 keys. It joins a scoped agent session with the signed
selection and both grant eras, then denies coherently repinned current key revocation.
Boundary tests include an independently working before-expiry control and assert
the final policy source was reached before advancing time to expiry/revocation.
The held HTTP journey reaches policy-satisfied facts, returns 503 without a receipt,
retains zero Git mutations, observes current grant revocation, and reconstructs a
runtime that rejects coherently repinned revoked identity trust. No identity/session
claims reach public errors or held diagnostics.

Commands use Node 24.20.0 via `npm exec --yes --package=node@24.20.0 --`:
`pnpm --filter @steer/adapters exec node --test test/gate-selector-identity.test.ts test/gate-selection-authorization.test.ts test/gate-selection-proof.test.ts test/gate-selection-attestation.test.ts test/gate-selection.test.ts test/gate-identity-proof.test.ts`,
`pnpm --filter @steer/adapters exec node --test --test-name-pattern='verified selector session and grants' test/gate-policy.test.ts`,
`pnpm --filter @steer/adapters typecheck`,
`pnpm --filter @steer/api exec node --test --test-name-pattern='held HTTP runtime joins selector' test/held-runtime.test.ts`, and `pnpm check`.

## Limits

The optional signed identity contract authenticates a selected key's scoped session
assertion; it does not establish actual identity-service ownership or provision
real evidence. The dedicated domain supports agents without permitting them to sign
human gates. Identity/selection keys are generated only in test fixtures; production
code only verifies. HTTP integration uses signed synthetic OIDC credentials, native
Git-backed synthetic GitHub responses and no database connection or external provider.
No new browser or manual visual QA is claimed.

All five R5 findings, qualified independent protected review/human gates, approved
bootstrap, native review provenance and complete action-time authority remain open.
No protected artifact, live profile/key/grant, frontend design, dependency version,
database schema, provider access, spending, deployment, release or real-data deletion
changed. Only owned disposable test Git directories are cleaned.
