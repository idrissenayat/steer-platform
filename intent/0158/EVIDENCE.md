# Development evidence

Six focused adapter tests passed: exact receipt/source binding and duplicate CAS,
different-revision preservation, reader binding captured across awaited I/O,
strict configured scope, corrupted/oversized/non-roundtripping UTF-8 source bytes,
and abort/CAS failure behavior. Post-ingest cancellation explicitly retains the
observed write rather than claiming rollback.

The final actual browser run passed all 41 checks with Chromium 151.0.7922.34,
Keycloak 26.7.3, encrypted disposable PostgreSQL and native temporary Git history.
The existing receipt-to-Brief fixture now calls the production reconciliation
helper for initial ingestion, duplicate replay and replay after a different revision
is selected. It verifies the actual selected database revision is not rewound.
The browser still opens only the exact permitted source, rejects the stale receipt
after advancement, and rechecks access after grant changes. Duplicate replay adds
no extra derived event; the existing six-event feed assertion passes unchanged.
No new browser-response interception or source HEAD fallback was introduced.

An initial typecheck identified a test attempting to mutate the reader's readonly
interface. The fixture now retains its own mutable backing binding to exercise the
runtime mutation boundary without a cast or weakening the production interface.
The final full `pnpm check` passed with Node 24.20.0/pnpm 11.19.0: kit validation,
workflow scope audit, all seven typechecks, 88 prototype tests, 437 root controls,
276 adapter tests, 87 API tests, 47 web tests, all remaining workspace tests and
all package/prototype builds. Eligible Turbo tasks were cached. Whitespace checks
passed; protected `intent/0001` and `.github` files remain unchanged.

Browser verification cleaned up only its owned Chromium/HTTPS services, synthetic
PostgreSQL and Keycloak containers, tmpfs data and generated test credentials.
No foreground preview or new visual/qualified accessibility review is claimed.
The adapter still relies on trusted authenticated receipt composition and the sink's
projector identity/CAS; it does not authenticate arbitrary receipt claims itself.
The runtime has no installed live receipt job, automatic path admission, writer or
scheduler. No real provider writes, lifecycle/gate authority, signatures, deployment,
release or spending changed. All five R5 findings remain open.
