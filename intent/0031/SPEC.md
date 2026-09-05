# Projection read contract

Add projection.artifact.read to the canonical frozen query registry, generated
discovery and OpenAPI. Input is a strict organizationId, opaque repository key,
normalized relative path and lowercase 40-hex Git revision. Require the explicit
tool grant and a trusted reader binding matching organization/repository/path
before storage I/O. Missing reader or revalidator returns UNAVAILABLE (503).

Await the reader, then independently revalidate current authentication/grants.
Reject identity/type/organization switches, expiry of either identity, clock
regression and removed grants before returning any content. HTTP dispatch awaits
the same registry; no separate route authority or caller-selected service exists.
Preserve the synchronous session.context interface.

The data adapter accepts a fixed organization/repository and 1–1000 unique paths.
Use the bounded runtime pool and existing withTenant transaction/RLS boundary.
Require current_user and session_user both steer_app. Select one parameterized
record key; cap returned JSONB representation, validate strict shape, and enforce
512 KiB UTF-8 content. Check org/repository/path/revision and recompute SHA-256
content and Git blob SHA-1. Missing or valid stale projections return null; invalid
rows/backend failures return generic errors without content or database details.

Output is nullable or a strict kind=projection record with exact input identity,
blobSha, contentDigest and content. Integrity checks establish cache-byte
self-consistency, not independent Git membership, signatures, current HEAD or
protection against coherently forged database contents. Trusted ingestion and
fresh Git-backed authorization remain separate requirements.

Explicit runtime profiles may configure readModel.database and readModel.paths,
paired with readModelDatabasePassword in the separate secrets object. Never
reuse the authentication password implicitly. The optional lazy pool uses only
steer_app; status and shutdown account for both pools, including startup failure.
No default CLI activation, database migration, new dependency or UI change.

Prove the composition with isolated synthetic Git, existing single-path reconcile,
real PostgreSQL and authenticated Chromium/Keycloak. Full repository replay,
durable scheduling/webhooks, production screens and live bindings remain open.
