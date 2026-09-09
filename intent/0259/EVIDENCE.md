# Development evidence — 2026-09-08

Base: `2160131f463f43cccf94f311ce3b0e048fa9e43d`.

## Implemented capability

The authenticated `intent.runs.discover` HTTP/MCP query lists both captured scope
and drafting originals across all preserved revisions. Exact metadata bindings,
current records authority, tenant/owner RLS, keyset pagination and unchanged final
snapshots are enforced without content, keys, execution leases or writes.

The actual Next draft UI can select a draft’s run history without replacing text.
Explicit history selection connects the existing scope and original-document
readers; it does not generate, adopt, retry, save or sign. Records deadlines bound
the displayed list and its selected content independently of session expiry.

## Verification

Focused disposable PostgreSQL/SDK run: **six checks plus idempotent migration**
passed. This includes all-revision recovery, 24-reference pagination and stale
cursor rejection, owner/grant/role/corruption denial, late access/source changes,
lifecycle exclusions, and actual composed 34-source/two-role history after edits.
Only this run’s synthetic container and tmpfs data were removed afterward.

Targeted shared-query, HTTP/MCP, bounded transport, data admission/close and
architectural-boundary tests passed. Production React tests cover explicit older
run selection, original/current comparison, separate scope-history denial,
pagination, no automatic work or editor replacement, stale response suppression,
visibility/session clearing and accessibility with color contrast excluded
(JSDOM has no layout engine).

Final **1,199/1,199 regression tests** passed, including records-expiry clearing of
selected history and metadata. The kit (95 required artifacts) and workflow
token-scope audit also passed. All **230 local links across 12 checked documents**
resolve; `git diff --check` passes. The protected Architecture, Exam and accepted
retention-policy hashes remain unchanged. Full **356/356 PostgreSQL 16.14
integration checks** passed, including the five new discovery checks and the
extended composed SDK history scenario. Only the full run’s synthetic container
and tmpfs data were removed afterward; no live records were migrated or deleted.
All eight package typechecks plus prototype types and optimized Next 16.3.4 build
passed. A test fixture’s discriminated union needed an explicit scope-kind check;
production validation and authentication were not weakened.

The existing actual `https://localhost:8443/` browser tab was inspected read-only.
It showed the STEER sign-in page, not a signed-in history journey. No credentials
were inspected, no session bypassed and no live UI acceptance inferred.

## Authority and continuity

All records/model evidence above is synthetic. D1 and the proposed $5 model
budget remain inactive/unapproved. The credential-safety skill preserved the
already-resolved key decision without inspection or paid calls. The complete local
Next client/server guide kept browser imports public and verification server-side.
No live migration, real runtime Git save, gate, deployment, release or deletion.
The one-minute loop remains active. User-owned roadmap/outputs are untouched.
