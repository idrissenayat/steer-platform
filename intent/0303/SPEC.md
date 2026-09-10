# Native, private corpus batch read

- Register the batch primitive privately on an exact reader construction. No new
  HTTP tool, package export, factory activation or automatic collector switch.
- Require 1–100 distinct revision/path references across at most four inventory
  objects produced by that reader. Copies, foreign proofs, malformed paths/OIDs,
  missing files and nonregular modes reject before transport or policy callbacks.
- Validate all membership before planning. Deduplicate immutable object bytes only
  within this call; retain every revision/path's independent source policy.
- Use the existing restricted token acquisition/refresh and sanitized error path.
  Queries are read-only, use variables, at most 16 aliases and a conservative 2 MiB
  response estimate. Per-file ceiling is 128 KiB; absent size hints are conservative.
- Fresh caller/all-grants callback before policy access, before each content batch
  and after each batch's source checks. Per-path source permission is checked before
  and after each batch. The enclosing owner still handles root selection, final
  phase closure, lifecycle/keys and admission/drainage; this port cannot grant them.
- Preserve UTF-8/BOM/trailing bytes, verify Git object SHA-1, SHA-256, declared size,
  exact repository identity and complete response shape. Binary/null/truncated,
  partial, corrupt, oversized and unexpected responses deny, with no partial return.
- Propagate cancellation into content requests and check after callbacks/IO. No
  cached content or permission proof may escape into a later request. Unknown or
  replaced reader/boundary ports deny, not silently fall back to a costly protocol.
- Verify native Git-backed provider emulation, independent revision denials, token
  refresh/scope denial, bounded queries/streams, late cancellation and old-reader
  regressions. This is a production-code primitive, not an installed journey or C22.

Provider contract: [GitHub query/variable transport](https://docs.github.com/en/graphql/guides/forming-calls-with-graphql),
[Blob fields](https://docs.github.com/en/graphql/reference/git#blob) and
[repository object lookup](https://docs.github.com/en/graphql/reference/repos#repository).
