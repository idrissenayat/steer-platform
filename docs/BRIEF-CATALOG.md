# Curated Brief discovery

Increment 0052 adds intent.brief.catalog to the same HTTP/OpenAPI/MCP registry.
It accepts only organizationId and repository scope ID. The response contains
kind=brief-catalog, that scope, and ordered records with path, revision and
contentDigest. A selected record supplies the exact tuple for intent.brief.read.

Catalog, Brief-read and curated-content grants are all required, with current
authorization before and after metadata I/O. The catalog cannot confer any of
those grants. Agent identities cannot acquire human hats through this operation.

## Scope and completeness

The existing optional readModel runtime binding supplies at most 1000 unique
paths and a separate steer_app database connection. The reader now offers an
optional catalog method; older injected readers without it remain unavailable.
No new credential, role, migration, pool or implicit provider connection is added.

Only curated root BRIEF.md or numbered intent Briefs are included. The database
query uses the corresponding exact private projection keys, not a prefix scan
or browser-supplied allowlist. It returns metadata in one MVCC statement under
forced organization RLS and verifies the actual app login role. Uncurated files
and curated non-Brief files remain absent, with no count or content leakage.

The complete bounded result is sorted by path. A 1001st row, duplicate path,
invalid fingerprint/revision, mismatched path/key or unexpected selected metadata
fails the whole request. Corrupt scalar extraction is byte-bounded in SQL before
returning it to the process. There is no silent partial result or unrestricted
repository inventory. An empty catalog means no matching projected rows, not
proof that authoritative Git has no Briefs or that ingestion is caught up.

## Using the result

Pass the selected path/revision/fingerprint to intent.brief.read with the same
scope. That operation independently checks content/blob consistency and current
read grants. Catalog metadata itself does not verify the bytes, current Git HEAD,
authorship, semantic completeness, lifecycle, WIP, gate state or approvals.
No status/title is fabricated from the artifact path and no source URL is followed.

This capability prepares automatic discovery for the rendered workspace; it is
not the final backlog/detail UI and does not add manual source-path or digest
entry to the agent-first originator journey. Trusted workspace repository display
binding and that UI remain next. No background polling or browser cache is added.

Evidence: intent/0052/EVIDENCE.md. Five R5 findings, canonical gate proof and all
formal/manual/operational/release requirements remain separately open.

## Current projected work-list source previews — 0173

The rendered library supports current canonical `items/<id>/BRIEF.md` selections
as well as readable legacy Briefs. Its per-item Preview button performs a new
exact-tuple `intent.brief.read`; it does not expand the catalog or prefetch document
bodies. Only one in-memory summary is retained. The source title and bounded literal
Problem/Proposed outcome excerpts are displayed with the selected revision.

Missing, empty and ambiguous sections are labeled explicitly. Duplicate sections,
unsafe document structure or inconsistent source offsets never select a convenient
answer. Long excerpts are visibly shortened without breaking Unicode pairs; Read
opens the full exact Brief through another current-authorized read. Source text is
inert, not an AI summary, verified measurement, routing fact, gate state or approval.

Summaries clear on explicit clearing, another read, pagination, refresh, lifecycle,
scope/session expiry and access failures. Clearing returns keyboard focus to Preview.
Nothing is persisted, polled or written. This advances candidate inspection only;
the remaining backlog actions and authenticated lifecycle/decision board are not
implemented by these excerpts. See `intent/0173/EVIDENCE.md`.
