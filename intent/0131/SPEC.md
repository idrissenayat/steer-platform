# Development specification

## Configuration and input

`createGitProviderProofReader(reader, configuration, dependencies)` adds an internal
read-only composition. Configure one organization/repository/branch, an exact
trust path and trust SHA-256, and one to 100 unique proof paths excluding the trust
path. Repository and branch must match the reader binding. The bootstrap must
select an authorized trust pin separately; this function does not approve it.

Each internal request names an expected current source revision, allowlisted
proof path, proof-file SHA-256 and the strict expected provider claims from 0130.
The full caller must derive these facts/references from the governed record, not
accept them as user assertions. Unknown configuration/request fields and scope
expansion deny. No HTTP/MCP endpoint or runtime composition is added.

The injected authentication callback must perform actual current authentication
and grant resolution. Admission and post-read checks require the same current
agent subject in the configured organization, no human hats, an unexpired
principal and `gate.observe`. This is source-reading permission, not human
approval or write membership. Tests supply synthetic principals explicitly.

## Read and verify sequence

1. Verify the current reader identity and exact expected branch head.
2. Read trust then proof at that revision. Verify organization, numeric repository
   ID, path, revision, UTF-8 round trip, expected SHA-256 and Git blob SHA-1.
3. Copy the validated content/reference fields so mutable adapter objects cannot
   substitute them after verification.
4. Recheck the agent, branch head, monotonic bounded clock and both principal
   expiries. Invoke the actual 0130 verifier at the recorded evaluation time.
5. Require the verifier's canonical trust/proof digests to equal the source-file
   digests. This profile requires schema-ordered compact outer JSON as well as
   the already-canonical signed payload; matching raw hashes alone cannot bypass
   duplicate/unknown fields or alternate serialization.
6. Recheck deadline/identity expiry and return immutable source references plus
   the cryptographic observation. No raw source content is returned by this wrapper.

A changed trust source fails its old configured pin, including a newly recorded
revocation. Reconfiguring a synthetic/newly authorized pin still cannot bypass
the verifier's effective revocation or expiry checks. There is no source cache,
unknown-as-absence result, automatic key rotation or old-source fallback.

## Bounds and lifecycle

Trust content is at most 16 KiB, proof-envelope content at most 64 KiB; the inner
payload retains 0130's 16 KiB bound. Source failures use a generic error without
contents or credentials. Configuration parsing is separate from operation errors.

Work is single-flight per instance. A real 15-second timer and monotonic elapsed
checks bound the result. A timed-out source call remains owned and blocks further
work until it drains; no cancellation of an arbitrary injected reader is claimed.
After it returns, timed-out work may not begin another read or return evidence.
Shutdown stops admission and waits for the actual outstanding work. This follows
the existing observer lifecycle, not detached retries or parallel accumulation.

## Evidence, not authority

Output is a `git-provider-proof-observation` carrying exact source references and
the 0130 result, with `gateVerified: false` and `writeAuthorized: false`. The inner
current-source and qualification-required flags remain: the whole decision/trust
authorization chain has not been verified merely by these two file reads. Output
does not satisfy `BriefWriteAuthority` and has no future-use freshness lease.

The current production openai-codex Gate 1 remains unchanged and is not converted
to a signed envelope. This increment retrieves the 0130 development profile from
configured Git files; it does not demonstrate actual applicable production-provider
evidence retrieval, approve a trust anchor or verify historical human/qualified
hats, independent reviews, policy/prerequisites or regulated signed-log continuity.
Those dependencies and full request-bound writer composition remain required.
