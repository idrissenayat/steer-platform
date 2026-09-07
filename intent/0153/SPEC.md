# Spec

Add an optional read-only commit capability to `RepositoryReader`, implemented by
the existing GitHub adapter with its narrow installation token. Exact immutable
revisions only; bind each result to the configured organization and repository.
Validate the returned SHA and at most 16 unique non-self parent SHAs. Do not add a
new provider, permission, mutable branch lookup or write endpoint.

The selected native Critic reference may explicitly opt in using
`ancestry: { maxCommits: N }`, where N is an integer from 1 through 100. Startup must
reject this option without retained history or commit-reader capability, before
identity/source I/O. No HTTP request or review text may install this configuration.
Existing observation-only configurations without the option retain an unverified
ancestry obligation and return no ancestry observation.

Traverse every consecutive selected target pair, then the final target to the
current source revision. Equality is allowed only after reading the commit. Follow
all merge-parent choices, not first-parent history alone. Use a shared unique-commit
budget and cache across links; stop before reading beyond that budget. Require an
observed descendant-to-ancestor path for every link. Unknown, unavailable, unrelated
or over-budget history is unverified, not a successful or truncated result.

Validate scope, revision, schema, duplicate/self edges and cycles in the retained
subgraph. Guard every read before and after it using the owning collector's existing
deadline and lifecycle. Preserve its final identity/head check and common signer/
runner validity checks. A source move, revoked observer or expired collection may
not return an otherwise successful path. Shutdown ownership remains with the caller.

Return immutable selected links and their retained commit metadata alongside the
native history, not in place of it. `gateVerified` and `writeAuthorized` remain false;
HOLD disposition is unchanged. Standalone history normalization still correctly
states that it has not checked ancestry; only the combined ancestry result supplies
the explicit selected-path observation.

Parent edges are reported by the configured code-host reader. This does not hash raw
commit objects independently, verify every unread branch, establish authoritative
history selection, prove resolution claims or approve runner/provider provenance.
Those remain separate obligations before full action-time write authority.
