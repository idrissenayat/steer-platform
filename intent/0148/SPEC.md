# Spec

`intent.brief.destination` is a query generated into both HTTP/OpenAPI and MCP by
the shared registry. Its only input is `organizationId`; any repository, branch,
path, head, hat or authority injection is rejected. Require the exact tool grant
and current same-organization identity, refreshed before and after source I/O.
Humans and hatless service agents can observe if explicitly granted. Agents cannot
acquire signing authority through this query.

The optional service contains one fixed organization/repository/branch and 1–100
unique canonical `items/NNNN-slug/BRIEF.md` paths. Reuse save-contract scope rules.
Return a sorted, detached `brief-destination-observation` with `observedHead` from
the actual Git reader, millisecond UTC `observedAt`, `writeAuthorized: false` and
`gateVerified: false`. Validate the exact 40-character head. Missing configuration,
malformed output, revocation, identity switching, expiration and invalid/backwards
clocks reject with generic errors. Suppress results completing more than 15 seconds
after invocation. This is a bounded-age observation, not a cancellable execution
deadline or a lease on the branch. Existing runtime owns/drains pending work.

The identity runtime accepts an optional `briefDestination: { paths: [...] }`.
Organization, stable `github:repositoryId` and branch come only from its existing
GitHub binding. Construct a frozen validated scope without startup network access.
Read with the existing Contents-read-only adapter. Do not provision grants, load
additional credentials, infer candidate paths from a catalog, or install a writer.
Existing configurations without the field remain disabled for this query.

Paths may already exist; this query does not inspect existence or grant create
rights. A later save must still confirm exact content and recheck identity,
membership, protected authority and current head at action time, with atomic CAS.
Never use this response as gate evidence, a status projection or an authorization
revision. Real configuration and UI integration remain outside this increment.
