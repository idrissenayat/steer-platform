# Evidence

Baseline `d6f278dcac667fa0739039174dfc4c1ecb3f122a` was clean and exactly matched
the remote candidate branch. Test composition and documentation only change.

## Verification — 2026-09-07

- API and worker typechecks passed.
- All 29 actual local Temporal integration checks passed, including authenticated
  FAILED status, current revocation, owned-runtime reconstruction and retained
  duplicate rejection after one actual worker activity failure. No second activity
  attempt or Git mutation was observed; private failure text stayed out of history.
- The Temporal harness confirmed cleanup of its owned workers/server, native Git
  fixtures, synthetic PostgreSQL container/tmpfs data and generated temporary files.
- All 45 actual Keycloak 26.7.3 / Chromium 151.0.7922.34 browser checks passed,
  including receipt-time revocation before SQL connection, restored-current first
  workflow dispatch, exact one-time projection/source opening and post-completion
  denial. The two actual receipt reads retain their distinct denied/successful roles.
- The browser run closed its owned Chromium/HTTPS/Next/Temporal services, synthetic
  PostgreSQL/Keycloak containers/tmpfs data and generated credentials.
- Final kit/workflow-scope audits, 88 prototype tests, 438 repository controls,
  workspace typechecks/tests and prototype/workspace production builds all passed.
  Together these execute every `pnpm check` component in phases. API: 101 passing,
  no failures or skips. Unchanged local Turbo tasks used cache (9 of 11 test tasks,
  5 of 7 build tasks); actual integrations and controls were not cached. Builds
  started after browser cleanup. No test was skipped, reclassified or weakened.

## Limits

The browser's post-receipt revocation uses actual local human/projector identity and
native Git, but is a direct activity denial before any Temporal start. Successful
projection afterward is the first workflow attempt, not a retry of a failed run.
The separate actual failed Temporal run uses a synthetic throwing activity and
synthetic issuer/provider responses; it does not establish a SQL failure outcome.
Status recovery is observational. Controlled retry/reset remains unavailable, and
no gate approval, real provider access, production configuration, spending, release,
deployment or real-record deletion is authorized. All five R5 findings and required
complete authority/independent review/human signatures remain open.
