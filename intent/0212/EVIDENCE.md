# Development evidence — 2026-09-07 (local time)

Base: `2f88778818a3dbc8c86c3fb3ce22a03f75b868bd`.

## Delivered boundary

The uninstalled candidate store now exposes `reconcile(originalRequest)`. It
requires a separate `authorizeReconciliation` port; existing read and operation
permissions are still required. Without that service, the method returns unavailable
before SQL/provider access. Ordinary inspect/save and the Temporal activity do not
invoke it automatically.

Reconciliation checks exact original admission/draft/step binding, reads the actual
verified Git receipt and complete bundle through the native reader, then checkpoints
only digest/reference metadata using the existing one-way SQL transition. The
versioned result digest binds organization, operation/final input, original commit/
head and manifest/pointer digests. Later unrelated commits do not change it.

The result reference identifies the original operation receipt. A short-lived
immutable proof is created only from this composition's successful native read;
caller values cannot install it. Git readback completes before SQL begins. The SQL
checkpoint port checks exact proof binding and a five-second monotonic lifetime,
and result release rechecks lifetime and current authority. Proof is cleared after
each attempt. No provider read or model call is held inside the SQL transaction.

Only dispatch-committed and already-succeeded candidate steps qualify. Manually
quarantined outcome-unknown or known-failed steps remain unchanged, even if a receipt
exists; their explicit resolution is separate work. Lost checkpoint acknowledgement
may leave SQL succeeded while returning unknown. A fresh explicit reconciliation
verifies the original receipt again and acknowledges that same result, never a new
Git mutation. A persisted checkpoint does not substitute for future current read
authorization or prove a gate signature.

## Verification

- `pnpm test:data:integration`: **77/77** checks pass on PostgreSQL 16.14 with
  native Git and the owned Temporal 1.31.2 server. Nine new reconciliation checks
  cover separate authority, unchanged read-only status, exact SQL result/reference,
  duplicate reconciliation after later unrelated commits, uncertain Git/SQL
  acknowledgements, receipt corruption/absence, revoked grants, close and preserved
  failure/quarantine. Real delays exercise proof expiry and retained admission.
- Worker/data/domain/registry and local migration-control suites: **275/275** pass
  on Node 24.19.0. Malformed reconciliation input also denies before SQL/Git I/O.
- Full prototype/eight-package typecheck, kit validation (95 required artifacts),
  workflow token-scope audit and whitespace checks pass. Signed architecture,
  protected Exam and accepted records-policy hashes remain `9e1783a5…`, `84ad1d4c…`
  and `f8a9cb9a…`. No application bootstrap or workflow invokes reconciliation.
- The existing candidate Temporal tests remain in the combined integration run.
  This increment does not claim a new browser/visual test, live account acceptance
  or another run of the separate legacy Temporal suite.

## Test boundaries and remaining work

Tests use the existing owned disposable PostgreSQL/native-Git/Temporal harness and
synthetic current-authority ports. Actual native Git receipt corruption, absent
provider results and SQL commit-response loss are injected; no live account or
credential is used. Delayed authority calls exercise real proof expiry and retained
admission. No original draft text is stored by this checkpoint; the approved encrypted
original-payload store is still missing.

There is no public reconciliation tool, automatic invocation, qualified quarantine
resolution, original-payload persistence, live authority binding, durable development
role path or actual UI save/reopen acceptance here. Reconciliation hashes/status are
operational records, not anonymous data or approval to persist them in the real
workspace. D1 adoption and the first live model-test budget remain unapproved;
runtime writes remain closed. No real database/schema, key, grant, service, budget,
accepted policy, signed architecture, protected Exam or user file was changed.
