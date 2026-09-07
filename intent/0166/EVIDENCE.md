# Evidence

Integrated verification, full checks and browser regression passed on 2026-09-07.

With Node 24.20.0 / pnpm 11.19.0, `pnpm check` passed kit validation, scope audit,
all typechecks, 88 prototype tests, 438 root controls, 99 registry, 24 data, 53 web,
283 adapters, 91 API, 23 worker and 13 domain tests, plus all builds. Eligible Turbo
tasks were cached. No production/front-end source, dependency, schema, protected
intent/0001, GitHub policy or live configuration changed.

`pnpm test:auth:browser` passed all 42 existing checks with Chromium 151.0.7922.34
and Keycloak 26.7.3. This revalidates authoring/review, real encrypted sessions,
native Git/PostgreSQL reads, exact links, decision/evidence inspection, responsive/
keyboard/automated-accessibility controls, revocation, recovery and owned shutdown.
Those browser status fixtures still use seeded operation history; this regression
does not turn the new API-level created record into a browser-created save. No new
visual design or foreground localhost:3000 demo availability is claimed. Only owned
Chromium, HTTPS, PostgreSQL, Keycloak and generated TLS/test credentials were cleaned.

`pnpm test:workflow:integration` passed all 25 checks using actual Temporal CLI 1.8.3 /
Server 1.31.2, SDK 1.23.0, native Git and PostgreSQL 16. Three new groups join actual
HTTP preview/save, lost acknowledgement, later unrelated HEAD, reconstructed current
status readback, queued runtime reconstruction, durable projection and exact curated
catalog/Brief reads. The saved Brief/marker pair is not seeded. Its revision, SHA-256,
Git blob and content match the rendered HTTP preview. Creation alone leaves the
catalog empty; replay, duplicate workflow/save and fresh runtime readback preserve
one Git mutation and one ingestion event.

The actual bound activity separately denies current human status permission and
projector permission without further source/SQL work. Curated API reads deny foreign
scope/unconfigured paths, return null for stale revision/digest and deny revoked raw
read grants. Restoration recovers the original exact record. History inspection
finds no source text, receipt subject, credential or receipt-payload fields.

The existing `pnpm test:brief:integration` passed all three groups after extraction
of its shared harness. Worker and API typechecks passed. The Temporal server emitted
one non-fatal metrics-trailer error during an existing gate-watch case; all 25 checks
and process cleanup completed with exit zero. No functional failure was suppressed.
Owned workers, server, disposable Git directories, PostgreSQL/tmpfs and reader pools
were closed. No real repository record, credential or provider configuration changed.

Limits: identities, full write authority and network transport are explicit test
doubles; Git object creation, SQL, workflow execution, request-owned writer/status
mechanics and shared tool reads are actual. This is in-process HTTP tooling, not a
real GitHub write or authenticated browser creation demonstration. The new access
denial cases call the bound activity directly; the happy path runs through Temporal.
No live save/scheduler, deployment, release or spending is enabled. All five R5
findings, full governed authority, independent/qualified protected review and human
gate signatures remain open. Remote verification follows the candidate commit.
