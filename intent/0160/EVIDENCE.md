# Development evidence

Four focused runtime tests passed without network/database connections: lazy
construction and owned-pool closure, strict/foreign/unsafe configuration denial,
invalid projector and receipt-failure sanitization, and actual admitted-readback
drain before shutdown with overlap/reopening denied. All seven typechecks passed.

Full `pnpm check` passed with Node 24.20.0/pnpm 11.19.0: kit validation, workflow
scope audit, all package typechecks, 88 prototype tests, 437 root controls,
282 adapter tests, 91 API tests, all remaining workspace tests and all package/
prototype builds. Eligible Turbo steps were cached. Whitespace checks passed and
protected `intent/0001` and `.github` files remained unchanged.

The actual browser run passed all 41 checks with Chromium 151.0.7922.34 and
Keycloak 26.7.3. Its native same-origin status readback, temporary native Git source
and encrypted PostgreSQL session path now use the production recorded projection
runtime and its own bounded PostgreSQL projector pool. The fixture asserts lazy
construction, actual selected revision after ingestion, duplicate replay, preserved
selection after advancement and human status-grant denial. The existing exact-Brief
reader and six-event derived feed checks still pass. Shutdown explicitly verifies
the runtime pool is closed with no active leases and further runs reject before
exclusive synthetic-record cleanup.

The run cleaned only owned browser/HTTPS services, synthetic PostgreSQL/Keycloak
containers, tmpfs data and generated test credentials. No foreground demo, new
visual review or qualified accessibility review is claimed. Parent fixture pools
inspect/advance the test projection; they no longer implement the new runtime sink.
The exact exclusive source event is tracked before dispatch for test cleanup after
uncertain acknowledgment; this is not real-record deletion authority.

The source operation remains seeded fixture history, not a successful platform save.
Source/readback authentication remains an explicit trusted caller composition; the
runtime does not acquire provider access, impersonate humans or authenticate receipt
provenance independently. It is not installed or enabled live and has no automatic
trigger, scheduler, public endpoint or writer. All five R5 findings, independent/
qualified review and human gates remain open. No production, deployment, release,
provider permission or spending changed. The standing overnight loop remains active.
