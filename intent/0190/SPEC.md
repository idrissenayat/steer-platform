# Spec

Register query `intent.brief.artifacts` in the existing shared registry, HTTP,
OpenAPI and MCP paths. Require its distinct grant plus `intent.brief.read` and
`projection.artifact.read`; revalidate every grant and principal during reads and
before returning, including absent Brief and unconfigured sibling cases.

Accept only the existing exact Brief input. Verify that Brief, then inspect its
fixed sibling SPEC, EXAM and PLAN at the same commit and only within existing path
curation. Never list the repository, accept client-selected siblings, fall forward
to latest content or add curation. Maximum four sequential source reads, each
bounded by the existing 512 KiB UTF-8 contract and exact tuple/hash verification.

Return exactly three ordered entries, each `projected` with SHA-256/blob fingerprints,
`not-projected` with null fingerprint, or `not-configured` with null fingerprint.
Do not return body content or interpret any approval text. Always return null stage
and false gate/write flags. Strict output validation must reject malformed paths,
wrong/duplicate/missing entries, status/fingerprint mismatch and injected authority.
Missing or wrong-digest Brief returns null. Failure/corruption/revocation denies the
whole response; no partial records or source-bearing error escapes.

Document projection absence versus Git absence and the non-atomic observational
nature. This cannot supply verified lifecycle authority or complete J3 on its own.
No live activation or frontend mounting is included.
