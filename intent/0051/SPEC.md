# Specification

1. Add read-only intent.brief.read to the shared tool registry. Strict input:
   organizationId, canonical repository scope ID, path, lowercase 40-hex revision
   and lowercase 64-hex contentDigest. Path is BRIEF.md or intent/<at least four
   decimal digits>/BRIEF.md, also subject to existing safe path and length checks.
2. Require both intent.brief.read and projection.artifact.read. Trusted runtime
   composition must already supply the existing fixed organization/repository and
   curated path reader. No new default backend, grant, role or credential is created.
3. Validate input, initial identity, exact curated scope and both grants before
   source I/O. Refresh identity before dispatch; use the existing projection query
   and its post-read authorization/result checks. Refresh both grants again after
   digest verification and parsing, including absent/stale results.
4. Initial expiry, current revocation, identity/type switch, clock regression and
   agents holding human hats deny. Invalid input denies before I/O; unconfigured
   service/revalidation returns unavailable; private errors never reach the caller.
5. Independently recompute SHA-256 content and Git blob SHA-1 (header plus actual
   UTF-8 bytes) using standard Web Crypto. Inconsistent reader claims fail closed.
   A missing/unavailable selected revision or different selected digest returns
   null, never another revision or a fabricated Brief. Digests are byte-consistency
   checks, not independent Git membership/HEAD or signature proof.
6. Successful output is kind=brief-projection plus the unchanged bounded artifact
   fields/content and the canonical structural document model. Preserve raw source
   for exact traceability; consumers must render safely, not execute HTML or source
   instructions. Structural issues are not workflow states or acceptance findings.
7. Canonical strict JSON schemas drive OpenAPI and MCP discovery. MCP returns the
   same result in structuredContent.result. No transport-specific implementation.
8. Native tests cover source/structure, both grants, scope/path, missing services,
   malformed content/digests, absence and pre/post authorization failures. Actual
   synthetic Keycloak/Git/PostgreSQL checks exercise agent MCP and human browser
   HTTP, with committed removal of each grant and subsequent recovery.
9. No new UI, catalog, live source profile, repository write, gate approval,
   production deployment or spending. Authenticated catalog/detail binding is next.
