# Diagnostic verification

Production baseline: `0144a3bc9717ea471d3464ded35d46685599939c`.
No production source changed. Only test instrumentation, preserved diagnostic
data and the delivery plan are added. Node **24.19.0** is pinned for verification.

## Observed results

- Transport-stack-only selection: one authenticated joined check plus idempotent
  migrations passes through recorded scope/roles, correction, confirmation,
  native save, lost replies, restart and exact reopen.
- Scheduling-origin selection: the same joined assertions and migrations pass.
  Both runs retain all **45 HTTP invocations**, including denials; all identity
  count vectors match exactly, **81,500 attempts** in each run.
- Origin run retains **2,337 groups**, with zero capture errors and zero overflow.
  Maximum retained origin length is 17, below the 64-location bound. Encoded
  source-location chains, 41 production source hashes, harness hashes, raw-log
  hashes and all action measurements are retained in [PROFILE.json](PROFILE.json).
- First confirmation remains **7,637** attempts: 7,491 identity (7,488 head checks)
  and 146 repository. Reconstructed/repeated confirmation remain **7,609 / 7,607**.
  These are unchanged counts, not an optimization. Recovery returns committed in
  215 ms / 17 requests with 14 SQL phases and no observed clock reversal; this does
  not explain or fix the earlier retained 0289 recovery-unknown result.

The call-family breakdown and **258-attempt lower bound** are explained in the
[correction plan](REQUEST-BUDGET-PLAN.md). The proposed 200-attempt allocation is
tested arithmetic, not a working implementation or evidence of feasibility.

## Harness scope and verification limits

The opt-in preload uses Node's documented synchronous module-load hooks to label
existing scheduling sites in memory. Ordinary startup is rejected and worker
preloads do not install the hooks. It does not modify production files or replace
services, callbacks, authorization decisions, stored results or provider replies.
[Node module-hook documentation](https://nodejs.org/download/release/v22.18.0/docs/api/module.html#moduleregisterhooksoptions)
describes the mechanism; runtime checks use the pinned Node 24 version.

The first typecheck of the preload failed on the loader source union's Buffer
overload. It was corrected to a fatal UTF-8 TextDecoder. The joined origin run
had already loaded the prior Buffer decoder; its exact executed-preload hash is
recorded separately. The final decoder is covered by focused tests and final
types, not misrepresented as another joined run. Production inputs/line numbers,
labels and callback behavior are unchanged. **27 final focused tests pass**, zero
failures/cancellations/skips (402.159 ms), including artifact count conservation,
matching run vectors, protocol lower-bound arithmetic, privacy/bounds, callback
identity, concurrent label isolation, source-anchor drift and preload rejection.
Prototype and all eight package typechecks pass (seven package cache hits,
2.676 s). Final kit and workflow audits pass; protected-source and link validation
is recorded in the delivery ledger.

Attribution adds overhead and may overlap focused/type checks. No p95, timing
speedup, delayed/full C22, ordinary unprofiled joined rerun, full SQL/broad suite,
browser, live model, real runtime GitHub save or user acceptance is claimed.
The API-key skill keeps the already-resolved credential decision intact; no
credential inspection, new key, live provider access or model spending occurred.
Disposable integration cleanup removed only each run's owned PostgreSQL container
and tmpfs data; user files, signed artifacts and existing drafts are preserved.

## Reproduce

```sh
node --test apps/api/test/identity-request-profile*.test.ts apps/api/test/native-request-metrics.test.ts packages/data/test/integration-diagnostics.test.ts tests/package-boundaries.test.mjs
node packages/data/test/postgres.integration.ts --journey-request-profile
node --import ./apps/api/test/identity-request-profile-hooks.ts packages/data/test/postgres.integration.ts --journey-request-profile
pnpm typecheck
```

Ordinary integration selections do not enable attribution. Profile output is
count/location metadata only; raw logs are generated in run-owned temporary
directories. PROFILE.json preserves every structured identity profile in both
runs, including failed/denied requests, plus final action measurements.

Overall: **68% (17/25; 8 remaining; +0 percentage points)**. This closes a diagnosis
and planning increment, not a user-workflow acceptance checkpoint.

Final audit verifies all 48 recorded source/harness hashes, four protected hashes,
414 relative documentation links and the contiguous unchanged 17/25 tracker.
