# Development specification

## Source contract

`createGitGateObserver(...).collect({ sourceRevision, decisionDigest })` is an
internal read-only method on the existing configured observer. Strict input
requires an exact 40-character source commit and 64-character SHA-256. It shares
the observer's agent-only `gate.observe` authorization, configured organization,
repository, branch, item, gate, artifact revision/path set and record path.

Read the expected current head, each configured artifact at the governed revision
and current head, and the gate record through exact inventory membership. Verify
scope, path, revision, UTF-8 round trip, SHA-256 and Git blob hash for all snapshots.
The record must match configured organization/product home/item/gate, exact
artifact revision and complete unique artifact-path set. Collection rejects
changed artifacts, missing or stale records and a different record digest. Recheck
the agent and head before returning, including both identities' expiry after the
last head read. An unavailable source never becomes absence or a cached approval.

Return copied, frozen record/artifact snapshots and a frozen artifact array with
source/configuration coordinates. Retain original record bytes, including provider
metadata, rather than reconstructing a lossy normalized JSON record. Drop adapter
extras. Do not expose the bundle through HTTP/MCP or log its potentially sensitive
content. Existing `observe()` still returns only its three prior fields and keeps
its absence/staleness behavior.

The observer remains single-flight across both methods; shutdown rejects new work
and waits for the actual outstanding operation. Existing limits remain ten
governed artifacts, 512 KiB per snapshot and 100 inventory entries. The concrete
GitHub reader supplies its existing per-request timeout/response bounds. This
change adds no overall operation deadline, cancellation or freshness lease.

## Deliberate non-authority

Every bundle says `providerVerificationRequired: true`, `gateVerified: false` and
`writeAuthorized: false`; it fails the Brief-write authority schema. Even a
matching send-back record can be collected. Signer hats, provider sessions,
declarations and decisions in raw Git bytes are not independently verified facts.

The caller must still verify provider-recorded evidence, actual human/qualified
hats, applicable policy and prerequisite, fresh independent Critic and domain
evidence, and bind them with current request membership and platform revision.
The existing canonical Gate 1 uses an `openai-codex` provider-recorded proof;
collecting it does not validate that proof or silently select a different provider.
The missing approved Gate 2 remains a live-use boundary. No actual writer is
installed and the runtime App remains read-only.

## Verification scope

Exercise exact source bytes, failed pins, stale/changed/absent/corrupt records,
revocation, final-read expiry, shared shutdown/single-flight, immutable copying,
malformed UTF-8 and unchanged legacy response shape. Compose the collector with
the actual GitHub reader through synthetic HTTP responses, asserting only scoped
read-token issuance and GET source requests. Synthetic transport tests do not
prove actual GitHub enforcement or a human signature.
