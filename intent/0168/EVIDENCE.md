# Evidence

## Implemented and observed — 2026-09-07

The actual browser authoring/confirmation/submission scenario now reaches the real
recorded-Brief Temporal workflow and production worker/runtime. Its native Git pair
is created, not seeded. After lost acknowledgement, current browser status supplies
the exact reference. The test queues that operation with no running worker, closes
and recreates the runtime, then verifies the original run projects the exact receipt.

Assertions cover one authenticated browser receipt read, one native Git creation,
one PostgreSQL source event, history replay without repeat reads/effects, retained
duplicate-start denial and exact curated Brief opening after API reconstruction.
Subject, database password, fixture private content and write-token sentinel are
absent from workflow history. The callback performs an actual same-origin fetch
with current synthetic Keycloak session; no cookie/token is supplied to the worker
or serialized into workflow history.

## Checks

- Actual Keycloak/Chromium browser integration: 43 checks passed. The existing 0167
  scenario is strengthened, not counted as another independent case. Current status
  revocation/recovery, exact receipt binding, mobile/200% wrapping, keyboard and
  automated accessibility checks still pass. No frontend source or visual layout changed.
- Actual Temporal integration: 25 checks passed with the shared pinned bootstrap,
  including separate-process SIGKILL/restart, current grant revocation, exact created
  receipt projection, source no-rewind, replay and shutdown checks.
- Actual HTTP/native Git/PostgreSQL Brief-creation regression: three groups passed.
- Full `pnpm check` passed: 88 prototype tests, 438 repository controls, 99 registry,
  24 data, 61 web, 283 adapter, 91 API, 23 worker and 13 domain tests, all workspace
  typechecks/builds, kit validation and workflow-scope audit. Eligible unchanged
  workspace tasks used local Turbo cache; browser/workflow/creation suites ran directly.

The first workflow regression failed at its separate-process startup: extracting the
bootstrap changed the generated directory prefix, while the child requires the
original owned-fixture prefix. The shared helper now preserves `steer-temporal-0036-`;
the child safety check was not relaxed. The full 25-check rerun passed. The browser
run independently passed its actual Temporal path; it does not use that child fixture.

## Scope and cleanup

Both suites use the same SHA-256-pinned Temporal CLI 1.8.3 / server 1.31.2 test
bootstrap. Real local Keycloak 26.7.3, Chromium 151.0.7922.34, native Git and PostgreSQL
16 are exercised with synthetic identities/data. The code-host network and full gate
authority remain explicit test doubles; projector identity is separately synthetic.
The original nondurable receipt job remains in its existing tests, but is not used
to project this browser-created record. There is no installed live receipt dispatcher,
automatic source admission, real-provider mutation or approved real-member demo.

Owned browser/HTTPS/Next services, Temporal workers/server/generated files, synthetic
PostgreSQL/Keycloak containers, tmpfs records and generated credentials were cleaned.
No real records were deleted. No production code, dependency, schema, live config,
provider grant, spending, deployment, release or protected artifact changed. All five
R5 findings, full governed authority, model conversation, qualified/independent
protected review and human signatures remain open.
