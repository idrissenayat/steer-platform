# Evidence

Baseline `ed644326fc8e65344935df1f5c22e091196233d0` was clean.

## Verification — 2026-09-07

Final focused selection suite passed 28 tests, including ten new grant/identity/source
tests, 17 existing regressions and a separated strengthened proof-expiry check.
The additional held-writer test passed separately;
valid selector grants retain all three authority gaps and produce zero writes.
Adapter typecheck passed. Full `pnpm check` exited successfully: kit validation,
workflow-scope audit, typechecks, prototype/control tests, workspace tests and builds.
The adapter suite passed all 314 tests and the API suite all 107. Workspace tasks
finished 11/11 successful (7 cached); builds finished 7/7 (5 cached, including Next.js).
Cached logs are not a fresh browser or visual run. `git diff --check` passed.

Remote branch equality to the clean baseline was verified before committing.
A separate untracked `docs/REAL-USER-ROADMAP.md` appeared during verification;
it is outside this increment and is preserved without staging or modification.
Post-push equality and remaining-worktree status must be verified at handoff.

The initial late-expiry fixture froze `Date.now()` while child readers still used
advancing `new Date()` observations, causing denial before the intended source cut.
A second attempt moved the cut but still had that clock mismatch. The corrected
test uses the existing advancing-clock/offset pattern, asserts that the final review
source was reached, and verifies both a before-expiry positive and an expiry denial.
Production checks were not loosened and the expiry assertion remains required.
The same clock pattern was found in the earlier selection-proof expiry negative;
that check now independently verifies reaching the final source and a working
before-expiry control instead of relying on a potentially earlier clock denial.

Tests use generated synthetic Ed25519 keys and disposable native Git where stated.
The native scenario retains the exact historical grant commit and independently
reads the current document, then observes committed revocation with no stale
fallback. Standalone tests exercise exact nanosecond grant boundaries; the joined
test checks expiry at the later collection boundary with a positive control.
Only owned temporary fixture Git data is removed during cleanup.

Commands use Node 24.20.0 via `npm exec --yes --package=node@24.20.0 --`:
`pnpm --filter @steer/adapters exec node --test test/gate-selection-authorization.test.ts test/gate-selection-proof.test.ts test/gate-selection-attestation.test.ts test/gate-selection.test.ts`,
`pnpm --filter @steer/adapters exec node --test --test-name-pattern='selector grant binding keeps' test/gate-policy.test.ts`,
`pnpm --filter @steer/adapters typecheck`, and `pnpm check`.

## Limits

The optional internal capability `gate.policy.select` has no public tool or installed
grant. It is distinct from gate signing and does not select a live human/agent or
amend the operating model. Current and historical permission records are not proof
of actual login or approved ownership of those grant/attestor sources. The signed
receipt authenticates only the explicitly selected key's claims; the stronger mode
cannot accept a subject-only legacy receipt or change issuer/history coordinates.

No live profile/key/grant, protected artifact, frontend, dependency version, database
schema, provider access, spending, deployment, release or real-data deletion changed.
All five R5 findings, approved bootstrap, selector identity, native review provenance,
complete action-time authority, independent/qualified protected review and human
gates remain open. No new browser/manual visual evidence is claimed.
