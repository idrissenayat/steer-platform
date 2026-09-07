# Evidence

Baseline: `f93247305f35212c0fa2659606e17481acbba598`, clean and remote-equal
before this increment. Reused existing explicit-grant/current-principal patterns
and the managed client; no provider import or dependency was added to the registry.

## Verification — 2026-09-07

- Registry typecheck and 104 tests pass, including five new focused cases for
  separate grants/roles, exact scope, changed configuration, revalidation and
  sanitized start/status results. A test title was clarified to avoid implying
  that ordinary human status access verifies specialist qualification.
- API typecheck and all ten official MCP test groups pass. Added HTTP/MCP parity
  covers discovery hints, exact results, malformed/foreign input, separate grants,
  no default service/access and post-read revocation. The scheduler port is a
  synthetic test double; this does not prove actual Temporal dispatch.
- All 27 actual local Temporal checks passed (CLI 1.8.3 / Server 1.31.2), including
  native Git/PostgreSQL and recreated workers. The new canonical-tool scenario
  denies dispatch with only an ingestion grant, confirms no attempt was consumed,
  starts with the separate dispatch grant, refuses a second attempt and denies
  later status after revocation. With current test identity restored, the completed
  different-revision workflow leaves ingestion count unchanged. The existing
  acknowledgment-loss/connection-reconstruction scenario also remains green.
- The harness confirmed owned PostgreSQL container/tmpfs, runtime, worker/server
  and temporary binary cleanup.
- The first full check stopped at TypeScript: the new test's union tool name can
  select the generic synchronous-or-async overload. Wrapped those three negative
  assertions in async callbacks, matching the existing scheduling test convention;
  no production contract or assertion was weakened.
- Final `pnpm check` exited 0 on Node 24.20.0: kit/workflow checks, all typechecks,
  88 prototype tests, all 438 repository controls, workspace tests and all builds
  passed. Workspace suites include 104 registry, 97 API, 289 adapter, 29 worker,
  65 web, 24 data and 13 domain tests. Eligible unchanged tasks used local Turbo
  cache; no failed run was reclassified and no test was skipped.

## Limits

No frontend change or new browser pass is claimed. Actual Temporal integration
uses a separately named synthetic dispatcher with explicit new test grants; these
are not current real-user/provider approvals. Existing worker receipt provenance
and projector-identity limitations remain. Test grants never update live Git
authorization records. No identity-runtime option, live configuration, protected
artifact, dependency, schema migration, new provider access, save, release,
deployment, spending or real-record deletion is introduced. All five R5 findings,
governed authority, independent/qualified review and human signatures remain open.
