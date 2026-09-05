# Development evidence

Baseline 02f8e4a0bc3f60f518e214298d9cdacef10f02fd plus this increment,
2026-09-05 UTC. No gate approval is claimed.

The installed Temporal 1.23.0 declarations provide typed
WorkflowExecutionAlreadyStartedError and WorkflowNotFoundError through the client
package. Those classes, not provider message text, classify duplicate and missing
execution results. Other start/status failures remain unknown.

Five new registry groups cover scope/caps/injection, refresh/expiry/revocation,
missing composition, uncertain mutation receipts and post-I/O status authority.
Two new client groups cover immutable routing, config validation and typed error
classification. Existing official MCP/HTTP parity now covers all four tools,
including command annotations. Actual Temporal integration adds canonical
scheduling, pre-dispatch denial, missing/completed status and duplicate checks.

## Verification

- pnpm check: exit 0 on Node 24.20.0. Kit/scope/boundary checks, typechecks,
  88 prototype, 22 controls, 63 API, 57 adapter, 15 registry, 14 data, 5 web and
  13 worker tests and all builds passed. Changed tasks executed; unchanged
  verified tasks used local Turbo cache. An initial new-test type error was
  corrected by wrapping a generic possibly synchronous invocation for rejects.
- pnpm test:workflow:integration: exit 0, eleven groups passed against
  checksum-verified CLI 1.8.3 / Server 1.31.2 on Darwin ARM64. Canonical tools
  observe typed not-found, deny revoked/over-cap starts without activity, start
  one execution, inspect its exact completed run ID and refuse a retained
  duplicate without another activity. The new dispatch case uses a synthetic
  activity port; existing actual Git/PostgreSQL/SIGKILL checks also pass.
- No dependency versions, lockfile or permission settings changed. The adapter
  snapshots trusted config; it does not create or authorize a live connection.
- pnpm test:auth:browser: exit 0. The freshly built Next.js renderer and actual
  isolated HTTPS/Keycloak 26.7.3/Chromium 151.0.7922.34/PostgreSQL path pass 25
  counted groups plus the inventory checkpoint, including shared MCP discovery,
  encrypted sessions, exact projection bytes, committed grant revocation,
  keyboard/responsive/automated accessibility checks and owned shutdown.
- git diff --check passed. Root documentation and the component capability
  record identify optional scheduling without claiming live cluster authority.

Commands use npm exec --yes --package=node@24.20.0 -- before pnpm. The harness
closed only owned workers/server/children and disposable PostgreSQL/container
and generated files. No new visual QA or combined OIDC-to-Temporal proof is
claimed. Browser identity/MCP regression is separate from the synthetic-identity
canonical scheduling test; no interactive manual accessibility review is claimed.

No live key, GitHub permission, grant record, protected Exam, signed architecture,
deployment, release, spending or gate has been changed. Synthetic identities and
owned disposable services are not production integration or approval evidence.
