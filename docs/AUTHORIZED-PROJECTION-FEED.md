# Authorized projection-feed tool

Increment 0045 adds projection.changes.read to the shared tool registry. HTTP
POST /v1/tools/projection.changes.read and MCP call the same handler. Discovery,
OpenAPI and MCP schemas are generated from the same bounded Zod contracts.
This is a query, not an SSE subscription, artifact snapshot or approval signal.

## Authority and composition

The caller supplies organizationId, repository, cursor (or null) and limit
(1–100). The internal reader has a fixed trusted organization/repository binding.
Input/service/cursor must match exactly. A cursor contains no authority; the
caller needs projection.changes.read, separate from projection.artifact.read.
The feed grant exposes repository-wide reference metadata, not just the curated
artifact paths, and must be assigned deliberately in the authorized Git source.
No existing real grants were changed.

The shared handler refreshes same-subject/type authority before and after I/O,
including before returning a reset. Expired/revoked identities, agents with human
hats, changed identity, failed source lookup and regressing clocks deny. A reset
exception is not permission to release a result after revocation. Generic provider
failures do not become a reset or empty success, and private error text is hidden.

Identity runtime opts in only with readModel.changes: true. The reader uses the
existing bounded steer_app read pool and the exact configured GitHub repository;
it does not allocate a third pool or discover credentials. The ordinary readModel
configuration without this flag does not enable feed access. Default CLI stays
closed/unready, and no live profile has been activated.

## Result contract

A page result carries outcome: page, organization/repository, content-free event
references, next cursor, hasMore and snapshotRequired. Decimal strings preserve
positions above JavaScript's safe integer range. Output validation checks scope,
generation, contiguous positions, page bounds and exact next cursor arithmetic.
Silent resets, skipped positions and inconsistent continuation metadata fail.

A typed missing/stale/future/gapped cursor yields outcome: reset-required with
scope only, after current authorization. It contains neither events nor an
automatically advanced cursor. The client must explicitly resnapshot, not skip
ahead. Initial null-cursor reads retain snapshotRequired: true; partial change
pages are not a complete current repository view.

The data layer imports the canonical cursor/page contract rather than maintaining
a second copy. Its prior cursor/reset exports remain compatibility re-exports.
Storage ordering and reset limitations remain in docs/PROJECTION-CHANGE-FEED.md.

## Verification and remaining work

Native tests cover hostile inputs/results, missing composition, pre/post
authorization and exact decimal resume. Official MCP/HTTP parity and real
Keycloak/Chromium/Git/PostgreSQL exercises are recorded in intent/0045/EVIDENCE.md.
The browser exercises call the API; no feed UI or new visual feature is claimed.

Initial snapshot/checkpoint consistency, public SSE, canonical gate source/proof
verification, operating screens and operational reset/retention policy remain
open. Derived projection references cannot satisfy a gate or override current Git
authority. The five R5 findings and formal gate/live-access/spending boundaries
are unchanged.
