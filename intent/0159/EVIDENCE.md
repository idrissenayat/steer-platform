# Development evidence

The focused run passed 15 tests: six new owned-receipt-job groups, the three
existing projection-job groups, and six exact-receipt reconciliation groups.
It covers invalid/expired/human/foreign/hat-bearing projectors, revoked or substituted
identity after readback and source work, trusted input capture, duplicate/no-rewind
CAS behavior, single-flight admission, actual receipt-work drain and one-time closed
shutdown. A post-ingest identity failure leaves one observed write and performs no
retry; shutdown errors remain sanitized and do not reopen admission.

Full `pnpm check` passed with Node 24.20.0/pnpm 11.19.0: kit validation, workflow
scope audit, all seven package typechecks, 88 prototype tests, 437 root controls,
282 adapter tests, 87 API tests, 47 web tests, all remaining workspace tests and
all package/prototype builds. Eligible Turbo steps were cached. API type checking
also passed after the final browser bridge correction. Whitespace checks passed;
protected `intent/0001` and `.github` files stayed unchanged.

The final actual browser run passed 41 checks with Chromium 151.0.7922.34,
Keycloak 26.7.3 and encrypted disposable PostgreSQL. The new job reads receipts via
the actual status endpoint using native same-origin browser fetch with the existing
human session cookie. The status route traverses request-owned writers and the
native temporary Git marker store. A separate synthetic projector ingests exact
source bytes into PostgreSQL. Initial/duplicate runs and replay after a later
selected revision preserve the expected records and six-event feed history.
Committed human status-grant denial blocks the job callback before provider reads.
The existing exact-content reader, access-denial, navigation and cleanup checks pass.

The first browser run failed at the new readback bridge. The initial test-side API
request was replaced with the browser's native same-origin fetch so the bridge uses
the same cookie/origin and certificate-trust path as the tested application.
No certificate validation, authorization control or production code was weakened.
Only the final full browser rerun is the passing evidence for this connection.

Both browser runs cleaned up only their owned Chromium/HTTPS services, synthetic
PostgreSQL/Keycloak containers, temporary data and generated test credentials.
No foreground demo or new visual/qualified accessibility review is claimed.
The original operation is seeded fixture history, not an actual platform save.
The job assumes a trusted authenticated readback callback; its output parser does
not establish independent human provenance. The fixture's pools remain owned by
the parent harness; the child job drains admission before exclusive-record cleanup.
No live runtime job, scheduler, writer, provider permission, gate signature,
production, deployment, release or spending changed. All five R5 findings remain open.
