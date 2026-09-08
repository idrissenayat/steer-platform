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
and validate those records. These bindings are not implemented here. The integration
fixture uses synthetic responses and an in-memory observation map; it cannot serve
as the production verifier. Likewise, current identity/profile/source/records and
spending authority must not be replaced with no-op callbacks.

Under Node 24, run `pnpm --filter @steer/worker test` for unit tests and
`pnpm test:data:integration` for the disposable PostgreSQL composition checks.
`pnpm test:workflow:integration` tests the existing Temporal paths, not this runner's
future Temporal registration. See [0221 evidence](../../intent/0221/EVIDENCE.md).

Increment 0222 adds `@steer/data/development-observations`: separately immutable,
encrypted request/response storage under current draft/source/step authority. A new
integrated fixture verifies this runner against actual SQL observations with fresh
readers, not the in-memory map. Production transport serialization, response parsing
and usage extraction must still be connected to this journal; supplied body bytes
and adapter labels alone are not provider proof. No runner/model/API registration
or live storage authority is added. See [0222 evidence](../../intent/0222/EVIDENCE.md).
