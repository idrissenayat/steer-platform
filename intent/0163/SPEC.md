# Spec

Add `intent.brief.decisions` to the shared typed registry and generated HTTP/MCP
surfaces. Require that grant plus current Brief-read and curated raw-content grants.
Input is the existing exact Brief path/revision/SHA-256. Re-read and verify the
Brief first; no fallback to another revision. Discover at most three configured
sibling `signatures/gate-{1,2,3}.json` paths from the existing PostgreSQL projection
reader. Never widen the configured raw-content path set or install real grants.

Read each selected record at its exact revision and verify SHA-256 and Git blob
identity. Bound each JSON record to 32 KiB and parse the existing v1 signature
record's bounded display fields, retaining the original JSON for source inspection.
Display recorded decision, organization/product/item, signer subject/hat/sequence/
time, artifact references and record revision/fingerprint. Match the selected Brief
only by an exact path and revision in its artifact references; do not infer that
artifactRevision or a directory name alone proves coverage. Show mismatches plainly.
Source references are inert text, never arbitrary network/navigation targets.

Return literal `gateVerified:false` and `writeAuthorized:false`. Clearly label all
recorded decisions/signers as unverified source claims, even when bytes and linkage
match. Revalidate identity and all grants after all I/O/parsing and on absence.
Malformed, corrupt, stale, foreign or denied data must not leak partial results.

The local pink/orange Brief dialog gains explicit loading, empty, failed and source
disclosure states, no signing controls, browser persistence or background polling.
Use its existing exact Brief link and clear decision state on refresh/close/hide/
expiry. Test backend and UI together with synthetic native Git/PostgreSQL/Keycloak;
no real credentials/provider writes. This is not a complete decision Inbox.
