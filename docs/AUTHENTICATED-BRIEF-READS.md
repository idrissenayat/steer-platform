# Authenticated Brief document reads

Increment 0051 exposes intent.brief.read through the shared registry, HTTP
POST /v1/tools/intent.brief.read, generated OpenAPI and MCP. Human cookie rules
and agent bearer rules remain unchanged. This tool never signs or writes.

## Contract

Provide organizationId, canonical repository scope ID, curated path, exact
lowercase 40-hex source revision and expected lowercase 64-hex contentDigest.
Supported paths are BRIEF.md and intent/<four or more decimal digits>/BRIEF.md.
No arbitrary source URL, authorization file, Exam or source-discovery operation.

Both intent.brief.read and projection.artifact.read grants are required. The
existing readModel runtime binding supplies the bounded curated path allowlist
and separate steer_app pool. No new activation setting, credential, grant or
database table is introduced. An unconfigured runtime remains unavailable.

The result is null when the selected revision is unavailable or the expected
digest differs. A successful brief-projection includes the original artifact
fields/content and a document object from BRIEF-DOCUMENT-MODEL.md. Unknown and
duplicate sections and structural issues remain visible rather than rewritten.
MCP wraps the identical result in structuredContent.result.

The source remains bounded to 512 KiB UTF-8; the structural model retains its
16,384-line / 128-section / 512-character heading bounds. The response includes
both original content and structural bodies for traceability, so clients must
budget for JSON escaping and this duplication. No unbounded collection read.

## Authority and integrity

Initial identity, both grants and exact runtime scope are checked before reading.
Identity is refreshed before I/O; the underlying curated projection read checks
it after I/O; the Brief operation refreshes both grants again after digest/model
work. Revocation, changed identity/type, expired or regressing clocks and agent
human hats deny. No stale authorization fallback or implicit new permission.

SHA-256 and Git blob SHA-1 are independently recomputed from the returned bytes
before constructing the document. This detects inconsistent adapter/database
claims, but not a coherently forged source record. As with raw projections,
these checks are not Git commit-membership/current-HEAD proof, authenticated
authorship, semantic correctness, workflow state or gate approval. Current
authorization still comes from the separate Git-backed identity resolver.

Raw source/HTML/instructions are data. A renderer must not execute them or treat
Author/Status text as authenticated facts. The final detail view follows the
rendered, no-raw-Markdown-toggle design; this API does not introduce a manual
originator workflow. Increment 0052 adds curated discovery through
intent.brief.catalog (see BRIEF-CATALOG.md); rendered workspace binding remains next.

Evidence: intent/0051/EVIDENCE.md. Five R5 findings and the canonical gate-proof,
formal/manual/operational and release requirements remain open.
