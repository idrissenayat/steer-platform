# Evidence

Development verification on 2026-09-06, Node 24.20.0 / pnpm 11.19.0.

- Before the fix, the new completion-expiry regression fails with `Missing expected
  rejection: provider-expiry`. The first signer passes individually, then its key
  reaches expiry during the final canonical record read. No real key or grant changes.
- After the fix, the regression covers nine expiry/scheduled-revocation cases across
  provider and identity keys, current roles, qualification keys and qualifications.
- Exact-boundary coverage rejects one nanosecond after expiry and the exact endpoint,
  while preserving the precise bound and accepting one nanosecond before it.
- Historical authentication can expire after signing without becoming a false current
  requirement. A second collection on the same healthy instance still reads sources
  again and rejects a now-inactive role; the bound is not cached authority.
- Native Git and real ephemeral signatures remain in the tests. Shared and individual
  validity objects are frozen; source/policy revalidation and false authority flags remain.
- Focused collector/provider-reader run: 44/44 groups pass, including the unchanged
  real 15-second stalled-read ownership cases. Adapter typecheck passes.
- Full `pnpm check`: exit 0. All 88 prototype tests, 437 root controls, seven package
  typechecks, eleven package test tasks and seven builds pass, including 189 adapter
  tests. Root controls take 235.17 seconds. This run covers the final code and tests;
  only these evidence/status documents are finalized afterward. Unaffected tasks
  use cache where applicable. No assertion, timeout or concurrency was relaxed.
- `git diff --check` passes. Protected `intent/0001`, `.github` and the dependency
  lockfile have no changes in this increment.

These tests use synthetic people, authorities, service authentication and ephemeral
keys. They do not validate an actual user's signature or approve a trust root. Only
owned temporary Git fixtures are cleaned up. No browser rerun or frontend change.

The window verifies known time bounds at a common instant; it cannot reveal a later
source change. Full gate/source/authority composition, real bindings and all five R5
findings remain open. No runtime writer, deployment, release or spending is enabled.
