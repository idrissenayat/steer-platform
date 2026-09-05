# Authenticated artifact projection reads

POST /v1/tools/projection.artifact.read accepts a strict JSON object containing
organizationId, repository (for example github:1349965471), path and an exact
lowercase 40-hex revision. It uses the same registry as session.context and its
generated OpenAPI. Existing bearer verification or browser cookie/Origin rules
apply. An explicit projection.artifact.read grant is mandatory.

Trusted composition supplies a fixed organization/repository/path allowlist.
The registry checks it before I/O and reauthenticates after I/O before returning
content. The optional reader uses a separate steer_app PostgreSQL login, forced
RLS, parameterized record keys and the existing bounded pool/transaction limits.
There is no arbitrary query, repository browser or write endpoint.

A successful record contains kind=projection, organizationId, repository, path,
revision, blobSha, contentDigest and content. Content is at most 512 KiB UTF-8.
A missing or valid stale row returns null: callers must not quietly substitute
another revision. No configured backend returns 503; authorization failures deny;
corrupt rows and backend errors are sanitized. No artifact content is logged.

SHA-256 and Git blob SHA-1 checks establish internal byte consistency only.
The response is not a Git commit-membership proof, current-HEAD claim, signature
or authorization record. A coherently forged database row is not independently
detectable here. Git remains the sole authority; trusted source ingestion builds
disposable projections, and permission resolution reads current Git separately.

## Explicit runtime binding

Increment 0051 adds a structured Brief read on this same curated reader. It
requires both intent.brief.read and projection.artifact.read, an expected digest,
and the exact selected revision. See AUTHENTICATED-BRIEF-READS.md. Raw-content
permission and scope are not widened by this derived tool.

Increment 0052 adds an optional catalog capability to this reader, selecting only
its already-curated Brief metadata with three explicit grants. It reuses the same
pool and role, without needing repository-wide snapshot permission. See
BRIEF-CATALOG.md for complete-set bounds and metadata/integrity limitations.

The identity runtime profile optionally accepts readModel with database settings
matching the existing database transport schema and 1–1000 unique relative paths.
Organization and repository are derived from the fixed GitHub binding, not input.
The separate secrets object must supply readModelDatabasePassword if and only if
readModel exists. The encrypted secret bundle supports the same optional field.
Never place that password in the profile, Git or logs. No implicit reuse of the
steer_auth_runtime credential occurs; readModel always uses steer_app.

Both pools are lazy and bounded. Service shutdown/startup-failure cleanup owns
both; content-free status includes readModel only when configured. Default CLI
startup remains unconfigured and denies authenticated operations.

## Verification and remaining work

The isolated browser suite commits an artifact to synthetic Git, reconciles that
single path through existing ingestion, then reads its exact revision through
PostgreSQL and the authenticated HTTP tool. It tests foreign org/path denial,
stale revision and Git-committed grant removal/restoration. Unit tests additionally
revoke authorization during the awaited read. Real PostgreSQL checks cover role,
RLS, integrity failure and repair of an owned synthetic projection.

Run pnpm test:auth:browser, pnpm test:data:integration and pnpm check using the
repository Node version. See intent/0031/EVIDENCE.md. This is not a production
worker, webhook consumer, full repository replay or operating-surface UI. No real
user/GitHub credential or production database is required by these tests.
