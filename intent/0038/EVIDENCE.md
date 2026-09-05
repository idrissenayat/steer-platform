# Development evidence

Verified against parent c67514c1ef77ce50f0dcdcce3a0d76aa9cacd79d plus this
development increment, 2026-09-05 UTC. No gate approval is claimed.

The initial Temporal integration passed ten groups, including two new actual
process tests. The parent observes SIGKILL, starts a distinct PID and verifies
the same workflow execution resumes with unchanged ingestion count and exact
source bytes. A second scenario commits revocation while the worker is dead;
the fresh process fails its later round without further ingestion.

Final service checks use a lazy factory because the installed SDK rejects
shutdown of an initialized-but-not-running Worker. This prevents allocation
before start and drains any constructor already in progress. The installed
Worker.run/shutdown implementation and Runtime shutdownSignals option were
checked; the fixture has one explicit signal owner, not competing SDK hooks.

## Final verification

- pnpm test:workflow:integration: final exit 0, ten groups passed using Node
  24.20.0, checksum-verified Temporal CLI 1.8.3 / Server 1.31.2, actual local Git
  and disposable PostgreSQL. The final child uses the lazy lifecycle service.
- Both crash scenarios observe SIGKILL, not a reported mock restart. The first
  verifies a different PID, unchanged workflow run ID, two completed rounds,
  exact artifact bytes and no additional immutable events on resumed polling.
  The second commits revocation while the predecessor is dead; the replacement
  denies its next activity and SQL event count remains unchanged.
- Healthy replacement processes receive SIGTERM, exit code zero without a signal,
  and acknowledge service stopped, projection database pool closed and native
  connection closed. Parent owns and bounds every child; fallback cleanup can
  kill only those children and does not report a graceful pass if forced.
- pnpm check: exit 0. Kit/scope checks, typechecks, 88 prototype, 22 controls,
  63 API, 57 adapter, 10 registry, 14 data, 5 web and 11 worker tests, plus builds
  passed. Changed worker/API tasks executed; unchanged verified tasks used local
  Turbo cache. No new visual or production browser verification is claimed.
- Five service groups cover single start, actual ordered drain, stop-before-start,
  worker/runtime failures, failed SDK stop with still-pending execution, and stop
  during construction. Worker typecheck/native tests also passed independently.
- git diff --check passed. No package, lockfile, SDK pin or permission changes.

Commands use npm exec --yes --package=node@24.20.0 -- before pnpm. Only owned
test children/workers/server, generated test files and the disposable PostgreSQL
container/tmpfs are cleaned. Passwords are generated and passed to children via
IPC; host credential environment is not inherited. The Git subject is synthetic,
not a real OIDC token or live GitHub installation. No real key, production data,
protected Exam, signed architecture, deployment, release, spending or gate changed.

Limits: the predecessor is killed during a durable timer after acknowledged
activities. No crash during SQL/COMMIT or before activity acknowledgement, fleet
lease, server/database restart, production supervision or restore proof is
claimed. Automatic retries remain disabled. Scheduling/queue authority, source-
derived gate waits/cursors, OTel, production bindings and five R5 findings remain.
