# Development evidence

Baseline `471f9f6`; local verification 2026-09-04.

- Thirteen new adapter tests cover exact repository/permissions, immutable
  commit/tree/blob reads, path/mode/encoding/hash boundaries, actual stream
  size, cached-token refresh, RSA App signing and current Git authorization.
- Existing ten identity tests continue to pass. Root `pnpm check` passed;
  the two subsequently added refresh/UTF-8 tests were also checked directly.
- No network request to a real GitHub App installation was made by these
  tests. Generated RSA keys and isolated HTTP responses supplied the provider
  boundary. The configured API version is 2026-03-10.
- No real credential was read, token exchanged, branch protected, provider
  file written or gate signed. Existing Test Agent App identity is not reused.

Authorization reads require an explicitly configured protected operating repo
and administrator-controlled document path. Configuration/record authorship
must be established before live composition. The resolver checks current head
twice and has no cached authorization fallback. OIDC applies active/expiry
and valid-after checks to the returned record. Cached installation tokens are
transport credentials, not cached membership authority.

This is not webhook ingestion, a write adapter, database reconciliation, actual
GitHub integration, login completion or a Gate 2 pass. Oversized/truncated
repository trees fail closed; paginated subtree traversal is later work.

References: [installation tokens](https://docs.github.com/en/rest/apps/apps#create-an-installation-access-token-for-an-app),
[trees](https://docs.github.com/en/rest/git/trees#get-a-tree),
[blobs](https://docs.github.com/en/rest/git/blobs#get-a-blob).
