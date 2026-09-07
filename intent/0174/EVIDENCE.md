# Evidence

## Scope and audit

Baseline: `e320d6e86affd556103dcf9c273daf23dc6695d5`, initially clean.
Held writer always denies; production page still labels operating surfaces
unconnected. The recorded workflow had fixed readback/runtime and deterministic
duplicate policy but no owned manual dispatch/status client. The code-grounded
route and governance dependencies are in `docs/JOURNEY-REMAINING-WORK.md`.

## Verification — 2026-09-07

- Worker typecheck passed. Six new focused checks passed; all 29 worker tests pass.
- All 26 actual local Temporal checks passed (CLI 1.8.3 / Server 1.31.2), including
  native Git/PostgreSQL and recreated workers. The added scenario discards a real
  dispatch acknowledgment, returns unknown, refuses a second application attempt,
  observes the queued run, closes its connection and reconstructs another client.
  The retained workflow rejects duplicate dispatch. Its different-revision result
  completes without another ingestion or a projection rewind. Closing owned client
  connections leaves the independent environment connection/server working.
- The harness confirmed cleanup of owned projection runtimes, synthetic PostgreSQL
  container/tmpfs data, Temporal workers/server and generated temporary binary files.
- The initial repository regression caught an architectural import violation in
  the proposed separate client module. Moved the implementation into the existing
  designated `apps/worker/src/client.ts` SDK edge and removed the schema import;
  boundary rules and dependencies were not widened. All seven boundary checks,
  worker typecheck and 29 worker tests then passed. The actual Temporal suite was
  rerun after this correction: all 26 checks passed again and owned-resource cleanup
  was confirmed. The initial full run finished with 437/438 controls passing and
  that one import failure; it is not recorded as a pass.
- Final `pnpm check` exited 0 on Node 24.20.0: kit/workflow checks, typechecks,
  88 prototype tests, all 438 repository controls, all workspace tests and prototype/
  workspace builds passed. Unchanged workspace tasks reused eligible local Turbo
  cache; no test was skipped or a failed result reclassified. The worker suite has
  29 tests; existing API, adapter, registry, data, domain and web suites remain intact.

## Limits

Native Git grants are actual disposable commits, but projector identity and receipt
provenance remain synthetic. The fault wrapper discards an acknowledgment only after
actual local SDK dispatch; it is not a live provider fault or independent gate proof.
No credential, receipt contents or human subject enters workflow history.

No frontend/design changed; preceding 0173 browser45/visual QA is historical, not
rerun by this backend increment. No new authority callback, public tool, live runtime
binding, provider grant, protected artifact, dependency, schema, live save/scheduler,
deployment, spending, release or real-record deletion was introduced. All five R5
findings and independent/qualified review/human signatures remain open.
This is not the 08:00 morning handoff.
