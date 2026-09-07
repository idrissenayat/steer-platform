# Evidence

Baseline `7cbee28eae7b513f0d669c6230bc9e29121ed48d` was clean and exactly matched
the remote candidate branch before this test-composition change.

## Verification — 2026-09-07

- API and worker typechecks pass.
- Actual local Keycloak 26.7.3 / Chromium 151.0.7922.34 integration passed all
  45 checks, including the joined current service-account runtime dispatch,
  browser-created native Git Brief, durable Temporal projection/replay and exact
  source opening. Projection-only dispatch and committed status revocation deny.
- The run confirmed closure of its owned Chromium/HTTPS/Next/Temporal services,
  synthetic PostgreSQL and Keycloak containers/tmpfs data, and generated test
  credentials. The production frontend source was unchanged.
- All `pnpm check` components passed in separate phases: kit/workflow-scope audits,
  88 prototype tests, 438 repository controls, complete typechecks/workspace tests
  and prototype/workspace production builds. API: 101 passing, no failures or skips.
  Builds started only after the browser run closed. Unchanged local Turbo tasks
  used cache (9 of 11 test tasks, 5 of 7 build tasks); actual browser integration
  and repository controls executed directly. No tests were skipped or reclassified.

## Limits

Gate authority and the projector principal remain test doubles. GitHub responses
adapt owned native Git, not the live provider. The service-account token issuer and
JWKS are the actual disposable local Keycloak instance. No real account, App grant,
live profile, automatic path admission, gate signature, deployment, spending or
real-record deletion changes. All five R5 findings and independent/qualified review,
governed full action-time authority and required human signatures remain open.

No frontend source changes or fresh manual visual QA are claimed. Browser assertions
will be reported separately from visual inspection and user-facing preview availability.
