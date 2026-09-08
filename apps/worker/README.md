# STEER workers

Temporal is the durable workflow runtime; provider effects and records authority
remain explicit application services. Git remains the business system of record.

Existing composition and recovery documentation:

- [Temporal foundation](../../docs/TEMPORAL-WORKFLOWS.md)
- [Projection runtime](../../docs/WORKER-PROJECTION-RUNTIME.md)
- [End-to-end workflow contract](../../docs/architecture/WORKFLOW-CONTRACT.md)
- [Current delivery plan](../../docs/INTENT-JOURNEY-PLAN.md)

## Development step runner — uninstalled

`createDevelopmentStepRuntime` accepts a fixed operation ID/input digest, current
records configuration, caller-owned SQL pools, actual reader dependencies, a
current-authority port and a recorded-model port. Only `run(role, AbortSignal)` and
`close()` are exposed. It neither starts a listener nor registers a Temporal worker.

It restores originals, reserves the role cost through SQL, requires an acknowledged
one-way dispatch, rechecks current scope/state and captures verified results. A
completed step is read back; a possibly sent step is not automatically sent again.
Return values carry references/status only. Request text stays private to workers.
Cancellation/close stops admission, not necessarily an uncooperative provider;
shared pools and external resources remain the caller's responsibility.

Production `RecordedDevelopmentModel.execute` must record the actual adapter
request/response/usage before returning, and `verify` must independently retrieve
and validate those records. Increment 0223 supplies an uninstalled implementation;
the original 0221 fixture's in-memory map cannot serve as the production verifier.
Likewise, current identity/profile/source/records and
spending authority must not be replaced with no-op callbacks.

Under Node 24, run `pnpm --filter @steer/worker test` for unit tests and
`pnpm test:data:integration` for the disposable PostgreSQL composition checks.
`pnpm test:workflow:integration` tests the older Temporal paths. The runner's new
0224 Temporal composition is covered by `pnpm test:data:integration` because it
requires the actual disposable SQL stores. See [0221 evidence](../../intent/0221/EVIDENCE.md).

Increment 0222 adds `@steer/data/development-observations`: separately immutable,
encrypted request/response storage under current draft/source/step authority. A new
integrated fixture verifies this runner against actual SQL observations with fresh
readers, not the in-memory map. Production transport serialization, response parsing
and usage extraction must still be connected to this journal; supplied body bytes
and adapter labels alone are not provider proof. No runner/model/API registration
or live storage authority is added. See [0222 evidence](../../intent/0222/EVIDENCE.md).

## Recorded model binding — uninstalled

`createRecordedDevelopmentModel` joins the actual Mastra serializer/parser to SQL
observations for one operation. It requires explicit gateway/profile options and
current model/records authority. A newly acknowledged request insertion is consumed
once; reconstructing the model cannot resend an existing request. After capture,
fresh authority and final source/state checks precede transport. Successful raw
responses and usage are recorded before returning, then independently read/parsed
when the step runner verifies a checkpoint.

The adapter uses `steer-mastra-observed/v1`, fixed profiles and only the configured
local gateway. No provider key, fallback endpoint, tools, memory, retries or content
telemetry. Failed/refused/malformed calls keep an uncertain request and consumed
reservation, not a fabricated completed response. Provider-side investigation,
current cost bounds, real records adoption and live route acceptance are separate.
See [0223 evidence](../../intent/0223/EVIDENCE.md). No Temporal/API/UI registration
or change to the existing application's runtime is made by this factory.

## Intent development workflow — uninstalled

`startIntentDevelopment` sends only the fixed organization/operation/input reference.
`developIntent` schedules Architect then Test Agent, stopping for clarification,
superseded output, busy state or uncertainty. `developmentProgress` exposes recorded
reference-only progress, not current permission or current-source validation.
The API must reauthorize and read private questions/documents separately from SQL.

`createDevelopmentActivities` binds one trusted same-operation runtime and
`createDevelopmentWorker` binds a dedicated explicit queue. Nothing registers these
in the actual application. The caller still owns model, pool, connection and worker
lifecycle; no-op grant callbacks are permitted only in named synthetic tests.

Every role has one activity attempt, bounded timeouts and content-free heartbeats.
Cancellation closes admission and aborts the runtime; late dependencies cannot
publish success. Completed checkpoints can be reverified without generation, while
uncertain requests cannot be resent. Do not reset failed workflows or substitute
IDs to bypass that restriction. Future authorized recovery is separate work.
See [0224 evidence](../../intent/0224/EVIDENCE.md).
